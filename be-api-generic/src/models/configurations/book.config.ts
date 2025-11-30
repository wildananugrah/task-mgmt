import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';

const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  slug: z.string().min(1).max(200),
  published: z.boolean().default(false),
});

export const bookConfig: ModelConfig = {
  name: 'book',
  model: prisma.book,
  validation: {
    create: createBookSchema,
    update: createBookSchema.partial(),
  },
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  hooks: {
    beforeCreate: async (data: any) => {
      // Convert createdById to authorId for Book model
      if (data.createdById) {
        data.authorId = data.createdById;
        delete data.createdById;
      }
      return data;
    },
    afterCreate: async (book: any, userId?: string, requestContext?: any) => {
      // Log book creation activity
      if (userId && requestContext) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        await requestContext.logActivity({
          userId,
          action: 'CREATED',
          entity: 'Book',
          entityId: book.id,
          details: getSafeEntityDetails(book),
        });
      }
    },
    afterUpdate: async (book: any, userId?: string, requestContext?: any) => {
      // Log book update activity
      if (userId && requestContext) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        await requestContext.logActivity({
          userId,
          action: 'UPDATED',
          entity: 'Book',
          entityId: book.id,
          details: getSafeEntityDetails(book),
        });
      }
    },
    beforeDelete: async (id: string, userId?: string, requestContext?: any) => {
      // Log deletion activity before deletion
      const book = await prisma.book.findUnique({ where: { id } });
      const { getSafeEntityDetails } = await import('../../utils/activity-logger');
      if (userId && requestContext && book) {
        await requestContext.logActivity({
          userId,
          action: 'DELETED',
          entity: 'Book',
          entityId: id,
          details: getSafeEntityDetails(book),
        });
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