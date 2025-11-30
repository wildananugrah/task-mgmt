import { GraphQLError } from 'graphql';
import bcrypt from 'bcrypt';
import { apiGenerator } from '../models/configurations';
import { authRouter } from '../routes/auth.router';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import type { AuthRequest } from '../types/auth';

interface Context {
  req: AuthRequest;
  user?: any;
}

const checkAuth = async (context: Context, requiredRoles?: string[]) => {
  await authenticate(context.req);
  if (!context.req.user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (requiredRoles && requiredRoles.length > 0) {
    authorize(requiredRoles)(context.req);
  }

  context.user = context.req.user;
  return context.user;
};

export const resolvers = {
  Query: {
    // Products
    products: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('product');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findMany('product', args.filter || {});
    },

    product: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('product');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findOne('product', args.id);
    },

    // Categories
    categories: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('category');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findMany('category', args.filter || {});
    },

    category: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('category');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findOne('category', args.id);
    },

    // Users
    users: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('user');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findMany('user', args.filter || {});
    },

    user: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('user');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findOne('user', args.id);
    },

    me: async (_: any, __: any, context: Context) => {
      const user = await checkAuth(context);
      return apiGenerator.findOne('user', user.userId);
    },

    // Orders
    orders: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('order');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findMany('order', args.filter || {});
    },

    order: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('order');
      if (config?.permissions?.read) {
        await checkAuth(context, config.permissions.read);
      }

      return apiGenerator.findOne('order', args.id);
    },

    myOrders: async (_: any, args: any, context: Context) => {
      const user = await checkAuth(context);
      const filter = {
        ...args.filter,
        userId: user.userId,
      };

      return apiGenerator.findMany('order', filter);
    },
  },

  Mutation: {
    // Auth
    login: async (_: any, args: any) => {
      const { email, password } = args;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.isActive) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Create mock request for auth router
      const mockReq = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await authRouter.login(mockReq);
      const data = await response.json();

      return data;
    },

    register: async (_: any, args: any) => {
      const mockReq = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(args),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await authRouter.register(mockReq);
      const data = await response.json();

      if (response.status !== 201) {
        throw new GraphQLError(data.error || 'Registration failed', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      return data;
    },

    refreshToken: async (_: any, args: any) => {
      const mockReq = new Request('http://localhost/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify(args),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await authRouter.refreshToken(mockReq);
      const data = await response.json();

      if (response.status !== 200) {
        throw new GraphQLError(data.error || 'Token refresh failed', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return data.accessToken;
    },

    logout: async (_: any, args: any) => {
      const mockReq = new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify(args),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await authRouter.logout(mockReq);
      return response.status === 200;
    },

    // Products
    createProduct: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('product');
      if (config?.permissions?.create) {
        await checkAuth(context, config.permissions.create);
      }

      return apiGenerator.create('product', args.input, context.user?.userId);
    },

    updateProduct: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('product');
      if (config?.permissions?.update) {
        await checkAuth(context, config.permissions.update);
      }

      return apiGenerator.update('product', args.id, args.input);
    },

    deleteProduct: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('product');
      if (config?.permissions?.delete) {
        await checkAuth(context, config.permissions.delete);
      }

      await apiGenerator.delete('product', args.id);
      return true;
    },

    // Categories
    createCategory: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('category');
      if (config?.permissions?.create) {
        await checkAuth(context, config.permissions.create);
      }

      return apiGenerator.create('category', args.input, context.user?.userId);
    },

    updateCategory: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('category');
      if (config?.permissions?.update) {
        await checkAuth(context, config.permissions.update);
      }

      return apiGenerator.update('category', args.id, args.input);
    },

    deleteCategory: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('category');
      if (config?.permissions?.delete) {
        await checkAuth(context, config.permissions.delete);
      }

      await apiGenerator.delete('category', args.id);
      return true;
    },

    // Users
    createUser: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('user');
      if (config?.permissions?.create) {
        await checkAuth(context, config.permissions.create);
      }

      return apiGenerator.create('user', args.input, context.user?.userId);
    },

    updateUser: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('user');
      if (config?.permissions?.update) {
        await checkAuth(context, config.permissions.update);
      }

      return apiGenerator.update('user', args.id, args.input);
    },

    deleteUser: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('user');
      if (config?.permissions?.delete) {
        await checkAuth(context, config.permissions.delete);
      }

      await apiGenerator.delete('user', args.id);
      return true;
    },

    // Orders
    createOrder: async (_: any, args: any, context: Context) => {
      const user = await checkAuth(context);
      const config = apiGenerator.getModelConfig('order');
      if (config?.permissions?.create) {
        authorize(config.permissions.create)(context.req);
      }

      const orderData = {
        ...args.input,
        userId: user.userId,
      };

      return apiGenerator.create('order', orderData, user.userId);
    },

    updateOrder: async (_: any, args: any, context: Context) => {
      const config = apiGenerator.getModelConfig('order');
      if (config?.permissions?.update) {
        await checkAuth(context, config.permissions.update);
      }

      return apiGenerator.update('order', args.id, args.input);
    },

    cancelOrder: async (_: any, args: any, context: Context) => {
      const user = await checkAuth(context);

      // Check if user owns the order or is admin/manager
      const order = await prisma.order.findUnique({
        where: { id: args.id },
        select: { userId: true, status: true },
      });

      if (!order) {
        throw new GraphQLError('Order not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (order.userId !== user.userId && !['ADMIN', 'MANAGER'].includes(user.role)) {
        throw new GraphQLError('Not authorized to cancel this order', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return apiGenerator.update('order', args.id, { status: 'CANCELLED' });
    },
  },

  // Field resolvers for computed fields
  Product: {
    stockStatus: (parent: any) => {
      if (parent.quantity === 0) return 'OUT_OF_STOCK';
      if (parent.quantity <= parent.minQuantity) return 'LOW_STOCK';
      return 'IN_STOCK';
    },
  },

  Category: {
    productCount: async (parent: any) => {
      return prisma.product.count({
        where: { categoryId: parent.id },
      });
    },
  },

  User: {
    displayName: (parent: any) => {
      return [parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email;
    },
  },
};