/**
 * MinIO Storage Provider Implementation
 */

import * as Minio from 'minio';
import config from '../config';
import logger from '../config/logger';
import type {
  StorageProvider,
  UploadOptions,
  UploadResult,
  DownloadResult,
} from '../interfaces/storage-provider.interface';
import { Readable } from 'stream';

export class MinioStorageProvider implements StorageProvider {
  private client: Minio.Client;
  private bucketName: string;

  constructor() {
    this.client = new Minio.Client({
      endPoint: config.MINIO_ENDPOINT!,
      port: config.MINIO_PORT!,
      useSSL: config.MINIO_USE_SSL!,
      accessKey: config.MINIO_ACCESS_KEY!,
      secretKey: config.MINIO_SECRET_KEY!,
    });
    this.bucketName = config.MINIO_BUCKET_NAME!;
  }

  async initialize(): Promise<void> {
    try {
      // Check if bucket exists
      const bucketExists = await this.client.bucketExists(this.bucketName);

      if (!bucketExists) {
        // Create bucket if it doesn't exist
        await this.client.makeBucket(this.bucketName, config.MINIO_REGION);
        logger.info(`MinIO bucket '${this.bucketName}' created successfully`);
      } else {
        logger.info(`MinIO bucket '${this.bucketName}' already exists`);
      }
    } catch (error) {
      logger.error('Failed to initialize MinIO bucket:', error);
      throw error;
    }
  }

  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { buffer, filename, mimetype, size } = options;

    try {
      const metadata = {
        'Content-Type': mimetype,
        'Content-Length': size.toString(),
      };

      await this.client.putObject(this.bucketName, filename, buffer, size, metadata);

      const url = await this.client.presignedGetObject(this.bucketName, filename, 24 * 60 * 60);

      logger.info(`File uploaded to MinIO: ${filename}`);

      return {
        key: filename,
        url,
        size,
        mimetype,
      };
    } catch (error) {
      logger.error(`Failed to upload file to MinIO: ${filename}`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<DownloadResult> {
    try {
      const stream = await this.client.getObject(this.bucketName, key);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const stat = await this.client.statObject(this.bucketName, key);

            resolve({
              buffer,
              mimetype: stat.metaData['content-type'] || 'application/octet-stream',
              filename: key,
            });
          } catch (error) {
            reject(error);
          }
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to download file from MinIO: ${key}`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, key);
      logger.info(`File deleted from MinIO: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete file from MinIO: ${key}`, error);
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, key);
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key: string): Promise<{ size: number; mimetype: string; lastModified: Date }> {
    try {
      const stat = await this.client.statObject(this.bucketName, key);
      return {
        size: stat.size,
        mimetype: stat.metaData['content-type'] || 'application/octet-stream',
        lastModified: stat.lastModified,
      };
    } catch (error) {
      logger.error(`Failed to get file metadata from MinIO: ${key}`, error);
      throw error;
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      const copyConditions = new Minio.CopyConditions();
      await this.client.copyObject(
        this.bucketName,
        destinationKey,
        `/${this.bucketName}/${sourceKey}`,
        copyConditions
      );

      const metadata = await this.getFileMetadata(destinationKey);
      const url = await this.client.presignedGetObject(this.bucketName, destinationKey, 24 * 60 * 60);

      logger.info(`File copied in MinIO: ${sourceKey} -> ${destinationKey}`);

      return {
        key: destinationKey,
        url,
        size: metadata.size,
        mimetype: metadata.mimetype,
      };
    } catch (error) {
      logger.error(`Failed to copy file in MinIO: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const stream = this.client.listObjects(this.bucketName, prefix, true);
      const files: string[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => {
          if (obj.name) {
            files.push(obj.name);
          }
        });
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to list files from MinIO`, error);
      throw error;
    }
  }
}
