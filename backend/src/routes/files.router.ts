import { z } from 'zod';
import { fileStorageService } from '../services/file-storage.service';
import { verifyAccessToken } from '../utils/jwt';
import { handleError } from '../middleware/error-handler';
import logger from '../config/logger';
import type { AuthRequest } from '../types/auth';
import { parseMultipartFormData, getFile, getFiles, validateFileType, validateFileSize } from '../utils/multipart-parser';
import config from '../config';

// Parse allowed file types from config
const allowedMimeTypes = config.ALLOWED_FILE_TYPES.split(',').map(type => type.trim());

// Validation schemas
const uploadQuerySchema = z.object({
  folder: z.string().optional(),
  isPublic: z.string().optional().transform(v => v === 'true'),
});

const listFilesQuerySchema = z.object({
  limit: z.string().optional().default('20').transform(Number),
  offset: z.string().optional().default('0').transform(Number),
  search: z.string().optional(),
});

const updateFileSchema = z.object({
  folder: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export class FilesRouter {
  /**
   * Upload single file
   * POST /api/files/upload
   */
  async uploadFile(req: AuthRequest): Promise<Response> {
    console.log('[FilesRouter] uploadFile called');
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        userId = payload?.userId;
      }

      console.log('[FilesRouter] userId:', userId);

      // Parse query parameters
      const url = new URL(req.url);
      const query = Object.fromEntries(url.searchParams);
      const { folder, isPublic } = uploadQuerySchema.parse(query);

      console.log('[FilesRouter] folder:', folder, 'isPublic:', isPublic);

      // Parse multipart form data
      console.log('[FilesRouter] About to parse multipart form data');
      const formData = await parseMultipartFormData(req);
      console.log('[FilesRouter] Form data parsed, looking for file');
      const file = getFile(formData, 'file');
      console.log('[FilesRouter] file found:', !!file);

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate file type
      if (!validateFileType(file, allowedMimeTypes)) {
        return new Response(
          JSON.stringify({
            error: `File type '${file.mimetype}' is not allowed`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes: allowedMimeTypes,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate file size
      if (!validateFileSize(file, config.MAX_FILE_SIZE)) {
        return new Response(
          JSON.stringify({
            error: `File too large. Maximum size is ${config.MAX_FILE_SIZE / 1024 / 1024}MB`,
            code: 'FILE_TOO_LARGE',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Upload to MinIO
      const uploadedFile = await fileStorageService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        {
          userId,
          folder,
          isPublic,
          metadata: {
            uploadedFrom: req.headers.get('user-agent'),
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          },
        }
      );

      logger.info('File uploaded successfully', {
        fileId: uploadedFile.id,
        userId,
        fileName: file.originalname,
        size: file.size,
      });

      return new Response(JSON.stringify(uploadedFile), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('File upload failed:', error);
      return handleError(error);
    }
  }

  /**
   * Upload multiple files
   * POST /api/files/upload-multiple
   */
  async uploadMultipleFiles(req: AuthRequest): Promise<Response> {
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        userId = payload?.userId;
      }

      // Parse query parameters
      const url = new URL(req.url);
      const query = Object.fromEntries(url.searchParams);
      const { folder, isPublic } = uploadQuerySchema.parse(query);

      // Parse multipart form data
      const formData = await parseMultipartFormData(req);
      const files = getFiles(formData, 'files');

      if (!files || files.length === 0) {
        return new Response(JSON.stringify({ error: 'No files uploaded' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (files.length > 10) {
        return new Response(
          JSON.stringify({
            error: 'Too many files. Maximum 10 files allowed',
            code: 'TOO_MANY_FILES',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate all files
      for (const file of files) {
        if (!validateFileType(file, allowedMimeTypes)) {
          return new Response(
            JSON.stringify({
              error: `File type '${file.mimetype}' is not allowed for file '${file.originalname}'`,
              code: 'INVALID_FILE_TYPE',
              allowedTypes: allowedMimeTypes,
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (!validateFileSize(file, config.MAX_FILE_SIZE)) {
          return new Response(
            JSON.stringify({
              error: `File '${file.originalname}' is too large. Maximum size is ${
                config.MAX_FILE_SIZE / 1024 / 1024
              }MB`,
              code: 'FILE_TOO_LARGE',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Upload all files to MinIO
      const uploadPromises = files.map((file) =>
        fileStorageService.uploadFile(file.buffer, file.originalname, file.mimetype, {
          userId,
          folder,
          isPublic,
          metadata: {
            uploadedFrom: req.headers.get('user-agent'),
            ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          },
        })
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      logger.info('Multiple files uploaded successfully', {
        count: uploadedFiles.length,
        userId,
        fileIds: uploadedFiles.map((f) => f.id),
      });

      return new Response(JSON.stringify({ files: uploadedFiles, count: uploadedFiles.length }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Multiple file upload failed:', error);
      return handleError(error);
    }
  }

  /**
   * Get file by ID
   * GET /api/files/:id
   */
  async getFile(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1];

      if (!fileId || fileId === 'files') {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const fileMetadata = await fileStorageService.getFileMetadata(fileId);

      return new Response(JSON.stringify(fileMetadata), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Download file
   * GET /api/files/:id/download
   */
  async downloadFile(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 2]; // Get ID before /download

      if (!fileId || fileId === 'files') {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const fileBuffer = await fileStorageService.getFile(fileId);
      const metadata = await fileStorageService.getFileMetadata(fileId);

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': metadata.mimeType,
          'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
          'Content-Length': metadata.size.toString(),
        },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Delete file
   * DELETE /api/files/:id
   */
  async deleteFile(req: AuthRequest): Promise<Response> {
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        userId = payload?.userId;
      }

      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1];

      if (!fileId || fileId === 'files') {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const deleted = await fileStorageService.deleteFile(fileId, userId);

      if (deleted) {
        logger.info('File deleted successfully', { fileId, userId });
        return new Response(JSON.stringify({ message: 'File deleted successfully', id: fileId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to delete file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * List user files
   * GET /api/files
   */
  async listFiles(req: AuthRequest): Promise<Response> {
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);

      if (!payload?.userId) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Parse query parameters
      const url = new URL(req.url);
      const query = Object.fromEntries(url.searchParams);
      const { limit, offset, search } = listFilesQuerySchema.parse(query);

      const result = await fileStorageService.listUserFiles(payload.userId, limit, offset, search);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Update file properties
   * PATCH /api/files/:id
   */
  async updateFile(req: AuthRequest): Promise<Response> {
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        userId = payload?.userId;
      }

      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1];

      if (!fileId || fileId === 'files') {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const updates = updateFileSchema.parse(body);

      const updatedFile = await fileStorageService.updateFile(fileId, updates, userId);

      logger.info('File updated successfully', {
        fileId,
        userId,
        updates,
      });

      return new Response(JSON.stringify(updatedFile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Copy file
   * POST /api/files/:id/copy
   */
  async copyFile(req: AuthRequest): Promise<Response> {
    try {
      // Extract user from token
      const authHeader = req.headers.get('Authorization');
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        userId = payload?.userId;
      }

      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 2]; // Get ID before /copy

      if (!fileId || fileId === 'files') {
        return new Response(JSON.stringify({ error: 'File ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const { folder = 'copies' } = body;

      const copiedFile = await fileStorageService.copyFile(fileId, folder, userId);

      logger.info('File copied successfully', {
        originalFileId: fileId,
        newFileId: copiedFile.id,
        userId,
      });

      return new Response(JSON.stringify(copiedFile), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle file routes
   */
  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Upload single file
    if (pathname === '/api/files/upload' && method === 'POST') {
      return this.uploadFile(req as AuthRequest);
    }

    // Upload multiple files
    if (pathname === '/api/files/upload-multiple' && method === 'POST') {
      return this.uploadMultipleFiles(req as AuthRequest);
    }

    // List user files
    if (pathname === '/api/files' && method === 'GET') {
      return this.listFiles(req as AuthRequest);
    }

    // File operations by ID
    if (pathname.startsWith('/api/files/')) {
      const pathParts = pathname.split('/');

      // Download file
      if (pathname.endsWith('/download') && method === 'GET') {
        return this.downloadFile(req);
      }

      // Copy file
      if (pathname.endsWith('/copy') && method === 'POST') {
        return this.copyFile(req as AuthRequest);
      }

      // Get file metadata
      if (pathParts.length === 4 && method === 'GET') {
        return this.getFile(req);
      }

      // Update file
      if (pathParts.length === 4 && method === 'PATCH') {
        return this.updateFile(req as AuthRequest);
      }

      // Delete file
      if (pathParts.length === 4 && method === 'DELETE') {
        return this.deleteFile(req as AuthRequest);
      }
    }

    return null;
  }

  /**
   * Get available file routes for documentation
   */
  getRoutes(): string[] {
    return [
      'POST /api/files/upload',
      'POST /api/files/upload-multiple',
      'GET /api/files',
      'GET /api/files/:id',
      'GET /api/files/:id/download',
      'PATCH /api/files/:id',
      'DELETE /api/files/:id',
      'POST /api/files/:id/copy',
    ];
  }
}

export const filesRouter = new FilesRouter();
