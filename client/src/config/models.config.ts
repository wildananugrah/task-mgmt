// Model configurations for automatic UI generation
// This mirrors the backend model configurations but for UI generation

import { z } from 'zod';
import { isFileStorageEnabled } from './features.config';

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'date' | 'json' | 'array' | 'file' | 'decimal';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  // Relation field configuration - fetches options from API
  relation?: {
    model: string; // Model name to fetch from (e.g., 'category', 'user')
    valueField?: string; // Field to use as value (default: 'id')
    labelField?: string; // Field to use as label (default: 'name')
    labelFields?: string[]; // Multiple fields to combine for label (e.g., ['firstName', 'lastName'])
    // File picker configuration (only for file relations)
    filePicker?: {
      filterMimeTypes?: string[]; // e.g., ['image/*', 'application/pdf']
      filterFolders?: string[]; // e.g., ['article-covers', 'product-images']
      defaultUploadFolder?: string; // e.g., 'article-covers' - default folder for uploads
      showPreview?: boolean; // Show preview thumbnail
    };
  };
  min?: number;
  max?: number;
  rows?: number;
  multiple?: boolean;
  defaultValue?: any;
  validation?: z.ZodSchema;
  hidden?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  format?: (value: any) => string;
  parse?: (value: string) => any;
}

export interface ModelConfig {
  name: string;
  displayName: string;
  plural: string;
  icon?: string;
  fields: FieldConfig[];
  listFields?: string[]; // Fields to show in list view
  searchFields?: string[];
  filterFields?: string[];
  sortFields?: string[];
  permissions?: {
    create: string[];
    read: string[];
    update: string[];
    delete: string[];
  };
  // Menu configuration
  menu?: {
    group?: string; // Menu group name (e.g., 'Inventory', 'Content', 'System')
    order?: number; // Order within the group or global order
    hidden?: boolean; // Hide from menu
  };
}

// Product model configuration
export const productConfig: ModelConfig = {
  name: 'product',
  displayName: 'Product',
  plural: 'products',
  icon: 'Package',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'name', label: 'Product Name', type: 'text', required: true, searchable: true, sortable: true },
    { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
    { name: 'sku', label: 'SKU', type: 'text', required: true, searchable: true },
    { name: 'barcode', label: 'Barcode', type: 'text' },
    { name: 'price', label: 'Price', type: 'decimal', required: true, min: 0, sortable: true },
    { name: 'cost', label: 'Cost', type: 'decimal', min: 0 },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true, min: 0, defaultValue: 0, sortable: true },
    { name: 'minQuantity', label: 'Min Quantity', type: 'number', min: 0, defaultValue: 0 },
    { name: 'unit', label: 'Unit', type: 'text', defaultValue: 'piece' },
    { name: 'weight', label: 'Weight (kg)', type: 'decimal', min: 0 },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'ACTIVE',
      filterable: true,
      options: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
        { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
        { value: 'DISCONTINUED', label: 'Discontinued' }
      ]
    },
    { name: 'featured', label: 'Featured', type: 'checkbox', defaultValue: false, filterable: true },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      required: true,
      filterable: true,
      relation: { model: 'category', labelField: 'name' }
    },
    { name: 'images', label: 'Images', type: 'array' },
    { name: 'tags', label: 'Tags', type: 'array' },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true },
    { name: 'updatedAt', label: 'Updated At', type: 'date', readOnly: true }
  ],
  listFields: ['name', 'sku', 'price', 'quantity', 'status', 'featured'],
  searchFields: ['name', 'description', 'sku', 'barcode'],
  filterFields: ['status', 'featured', 'categoryId'],
  sortFields: ['name', 'price', 'quantity', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER', 'CLIENT'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'Inventory',
    order: 1
  }
};

