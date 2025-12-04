// Model configurations for automatic UI generation
// This mirrors the backend model configurations but for UI generation

import { z } from 'zod';
import { isFileStorageEnabled } from './features.config';
import { userConfig } from './models/user.config';
import { fileConfig } from './models/file.config';

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

// Export all model configurations
export const modelConfigs: Record<string, ModelConfig> = {
  user: userConfig,
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