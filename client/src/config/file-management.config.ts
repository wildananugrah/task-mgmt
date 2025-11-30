// File Management Configuration
// Configure roles, permissions, and features for the file management system

export interface FileManagementPermissions {
  upload: string[]; // Roles that can upload files
  view: string[]; // Roles that can view files
  download: string[]; // Roles that can download files
  delete: string[]; // Roles that can delete files
  viewAll: string[]; // Roles that can view all users' files (not just their own)
  manageAll: string[]; // Roles that can manage all files (delete any file)
}

export interface FileTypeConfig {
  extensions: string[];
  mimeTypes: string[];
  icon: string;
  color: string;
  previewable: boolean;
}

export interface FolderConfig {
  name: string;
  path: string;
  description?: string;
  icon?: string;
  defaultPublic?: boolean;
  allowedRoles?: string[]; // Roles that can upload to this folder
}

export interface FileManagementConfig {
  permissions: FileManagementPermissions;
  maxFileSize: number; // in bytes
  allowedFileTypes: FileTypeConfig[];
  folders: FolderConfig[];
  features: {
    enablePreview: boolean;
    enableFolderOrganization: boolean;
    enableSearch: boolean;
    enableFilters: boolean;
    enableBulkOperations: boolean;
    enableFileSharing: boolean;
    showFileMetadata: boolean;
  };
  ui: {
    viewModes: ('grid' | 'list')[];
    defaultViewMode: 'grid' | 'list';
    thumbnailSize: 'small' | 'medium' | 'large';
    itemsPerPage: number;
  };
}

// File type configurations
export const fileTypeConfigs: Record<string, FileTypeConfig> = {
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
    icon: 'Image',
    color: '#10b981', // green
    previewable: true,
  },
  document: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
    ],
    icon: 'FileText',
    color: '#3b82f6', // blue
    previewable: false,
  },
  spreadsheet: {
    extensions: ['.xls', '.xlsx', '.csv'],
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    icon: 'FileSpreadsheet',
    color: '#059669', // emerald
    previewable: false,
  },
  video: {
    extensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
    icon: 'Video',
    color: '#8b5cf6', // purple
    previewable: true,
  },
  audio: {
    extensions: ['.mp3', '.wav', '.ogg', '.m4a'],
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
    icon: 'Music',
    color: '#f59e0b', // amber
    previewable: true,
  },
  archive: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    mimeTypes: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
    ],
    icon: 'Archive',
    color: '#6b7280', // gray
    previewable: false,
  },
  code: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.py', '.java', '.cpp'],
    mimeTypes: [
      'application/javascript',
      'application/typescript',
      'application/json',
      'text/html',
      'text/css',
      'text/x-python',
      'text/x-java-source',
    ],
    icon: 'Code',
    color: '#ec4899', // pink
    previewable: false,
  },
  other: {
    extensions: [],
    mimeTypes: [],
    icon: 'File',
    color: '#64748b', // slate
    previewable: false,
  },
};

// Predefined folder structure
export const defaultFolders: FolderConfig[] = [
  {
    name: 'General',
    path: 'general',
    description: 'General purpose files',
    icon: 'Folder',
    defaultPublic: false,
  },
  {
    name: 'Article Covers',
    path: 'article-covers',
    description: 'Cover images for articles',
    icon: 'Image',
    defaultPublic: true,
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Product Images',
    path: 'product-images',
    description: 'Product catalog images',
    icon: 'Package',
    defaultPublic: true,
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Documents',
    path: 'documents',
    description: 'PDF and document files',
    icon: 'FileText',
    defaultPublic: false,
    allowedRoles: ['ADMIN', 'MANAGER', 'USER'],
  },
  {
    name: 'Downloads',
    path: 'downloads',
    description: 'Downloadable resources',
    icon: 'Download',
    defaultPublic: true,
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
  {
    name: 'Uploads',
    path: 'uploads',
    description: 'User uploaded files',
    icon: 'Upload',
    defaultPublic: false,
  },
  {
    name: 'Temp',
    path: 'temp',
    description: 'Temporary files',
    icon: 'Clock',
    defaultPublic: false,
  },
  {
    name: 'Book Covers',
    path: 'book-covers',
    description: 'Cover images for books',
    icon: 'BookOpen',
    defaultPublic: true,
    allowedRoles: ['ADMIN', 'MANAGER'],
  },
];

// Main file management configuration
export const fileManagementConfig: FileManagementConfig = {
  permissions: {
    upload: ['ADMIN', 'MANAGER', 'USER'], // All authenticated users can upload
    view: ['ADMIN', 'MANAGER', 'USER', 'CLIENT'], // All roles can view
    download: ['ADMIN', 'MANAGER', 'USER', 'CLIENT'], // All roles can download
    delete: ['ADMIN', 'MANAGER', 'USER'], // Users can delete their own files
    viewAll: ['ADMIN', 'MANAGER'], // Only admins and managers can view all files
    manageAll: ['ADMIN'], // Only admins can delete any file
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB (must match backend config)
  allowedFileTypes: Object.values(fileTypeConfigs),
  folders: defaultFolders,
  features: {
    enablePreview: true, // Enable file preview for images/videos
    enableFolderOrganization: true, // Enable folder-based organization
    enableSearch: true, // Enable search by filename
    enableFilters: true, // Enable filtering by type, date, etc.
    enableBulkOperations: true, // Enable selecting multiple files for bulk delete
    enableFileSharing: true, // Enable generating shareable links
    showFileMetadata: true, // Show file size, upload date, etc.
  },
  ui: {
    viewModes: ['grid', 'list'],
    defaultViewMode: 'grid',
    thumbnailSize: 'medium',
    itemsPerPage: 20,
  },
};

// Helper functions
export function canUserUpload(userRole: string, folder?: string): boolean {
  const canUpload = fileManagementConfig.permissions.upload.includes(userRole);

  if (!folder || !canUpload) {
    return canUpload;
  }

  const folderConfig = defaultFolders.find(f => f.path === folder);
  if (!folderConfig?.allowedRoles) {
    return canUpload;
  }

  return folderConfig.allowedRoles.includes(userRole);
}

export function canUserDelete(userRole: string, isOwner: boolean): boolean {
  // Admins can delete any file
  if (fileManagementConfig.permissions.manageAll.includes(userRole)) {
    return true;
  }

  // Users can delete their own files if they have delete permission
  return isOwner && fileManagementConfig.permissions.delete.includes(userRole);
}

export function canUserViewAll(userRole: string): boolean {
  return fileManagementConfig.permissions.viewAll.includes(userRole);
}

export function getFileTypeConfig(mimeType: string): FileTypeConfig {
  for (const config of Object.values(fileTypeConfigs)) {
    if (config.mimeTypes.includes(mimeType)) {
      return config;
    }
  }
  return fileTypeConfigs.other;
}

export function getFileTypeByExtension(filename: string): FileTypeConfig {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  for (const config of Object.values(fileTypeConfigs)) {
    if (config.extensions.includes(extension)) {
      return config;
    }
  }
  return fileTypeConfigs.other;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isFilePreviewable(mimeType: string): boolean {
  const typeConfig = getFileTypeConfig(mimeType);
  return typeConfig.previewable && fileManagementConfig.features.enablePreview;
}

export function getFolderByPath(path: string): FolderConfig | undefined {
  return defaultFolders.find(f => f.path === path);
}

export function getUserAllowedFolders(userRole: string): FolderConfig[] {
  return defaultFolders.filter(folder => {
    if (!folder.allowedRoles) return true;
    return folder.allowedRoles.includes(userRole);
  });
}
