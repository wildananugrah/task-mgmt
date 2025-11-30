import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';
import prisma from '../../config/database';

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  discount: z.number().min(0).optional(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  tax: z.number().min(0).optional(),
  shipping: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
  shippingInfo: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }).optional(),
  paymentInfo: z.object({
    method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'CASH', 'BANK_TRANSFER']),
    transactionId: z.string().optional(),
    status: z.enum(['PENDING', 'PAID', 'FAILED']).default('PENDING'),
  }).optional(),
});

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  notes: z.string().optional(),
  shippingInfo: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }).optional(),
  paymentInfo: z.object({
    method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'CASH', 'BANK_TRANSFER']),
    transactionId: z.string().optional(),
    status: z.enum(['PENDING', 'PAID', 'FAILED']),
  }).optional(),
});

const queryOrderSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['orderNumber', 'totalAmount', 'status', 'createdAt', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
});

export const orderConfig: ModelConfig = {
  name: 'order',
  model: prisma.order,
  validation: {
    create: createOrderSchema,
    update: updateOrderSchema,
    query: queryOrderSchema,
  },
  transform: {
    input: (data: any) => {
      // Convert amounts to Decimal
      if (data.totalAmount) data.totalAmount = String(data.totalAmount);
      if (data.tax) data.tax = String(data.tax);
      if (data.shipping) data.shipping = String(data.shipping);
      if (data.discount) data.discount = String(data.discount);

      return data;
    },
    output: (data: any) => {
      // Convert Decimal to number for API response
      if (data.totalAmount) data.totalAmount = parseFloat(data.totalAmount);
      if (data.tax) data.tax = data.tax ? parseFloat(data.tax) : null;
      if (data.shipping) data.shipping = data.shipping ? parseFloat(data.shipping) : null;
      if (data.discount) data.discount = data.discount ? parseFloat(data.discount) : null;

      // Convert order items
      if (data.orderItems) {
        data.orderItems = data.orderItems.map((item: any) => ({
          ...item,
          price: parseFloat(item.price),
          discount: item.discount ? parseFloat(item.discount) : null,
          total: parseFloat(item.total),
        }));
      }

      return data;
    },
  },
  permissions: {
    create: ['ADMIN', 'MANAGER', 'USER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  hooks: {
    beforeCreate: async (data: any) => {
      // Generate order number
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      data.orderNumber = `ORD-${year}${month}${day}-${random}`;

      // Validate products and calculate totals
      let subtotal = 0;
      const validatedItems = [];

      for (const item of data.items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
        }

        const itemTotal = (parseFloat(item.price.toString()) * item.quantity) -
          (item.discount ? parseFloat(item.discount.toString()) : 0);

        validatedItems.push({
          ...item,
          price: String(item.price),
          discount: item.discount ? String(item.discount) : null,
          total: String(itemTotal),
        });

        subtotal += itemTotal;
      }

      // Calculate total
      const tax = data.tax ? parseFloat(data.tax.toString()) : 0;
      const shipping = data.shipping ? parseFloat(data.shipping.toString()) : 0;
      const discount = data.discount ? parseFloat(data.discount.toString()) : 0;

      data.totalAmount = String(subtotal + tax + shipping - discount);

      // Replace items with validated items
      data.orderItems = {
        create: validatedItems,
      };
      delete data.items;

      return data;
    },
    afterCreate: async (order: any, userId?: string, requestContext?: any) => {
      // Update product quantities and create stock movements
      for (const item of order.orderItems) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (product) {
          const newQuantity = product.quantity - item.quantity;

          await prisma.product.update({
            where: { id: item.productId },
            data: {
              quantity: newQuantity,
              status: newQuantity === 0 ? 'OUT_OF_STOCK' : product.status,
            },
          });

          await prisma.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'SALE',
              quantity: item.quantity,
              previousQty: product.quantity,
              currentQty: newQuantity,
              reference: order.orderNumber,
              notes: `Sold in order ${order.orderNumber}`,
            },
          });
        }
      }

      // Log order creation with request context
      if (requestContext) {
        await requestContext.logActivity({
          userId: order.userId,
          action: 'CREATED',
          entity: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            itemCount: order.orderItems.length,
          },
        });
      }
    },
    beforeUpdate: async (id: string, data: any) => {
      // Handle status transitions
      if (data.status) {
        const order = await prisma.order.findUnique({
          where: { id },
          select: { status: true, orderNumber: true, userId: true },
        });

        if (!order) throw new Error('Order not found');

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
          'PENDING': ['CONFIRMED', 'CANCELLED'],
          'CONFIRMED': ['PROCESSING', 'CANCELLED'],
          'PROCESSING': ['SHIPPED', 'CANCELLED'],
          'SHIPPED': ['DELIVERED', 'CANCELLED'],
          'DELIVERED': ['REFUNDED'],
          'CANCELLED': ['REFUNDED'],
          'REFUNDED': [],
        };

        if (!validTransitions[order.status]?.includes(data.status)) {
          throw new Error(`Invalid status transition from ${order.status} to ${data.status}`);
        }

        // Handle cancellation - restore stock
        if (data.status === 'CANCELLED' && order.status !== 'CANCELLED') {
          const orderWithItems = await prisma.order.findUnique({
            where: { id },
            include: { orderItems: true },
          });

          if (orderWithItems) {
            for (const item of orderWithItems.orderItems) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
              });

              if (product) {
                const newQuantity = product.quantity + item.quantity;

                await prisma.product.update({
                  where: { id: item.productId },
                  data: {
                    quantity: newQuantity,
                    status: product.status === 'OUT_OF_STOCK' ? 'ACTIVE' : product.status,
                  },
                });

                await prisma.stockMovement.create({
                  data: {
                    productId: item.productId,
                    type: 'RETURN',
                    quantity: item.quantity,
                    previousQty: product.quantity,
                    currentQty: newQuantity,
                    reference: order.orderNumber,
                    notes: `Order ${order.orderNumber} cancelled`,
                  },
                });
              }
            }
          }
        }

        // Store status change info for afterUpdate hook
        (data as any)._statusChanged = {
          orderNumber: order.orderNumber,
          userId: order.userId,
          previousStatus: order.status,
          newStatus: data.status,
        };
      }

      return data;
    },
    afterUpdate: async (order: any, userId?: string, requestContext?: any) => {
      // Log order update activity
      if (userId && requestContext) {
        // If status was changed, log specific status change
        if ((order as any)._statusChanged) {
          const change = (order as any)._statusChanged;
          await requestContext.logActivity({
            userId: change.userId,
            action: 'UPDATED',
            entity: 'Order',
            entityId: order.id,
            details: {
              orderNumber: change.orderNumber,
              previousStatus: change.previousStatus,
              newStatus: change.newStatus,
              changeType: 'STATUS_CHANGE',
            },
          });
        } else {
          // Regular update
          await requestContext.logActivity({
            userId,
            action: 'UPDATED',
            entity: 'Order',
            entityId: order.id,
            details: {
              orderNumber: order.orderNumber,
            },
          });
        }
      }
    },
    beforeDelete: async (id: string, userId?: string, requestContext?: any) => {
      // Log deletion activity before deletion
      if (userId && requestContext) {
        const order = await prisma.order.findUnique({ where: { id } });
        if (order) {
          await requestContext.logActivity({
            userId,
            action: 'DELETED',
            entity: 'Order',
            entityId: id,
            details: {
              orderNumber: order.orderNumber,
              totalAmount: order.totalAmount,
            },
          });
        }
      }
    },
  },
  relations: {
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              images: true,
            },
          },
        },
      },
    },
  },
  search: {
    fields: ['orderNumber', 'notes'],
    fuzzy: true,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  sorting: {
    defaultField: 'createdAt',
    defaultOrder: 'desc',
    allowedFields: ['orderNumber', 'totalAmount', 'status', 'createdAt', 'updatedAt'],
  },
  filters: {
    status: { type: 'exact' },
    userId: { type: 'exact' },
    dateFrom: { type: 'gte', field: 'createdAt' },
    dateTo: { type: 'lte', field: 'createdAt' },
    minAmount: { type: 'gte', field: 'totalAmount' },
    maxAmount: { type: 'lte', field: 'totalAmount' },
  },
};