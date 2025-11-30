import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';

// Validation schemas for Product
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().min(1).max(50),
  barcode: z.string().optional(),
  price: z.number().positive(),
  cost: z.number().positive().optional(),
  quantity: z.number().int().min(0).default(0),
  minQuantity: z.number().int().min(0).default(0),
  unit: z.string().default('piece'),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  images: z.array(z.string().url()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED']).default('ACTIVE'),
  featured: z.boolean().default(false),
  categoryId: z.string().uuid(),
  metadata: z.record(z.any(), z.any()).optional(),
});

const updateProductSchema = createProductSchema.partial().omit({ sku: true });

const queryProductSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['name', 'price', 'quantity', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED']).optional(),
  featured: z.string().transform(val => val === 'true').optional(),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  tags: z.string().optional(), // comma-separated tags
});

export const productConfig: ModelConfig = {
  name: 'product',
  model: prisma.product,
  validation: {
    create: createProductSchema,
    update: updateProductSchema,
    query: queryProductSchema,
  },
  transform: {
    input: (data: any) => {
      // Convert price and cost to Decimal
      if (data.price) data.price = String(data.price);
      if (data.cost) data.cost = String(data.cost);

      // Parse tags if provided as comma-separated string
      if (typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map((tag: string) => tag.trim());
      }

      return data;
    },
    output: (data: any) => {
      // Convert Decimal to number for API response
      if (data.price) data.price = parseFloat(data.price);
      if (data.cost) data.cost = data.cost ? parseFloat(data.cost) : null;

      // Calculate stock status
      if (data.quantity !== undefined) {
        data.stockStatus = data.quantity === 0 ? 'OUT_OF_STOCK' :
          data.quantity <= data.minQuantity ? 'LOW_STOCK' : 'IN_STOCK';
      }

      return data;
    },
  },
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER', 'CLIENT'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  hooks: {
    beforeCreate: async (data: any) => {
      // Check if SKU already exists
      const existing = await prisma.product.findUnique({
        where: { sku: data.sku },
      });
      if (existing) {
        throw new Error('Product with this SKU already exists');
      }

      // Auto-generate barcode if not provided
      if (!data.barcode) {
        data.barcode = `PRD-${data.sku}-${Date.now()}`;
      }

      return data;
    },
    afterCreate: async (product: any, userId?: string, requestContext?: any) => {
      // Create initial stock movement record
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'PURCHASE',
          quantity: product.quantity,
          previousQty: 0,
          currentQty: product.quantity,
          reference: `Initial stock for ${product.sku}`,
          notes: 'Product created',
        },
      });

      // Log product creation activity
      if (userId) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        if (requestContext) {
          await requestContext.logActivity({
            userId,
            action: 'CREATED',
            entity: 'Product',
            entityId: product.id,
            details: getSafeEntityDetails(product),
          });
        }
      }
    },
    beforeUpdate: async (id: string, data: any) => {
      // If quantity is being updated, prepare for stock movement tracking
      if (data.quantity !== undefined) {
        const current = await prisma.product.findUnique({
          where: { id },
          select: { quantity: true },
        });

        if (current) {
          // Store previous quantity for stock movement
          (data as any)._previousQty = current.quantity;
        }
      }

      return data;
    },
    afterUpdate: async (product: any, userId?: string, requestContext?: any) => {
      // Create stock movement record if quantity changed
      if ((product as any)._previousQty !== undefined &&
        (product as any)._previousQty !== product.quantity) {
        const diff = product.quantity - (product as any)._previousQty;

        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: diff > 0 ? 'PURCHASE' : 'ADJUSTMENT',
            quantity: Math.abs(diff),
            previousQty: (product as any)._previousQty,
            currentQty: product.quantity,
            reference: 'Manual stock adjustment',
          },
        });
      }

      // Log product update activity
      if (userId) {
        const { getSafeEntityDetails } = await import('../../utils/activity-logger');
        if (requestContext) {
          await requestContext.logActivity({
            userId,
            action: 'UPDATED',
            entity: 'Product',
            entityId: product.id,
            details: getSafeEntityDetails(product),
          });
        }
      }
    },
    beforeDelete: async (id: string, userId?: string, requestContext?: any) => {
      // Log deletion activity before deletion
      if (userId) {
        const product = await prisma.product.findUnique({ where: { id } });
        if (product) {
          const { getSafeEntityDetails } = await import('../../utils/activity-logger');
          if (requestContext) {
            await requestContext.logActivity({
              userId,
              action: 'DELETED',
              entity: 'Product',
              entityId: id,
              details: getSafeEntityDetails(product),
            });
          }
        }
      }
    },
  },
  relations: {
    include: {
      category: true,
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      stockMovements: {
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  },
  search: {
    fields: ['name', 'description', 'sku', 'barcode'],
    fuzzy: true,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  sorting: {
    defaultField: 'createdAt',
    defaultOrder: 'desc',
    allowedFields: ['name', 'price', 'quantity', 'createdAt', 'updatedAt'],
  },
  filters: {
    categoryId: { type: 'exact' },
    status: { type: 'exact' },
    featured: { type: 'boolean' },
    minPrice: { type: 'gte', field: 'price' },
    maxPrice: { type: 'lte', field: 'price' },
    tags: { type: 'in' },
    minQuantity: { type: 'gte', field: 'quantity' },
    maxQuantity: { type: 'lte', field: 'quantity' },
  },
};