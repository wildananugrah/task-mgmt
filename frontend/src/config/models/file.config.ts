import { ModelConfig } from "../models.config";

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