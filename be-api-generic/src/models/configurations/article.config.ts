import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';
import { fileStorageService } from '../../services/file-storage.service';
import { parseMultipartFormData, getFile, validateFileType, validateFileSize } from '../../utils/multipart-parser';
import config from '../../config';
import logger from '../../config/logger';
import { handleError } from '../../middleware/error-handler';
import { verifyAccessToken } from '../../utils/jwt';
import { requestTrackingMiddleware, getRequestContext } from '../../middleware/request-tracking.middleware';

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  slug: z.string().min(1).max(200),
  published: z.boolean().default(false),
  fileId: z.any().optional(),
  authorId: z.string()
});

// Parse allowed file types from config
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export const articleConfig: ModelConfig = {
  name: 'article',
  model: prisma.article,
  validation: {
    create: createArticleSchema,
    update: createArticleSchema.partial(),
  },
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  customRoutes: [
    {
      method: 'POST',
      path: '/:id/cover-image',
      handler: async (req: Request, params: { id: string }) => {
        try {
          // Extract user from token
          const authHeader = req.headers.get('Authorization');
          let userId: string | undefined;

          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = verifyAccessToken(token);
            userId = payload?.userId;
          }

          if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Check if article exists
          const article = await prisma.article.findUnique({
            where: { id: params.id },
          });

          if (!article) {
            return new Response(
              JSON.stringify({ error: 'Article not found' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          // Parse multipart form data
          const formData = await parseMultipartFormData(req);
          const file = getFile(formData, 'file');

          if (!file) {
            return new Response(JSON.stringify({ error: 'No file uploaded' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Validate file type (only images allowed for cover)
          if (!validateFileType(file, allowedImageTypes)) {
            return new Response(
              JSON.stringify({
                error: `File type '${file.mimetype}' is not allowed. Only images are accepted.`,
                code: 'INVALID_FILE_TYPE',
                allowedTypes: allowedImageTypes,
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

          // Upload to MinIO in the article-covers folder
          const uploadedFile = await fileStorageService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            {
              userId,
              folder: 'article-covers',
              isPublic: true, // Article covers are typically public
              metadata: {
                articleId: params.id,
                uploadedFrom: req.headers.get('user-agent'),
                ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
              },
            }
          );

          // Add request tracking
          const trackedReq = requestTrackingMiddleware(req);
          const requestContext = getRequestContext(trackedReq);

          // Update article with the new file ID
          const updatedArticle = await prisma.article.update({
            where: { id: params.id },
            data: { fileId: uploadedFile.id },
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              file: true,
            },
          });

          // Log activity
          if (requestContext) {
            const { getSafeEntityDetails } = await import('../../utils/activity-logger');
            await requestContext.logActivity({
              userId,
              action: 'UPDATED',
              entity: 'Article',
              entityId: updatedArticle.id,
              details: {
                ...getSafeEntityDetails(updatedArticle),
                message: 'Cover image uploaded',
                fileId: uploadedFile.id,
              },
            });
          }

          logger.info('Article cover image uploaded successfully', {
            articleId: params.id,
            fileId: uploadedFile.id,
            userId,
          });

          return new Response(JSON.stringify(updatedArticle), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          logger.error('Article cover image upload failed:', error);
          return handleError(error);
        }
      },
      permissions: ['ADMIN', 'MANAGER'],
    },
  ],
  transform: {
    input: (data: any) => {
      return data;
    }
  },
  hooks: {
    beforeCreate: async (data: any) => {
      // Convert createdById to authorId for Article model
      if (data.createdById) {
        data.authorId = data.createdById;
        delete data.createdById;
      }
      return data;
    },
    afterCreate: async (article: any, userId?: string, requestContext?: any) => {
      // Log article creation activity
      if (userId) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        if (requestContext) {
          await requestContext.logActivity({
            userId,
            action: 'CREATED',
            entity: 'Article',
            entityId: article.id,
            details: getSafeEntityDetails(article),
          });
        }
      }
    },
    afterUpdate: async (article: any, userId?: string, requestContext?: any) => {
      // Log article update activity
      if (userId) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        if (requestContext) {
          await requestContext.logActivity({
            userId,
            action: 'UPDATED',
            entity: 'Article',
            entityId: article.id,
            details: getSafeEntityDetails(article),
          });
        }
      }
    },
    beforeDelete: async (id: string, userId?: string, requestContext?: any) => {
      // Log deletion activity before deletion
      if (userId) {
        const article = await prisma.article.findUnique({ where: { id } });
        if (article) {
          const { getSafeEntityDetails } = await import('../../utils/activity-logger');
          if (requestContext) {
            await requestContext.logActivity({
            userId,
            action: 'DELETED',
            entity: 'Article',
            entityId: id,
            details: getSafeEntityDetails(article),
          });
          }
        }
      }
    },
  },
  relations: {
    include: {
      author: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      file: true
    },
  },
  search: {
    fields: ['title', 'content'],
    fuzzy: true,
  },
  filters: {
    published: { type: 'boolean' },
    authorId: { type: 'exact' },
  },
};