import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  slug: z.string().min(1).max(100),
  parentId: z.string().uuid().optional().nullable().or(z.literal('').transform(() => null)),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = createCategorySchema.partial().omit({ slug: true });

const queryCategorySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['name', 'slug', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.string().transform(val => val === 'true').optional(),
});

export const categoryConfig: ModelConfig = {
  name: 'category',
  model: prisma.category,
  validation: {
    create: createCategorySchema,
    update: updateCategorySchema,
    query: queryCategorySchema,
  },
  transform: {
    input: (data: any) => {
      // Auto-generate slug from name if not provided
      if (data.name && !data.slug) {
        data.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      return data;
    },
    output: (data: any) => {
      // Add breadcrumb path for nested categories
      if (data.parent) {
        const breadcrumbs = [];
        let current = data.parent;
        while (current) {
          breadcrumbs.unshift({
            id: current.id,
            name: current.name,
            slug: current.slug,
          });
          current = current.parent;
        }
        data.breadcrumbs = breadcrumbs;
      }
      return data;
    },
  },
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  hooks: {
    beforeCreate: async (data: any) => {
      console.log('[Category beforeCreate] Received data:', JSON.stringify(data, null, 2));

      // Remove createdById as Category model doesn't have this field
      delete data.createdById;

      // Check if slug already exists
      const existing = await prisma.category.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        throw new Error('Category with this slug already exists');
      }

      // Validate parent exists if parentId is provided and convert to Prisma relation format
      if (data.parentId) {
        const parent = await prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) {
          throw new Error('Parent category not found');
        }

        // Prevent deep nesting (max 3 levels)
        let depth = 1;
        let currentParentId = parent.parentId;
        while (currentParentId && depth < 3) {
          const parentCategory = await prisma.category.findUnique({
            where: { id: currentParentId },
          });
          if (!parentCategory) break;
          currentParentId = parentCategory.parentId;
          depth++;
        }
        if (depth >= 3) {
          throw new Error('Maximum category nesting depth (3 levels) exceeded');
        }

        // Convert parentId to Prisma relation format
        data.parent = {
          connect: {
            id: data.parentId
          }
        };
        delete data.parentId;
      }

      console.log('[Category beforeCreate] Returning data:', JSON.stringify(data, null, 2));
      return data;
    },
    beforeUpdate: async (id: string, data: any) => {
      console.log('[Category beforeUpdate] Received data:', JSON.stringify(data, null, 2));

      // Handle parentId if provided - convert to Prisma relation format
      if (data.parentId !== undefined) {
        if (data.parentId === null) {
          // Disconnect parent
          data.parent = {
            disconnect: true
          };
        } else {
          // Validate parent exists and convert to connect format
          const parent = await prisma.category.findUnique({
            where: { id: data.parentId },
          });
          if (!parent) {
            throw new Error('Parent category not found');
          }

          // Prevent setting parent to itself
          if (data.parentId === id) {
            throw new Error('Category cannot be its own parent');
          }

          // Prevent circular references
          let currentParentId: string | null = data.parentId;
          let depth = 1;
          while (currentParentId && depth < 10) {
            const parentCategory = await prisma.category.findUnique({
              where: { id: currentParentId },
            });
            if (!parentCategory) break;
            if (parentCategory.parentId === id) {
              throw new Error('Circular reference detected');
            }
            currentParentId = parentCategory.parentId;
            depth++;
          }

          data.parent = {
            connect: {
              id: data.parentId
            }
          };
        }
        delete data.parentId;
      }

      console.log('[Category beforeUpdate] Returning data:', JSON.stringify(data, null, 2));
      return data;
    },
    afterCreate: async (category: any, userId?: string, requestContext?: any) => {
      // Log category creation activity
      const { getSafeEntityDetails } = await import('../../utils/activity-logger');
      if (userId && requestContext) {
        await requestContext.logActivity({
          userId,
          action: 'CREATED',
          entity: 'Category',
          entityId: category.id,
          details: getSafeEntityDetails(category),
        });
      }
    },
    afterUpdate: async (category: any, userId?: string, requestContext?: any) => {
      // Log category update activity
      const { getSafeEntityDetails } = await import('../../utils/activity-logger');
      if (userId && requestContext) {
        await requestContext.logActivity({
          userId,
          action: 'UPDATED',
          entity: 'Category',
          entityId: category.id,
          details: getSafeEntityDetails(category),
        });
      }
    },
    beforeDelete: async (id: string, userId?: string, requestContext?: any) => {
      // Check if category has products
      const productCount = await prisma.product.count({
        where: { categoryId: id },
      });
      if (productCount > 0) {
        throw new Error(`Cannot delete category with ${productCount} products. Please reassign products first.`);
      }

      // Check if category has children
      const childCount = await prisma.category.count({
        where: { parentId: id },
      });
      if (childCount > 0) {
        throw new Error(`Cannot delete category with ${childCount} subcategories. Please delete or reassign subcategories first.`);
      }

      // Log deletion activity before deletion
      if (userId) {
        const category = await prisma.category.findUnique({ where: { id } });
        if (category) {
          const { getSafeEntityDetails } = await import('../../utils/activity-logger');
          if (requestContext) {
            await requestContext.logActivity({
              userId,
              action: 'DELETED',
              entity: 'Category',
              entityId: category.id,
              details: getSafeEntityDetails(category),
            });
          }
        }
      }
    },
  },
  relations: {
    include: {
      parent: true,
      children: {
        where: { isActive: true },
      },
      _count: {
        select: {
          products: true,
          children: true,
        },
      },
    },
  },
  search: {
    fields: ['name', 'description', 'slug'],
    fuzzy: true,
  },
  pagination: {
    defaultLimit: 50,
    maxLimit: 200,
  },
  sorting: {
    defaultField: 'name',
    defaultOrder: 'asc',
    allowedFields: ['name', 'slug', 'createdAt', 'updatedAt'],
  },
  filters: {
    parentId: { type: 'exact' },
    isActive: { type: 'boolean' },
  },
};