import { z } from 'zod';
import bcrypt from 'bcrypt';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';
import config from '../../config';
import { logActivity, getSafeEntityDetails } from '../../utils/activity-logger';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER', 'CLIENT']).default('USER'),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER', 'CLIENT']).optional(),
  isActive: z.boolean().optional(),
  // Password: either undefined/null (not changing), or valid password string
  password: z.union([
    z.string().min(8).max(100),
    z.literal(''),
    z.null(),
    z.undefined()
  ]).optional().transform(val => val === '' ? null : val),
});

const queryUserSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['email', 'firstName', 'lastName', 'role', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER', 'CLIENT']).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
});

export const userConfig: ModelConfig = {
  name: 'user',
  model: prisma.user,
  validation: {
    create: createUserSchema,
    update: updateUserSchema,
    query: queryUserSchema,
  },
  transform: {
    input: (data: any) => {
      // Password hashing will be done in beforeCreate hook to keep it synchronous
      return data;
    },
    output: (data: any) => {
      // Remove password from output
      const { password, ...userWithoutPassword } = data;

      // Add display name
      if (data.firstName || data.lastName) {
        userWithoutPassword.displayName = [data.firstName, data.lastName]
          .filter(Boolean)
          .join(' ');
      }

      return userWithoutPassword;
    },
  },
  permissions: {
    create: ['ADMIN'],
    read: ['ADMIN', 'MANAGER'],
    update: ['ADMIN'],
    delete: ['ADMIN'],
  },
  hooks: {
    beforeCreate: async (data: any) => {
      console.log('[User beforeCreate] Received data:', JSON.stringify(data, null, 2));

      // Remove createdById as User model doesn't have this field
      delete data.createdById;

      // Check if email already exists
      if (!data.email) {
        throw new Error('Email is required');
      }

      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new Error('User with this email already exists');
      }

      // Hash password before creating user
      if (data.password) {
        data.password = await bcrypt.hash(data.password, config.BCRYPT_SALT_ROUNDS);
      }

      console.log('[User beforeCreate] Returning data:', JSON.stringify(data, null, 2));
      return data;
    },
    afterCreate: async (user: any, userId?: string, requestContext?: any) => {
      // Log user creation activity using request context
      if (requestContext) {
        await requestContext.logActivity({
          userId: user.id,
          action: 'CREATED',
          entity: 'User',
          entityId: user.id,
          details: getSafeEntityDetails(user),
        });
      }
    },
    afterUpdate: async (user: any, userId?: string, requestContext?: any) => {
      // Log user update activity
      if (userId && requestContext) {
        await requestContext.logActivity({
          userId,
          action: 'UPDATED',
          entity: 'User',
          entityId: user.id,
          details: getSafeEntityDetails(user),
        });
      }
    },
    beforeUpdate: async (id: string, data: any) => {
      // Remove password field if it's null/empty (user doesn't want to change it)
      if (data.password === null || data.password === undefined || data.password === '') {
        delete data.password;
      } else {
        // Hash password if it's being updated
        data.password = await bcrypt.hash(data.password, config.BCRYPT_SALT_ROUNDS);
      }

      // Prevent users from deactivating themselves
      if (data.isActive === false) {
        // This would need to be enhanced with current user context
        // For now, just ensure at least one admin remains active
        if (data.role === 'ADMIN' || (await prisma.user.findUnique({ where: { id } }))?.role === 'ADMIN') {
          const activeAdminCount = await prisma.user.count({
            where: {
              role: 'ADMIN',
              isActive: true,
              id: { not: id },
            },
          });
          if (activeAdminCount === 0) {
            throw new Error('Cannot deactivate the last admin user');
          }
        }
      }
      return data;
    },
    beforeDelete: async (id: string, userId?: string, requestContext? : any) => {
      // Prevent deletion of last admin
      const user = await prisma.user.findUnique({
        where: { id },
      });
      if (user?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({
          where: {
            role: 'ADMIN',
            id: { not: id },
          },
        });
        if (adminCount === 0) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      // Log deletion activity before deletion
      if (userId && user && requestContext) {
        await requestContext.logActivity({
          userId,
          action: 'DELETED',
          entity: 'User',
          entityId: id,
          details: getSafeEntityDetails(user),
        });
      }

      // Clean up related records (except activity logs - keep for audit trail)
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
    },
  },
  relations: {
    include: {
      _count: {
        select: {
          products: true,
          orders: true,
          activities: true,
        },
      },
    },
  },
  search: {
    fields: ['email', 'firstName', 'lastName'],
    fuzzy: true,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  sorting: {
    defaultField: 'createdAt',
    defaultOrder: 'desc',
    allowedFields: ['email', 'firstName', 'lastName', 'role', 'createdAt'],
  },
  filters: {
    role: { type: 'exact' },
    isActive: { type: 'boolean' },
  },
};