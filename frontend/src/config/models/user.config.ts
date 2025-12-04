import { ModelConfig } from "../models.config";

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