// Category model configuration
export const categoryConfig: ModelConfig = {
  name: 'category',
  displayName: 'Category',
  plural: 'categories',
  icon: 'FolderTree',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'name', label: 'Name', type: 'text', required: true, searchable: true, sortable: true },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
    { name: 'slug', label: 'Slug', type: 'text', required: true },
    {
      name: 'parentId',
      label: 'Parent Category',
      type: 'select',
      relation: { model: 'category', labelField: 'name' }
    },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, filterable: true },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true }
  ],
  listFields: ['name', 'slug', 'isActive', 'createdAt'],
  searchFields: ['name', 'description', 'slug'],
  filterFields: ['isActive', 'parentId'],
  sortFields: ['name', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'Inventory',
    order: 2
  }
};

// User model configuration
export const userConfig: ModelConfig = {
  name: 'user',
  displayName: 'User',
  plural: 'users',
  icon: 'Users',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'email', label: 'Email', type: 'email', required: true, searchable: true },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'firstName', label: 'First Name', type: 'text', searchable: true },
    { name: 'lastName', label: 'Last Name', type: 'text', searchable: true },
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      required: true,
      defaultValue: 'USER',
      filterable: true,
      options: [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'MANAGER', label: 'Manager' },
        { value: 'USER', label: 'User' },
        { value: 'CLIENT', label: 'Client' }
      ]
    },
    { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true, filterable: true },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true }
  ],
  listFields: ['email', 'firstName', 'lastName', 'role', 'isActive'],
  searchFields: ['email', 'firstName', 'lastName'],
  filterFields: ['role', 'isActive'],
  sortFields: ['email', 'firstName', 'createdAt'],
  permissions: {
    create: ['ADMIN'],
    read: ['ADMIN', 'MANAGER'],
    update: ['ADMIN'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'System',
    order: 1
  }
};

// Order model configuration
export const orderConfig: ModelConfig = {
  name: 'order',
  displayName: 'Order',
  plural: 'orders',
  icon: 'ShoppingCart',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'orderNumber', label: 'Order Number', type: 'text', required: true, searchable: true },
    {
      name: 'userId',
      label: 'Customer',
      type: 'select',
      required: true,
      filterable: true,
      relation: { model: 'user', labelFields: ['firstName', 'lastName'] }
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      filterable: true,
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'SHIPPED', label: 'Shipped' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'CANCELLED', label: 'Cancelled' },
        { value: 'REFUNDED', label: 'Refunded' }
      ]
    },
    { name: 'totalAmount', label: 'Total Amount', type: 'decimal', required: true, sortable: true },
    { name: 'tax', label: 'Tax', type: 'decimal' },
    { name: 'shipping', label: 'Shipping', type: 'decimal' },
    { name: 'discount', label: 'Discount', type: 'decimal' },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
    { name: 'shippingInfo', label: 'Shipping Info', type: 'json' },
    { name: 'paymentInfo', label: 'Payment Info', type: 'json' },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true }
  ],
  listFields: ['orderNumber', 'status', 'totalAmount', 'createdAt'],
  searchFields: ['orderNumber', 'notes'],
  filterFields: ['status', 'userId'],
  sortFields: ['orderNumber', 'totalAmount', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER', 'USER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'Sales',
    order: 1
  }
};

// Article model configuration
export const articleConfig: ModelConfig = {
  name: 'article',
  displayName: 'Article',
  plural: 'articles',
  icon: 'FileText',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'title', label: 'Title', type: 'text', required: true, searchable: true, sortable: true },
    { name: 'content', label: 'Content', type: 'textarea', rows: 10, searchable: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true },
    { name: 'published', label: 'Published', type: 'checkbox', defaultValue: false, filterable: true },
    {
      name: 'authorId',
      label: 'Author',
      type: 'select',
      filterable: true,
      relation: { model: 'user', labelFields: ['firstName', 'lastName'] }
    },
    {
      name: 'fileId',
      label: 'Cover Image',
      type: 'select',
      filterable: true,
      relation: {
        model: 'file',
        labelField: 'originalName',
        // Custom metadata for file picker
        filePicker: {
          filterMimeTypes: ['image/*'],
          filterFolders: ['article-covers'],
          defaultUploadFolder: 'article-covers',
          showPreview: true,
        }
      }
    },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true }
  ],
  listFields: ['title', 'slug', 'published', 'createdAt'],
  searchFields: ['title', 'content'],
  filterFields: ['published', 'authorId'],
  sortFields: ['title', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'Content',
    order: 1
  }
};

