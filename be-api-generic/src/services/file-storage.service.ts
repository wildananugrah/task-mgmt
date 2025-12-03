import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import config from '../config';
import logger from '../config/logger';
import prisma from '../config/database';
import { StorageProviderFactory } from '../providers/storage-provider.factory';

export interface FileUploadOptions {
  userId?: string;
  folder?: string;
  isPublic?: boolean;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  bucket: string;
  key: string;
  userId?: string;
  metadata?: any;
}

export class FileStorageService {
  private getBucketName(): string {
    return config.MINIO_BUCKET_NAME || '';
  }

  /**
   * Get storage provider instance
   */
  private getStorageProvider() {
    return StorageProviderFactory.getProvider();
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile> {
    const storageProvider = this.getStorageProvider();

    try {
      const { userId, folder = 'general', isPublic = false, metadata = {} } = options;

      // Generate unique filename
      const fileExtension = path.extname(originalName);
      const fileNameWithoutExt = path.basename(originalName, fileExtension);
      const uniqueId = uuidv4();
      const fileName = `${fileNameWithoutExt}-${uniqueId}${fileExtension}`;

      // Determine file path
      const visibility = isPublic ? 'public' : 'private';
      const objectName = `${visibility}/${folder}/${fileName}`;

      // Upload to storage provider
      const uploadResult = await storageProvider.uploadFile({
        buffer: fileBuffer,
        filename: objectName,
        mimetype: mimeType,
        size: fileBuffer.length,
      });

      // Save file metadata to database
      const fileRecord = await prisma.file.create({
        data: {
          originalName,
          fileName,
          mimeType,
          size: fileBuffer.length,
          bucket: this.getBucketName(),
          key: uploadResult.key,
          url: uploadResult.url,
          isPublic,
          userId,
          metadata: metadata as any,
          storageProvider: 'minio',
        },
      });

      logger.info('File uploaded successfully', {
        fileId: fileRecord.id,
        objectName: uploadResult.key,
        size: fileBuffer.length,
        userId,
        provider: 'minio',
      });

      return {
        id: fileRecord.id,
        originalName,
        fileName,
        mimeType,
        size: fileBuffer.length,
        url: uploadResult.url,
        bucket: this.getBucketName(),
        key: uploadResult.key,
        userId,
        metadata,
      };
    } catch (error) {
      logger.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Get file from storage
   */
  async getFile(fileId: string): Promise<Buffer> {
    const storageProvider = this.getStorageProvider();

    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      const result = await storageProvider.downloadFile(file.key);
      return result.buffer;
    } catch (error) {
      logger.error('Failed to get file:', error);
      throw error;
    }
  }

  /**
   * Delete file from storage and database
   */
  async deleteFile(fileId: string, userId?: string): Promise<boolean> {
    const storageProvider = this.getStorageProvider();

    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check ownership if userId is provided
      if (userId && file.userId !== userId) {
        throw new Error('Unauthorized to delete this file');
      }

      // Delete from storage provider
      await storageProvider.deleteFile(file.key);

      // Delete from database
      await prisma.file.delete({
        where: { id: fileId },
      });

      logger.info('File deleted successfully', {
        fileId,
        key: file.key,
        provider: 'minio'
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * List files for a user
   */
  async listUserFiles(userId: string, limit: number = 20, offset: number = 0, search?: string) {
    try {
      // Build where clause
      const where: any = { userId };

      // Add search filter if provided
      if (search) {
        where.originalName = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [files, total] = await Promise.all([
        prisma.file.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.file.count({
          where,
        }),
      ]);

      // Note: For private files, the URL might need to be regenerated
      // depending on the storage provider's URL expiration policy
      // For now, we'll use the URLs stored in the database

      return {
        files,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list user files:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string) {
    const storageProvider = this.getStorageProvider();

    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      const storageMetadata = await storageProvider.getFileMetadata(file.key);

      return {
        ...file,
        storageMetadata,
      };
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Update file properties (folder and/or public status)
   */
  async updateFile(
    fileId: string,
    updates: { folder?: string; isPublic?: boolean },
    userId?: string
  ): Promise<UploadedFile> {
    const storageProvider = this.getStorageProvider();

    try {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error('File not found');
      }

      // Check ownership if userId is provided
      if (userId && file.userId !== userId) {
        throw new Error('Unauthorized to update this file');
      }

      let newKey = file.key;
      let newUrl = file.url;
      let needsMove = false;

      // Determine if we need to move the file
      if (updates.folder !== undefined || updates.isPublic !== undefined) {
        const currentParts = file.key.split('/');
        const currentVisibility = currentParts[0]; // 'public' or 'private'
        const currentFolder = currentParts[1] || 'general';
        const fileName = currentParts.slice(2).join('/');

        const newVisibility = updates.isPublic !== undefined
          ? (updates.isPublic ? 'public' : 'private')
          : currentVisibility;
        const newFolder = updates.folder !== undefined ? updates.folder : currentFolder;

        newKey = `${newVisibility}/${newFolder}/${fileName}`;
        needsMove = newKey !== file.key;
      }

      // Move file if needed
      if (needsMove) {
        const copyResult = await storageProvider.copyFile(file.key, newKey);
        newUrl = copyResult.url; // Get the new URL from the copy result
        await storageProvider.deleteFile(file.key);
      }

      // Update database
      const updatedFile = await prisma.file.update({
        where: { id: fileId },
        data: {
          key: newKey,
          isPublic: updates.isPublic !== undefined ? updates.isPublic : file.isPublic,
          url: newUrl, // Use the new URL from copy result
        },
      });

      logger.info('File updated successfully', {
        fileId,
        oldKey: file.key,
        newKey,
        moved: needsMove,
      });

      return {
        id: updatedFile.id,
        originalName: updatedFile.originalName,
        fileName: updatedFile.fileName,
        mimeType: updatedFile.mimeType,
        size: updatedFile.size,
        url: updatedFile.url,
        bucket: updatedFile.bucket,
        key: updatedFile.key,
        userId: updatedFile.userId || "",
        metadata: updatedFile.metadata,
      };
    } catch (error) {
      logger.error('Failed to update file:', error);
      throw error;
    }
  }

  /**
   * Copy file
   */
  async copyFile(fileId: string, newFolder: string, userId?: string): Promise<UploadedFile> {
    const storageProvider = this.getStorageProvider();

    try {
      const originalFile = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!originalFile) {
        throw new Error('File not found');
      }

      // Generate new key
      const visibility = originalFile.isPublic ? 'public' : 'private';
      const uniqueId = uuidv4();
      const fileName = `copy-${uniqueId}-${originalFile.fileName}`;
      const newKey = `${visibility}/${newFolder}/${fileName}`;

      // Copy using storage provider
      const copyResult = await storageProvider.copyFile(originalFile.key, newKey);

      // Save to database
      const newFile = await prisma.file.create({
        data: {
          originalName: originalFile.originalName,
          fileName,
          mimeType: originalFile.mimeType,
          size: originalFile.size,
          bucket: this.getBucketName(),
          key: copyResult.key,
          url: copyResult.url,
          isPublic: originalFile.isPublic,
          userId: userId || originalFile.userId,
          metadata: originalFile.metadata || {},
        },
      });

      logger.info('File copied successfully', {
        originalFileId: fileId,
        newFileId: newFile.id,
        newKey: copyResult.key,
        provider: config.STORAGE_PROVIDER,
      });

      return {
        id: newFile.id,
        originalName: newFile.originalName,
        fileName: newFile.fileName,
        mimeType: newFile.mimeType,
        size: newFile.size,
        url: newFile.url,
        bucket: newFile.bucket,
        key: newFile.key,
        userId: newFile.userId || "",
        metadata: newFile.metadata,
      };
    } catch (error) {
      logger.error('Failed to copy file:', error);
      throw error;
    }
  }
}

export const fileStorageService = new FileStorageService();