// Book model configuration
export const bookConfig: ModelConfig = {
  name: 'book',
  displayName: 'Book',
  plural: 'books',
  icon: 'BookOpen',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'title', label: 'Title', type: 'text', required: true, searchable: true, sortable: true },
    { name: 'content', label: 'Content', type: 'textarea', rows: 10, searchable: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true },
    { name: 'published', label: 'Published', type: 'checkbox', defaultValue: false, filterable: true },
    {
      name: 'authorId',
      label: 'Author',
      type: 'select',
      filterable: true,
      relation: { model: 'user', labelFields: ['firstName', 'lastName'] }
    },
    { name: 'createdAt', label: 'Created At', type: 'date', readOnly: true, sortable: true }
  ],
  listFields: ['title', 'slug', 'published', 'createdAt'],
  searchFields: ['title', 'content'],
  filterFields: ['published', 'authorId'],
  sortFields: ['title', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN']
  },
  menu: {
    group: 'Content',
    order: 2
  }
};

// File model configuration
export const fileConfig: ModelConfig = {
  name: 'file',
  displayName: 'File',
  plural: 'files',
  icon: 'FolderOpen',
  fields: [
    { name: 'id', label: 'ID', type: 'text', hidden: true },
    { name: 'originalName', label: 'File Name', type: 'text', required: true, searchable: true, sortable: true },
    { name: 'storedName', label: 'Stored Name', type: 'text', readOnly: true, hidden: true },
    { name: 'mimeType', label: 'Type', type: 'text', readOnly: true, filterable: true },
    {
      name: 'size',
      label: 'Size',
      type: 'number',
      readOnly: true,
      sortable: true,
      format: (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
      }
    },
    { name: 'folder', label: 'Folder', type: 'text', filterable: true, sortable: true },
    { name: 'isPublic', label: 'Public', type: 'checkbox', defaultValue: false, filterable: true },
    { name: 'path', label: 'Path', type: 'text', readOnly: true, hidden: true },
    { name: 'url', label: 'URL', type: 'text', readOnly: true },
    {
      name: 'uploadedById',
      label: 'Uploaded By',
      type: 'select',
      readOnly: true,
      filterable: true,
      relation: { model: 'user', labelFields: ['firstName', 'lastName'] }
    },
    { name: 'createdAt', label: 'Uploaded At', type: 'date', readOnly: true, sortable: true },
    { name: 'updatedAt', label: 'Updated At', type: 'date', readOnly: true, hidden: true }
  ],
  listFields: ['originalName', 'mimeType', 'size', 'folder', 'isPublic', 'createdAt'],
  searchFields: ['originalName', 'folder'],
  filterFields: ['mimeType', 'folder', 'isPublic', 'uploadedById'],
  sortFields: ['originalName', 'size', 'createdAt'],
  permissions: {
    create: ['ADMIN', 'MANAGER', 'USER'],
    read: ['ADMIN', 'MANAGER', 'USER', 'CLIENT'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN', 'MANAGER', 'USER']
  },
  menu: {
    group: 'Media',
    order: 1
  }
};

// Export all model configurations
export const modelConfigs: Record<string, ModelConfig> = {
  product: productConfig,
  category: categoryConfig,
  user: userConfig,
  order: orderConfig,
  article: articleConfig,
  book: bookConfig,
  // Only include file model if file storage is enabled
  ...(isFileStorageEnabled() ? { file: fileConfig } : {})
};

// Get models accessible to a user based on their role
export function getAccessibleModels(userRole: string): ModelConfig[] {
  return Object.values(modelConfigs).filter(config =>
    config.permissions?.read.includes(userRole) ?? true
  );
}

// Get model by name
export function getModelConfig(modelName: string): ModelConfig | undefined {
  return modelConfigs[modelName];
}