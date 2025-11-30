import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Search,
  Grid,
  List,
  Folder,
  File,
  Image,
  FileText,
  Video,
  Music,
  Archive,
  Code,
  X,
  Check,
} from 'lucide-react';
import Modal from './Modal';
import { useNotification } from './Notification';
import { useAuthStore } from '../stores/auth.store';
import { apiClient } from '../lib/api-client';
import {
  getFileTypeByExtension,
  formatFileSize,
  getUserAllowedFolders,
} from '../config/file-management.config';

interface FileItem {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url: string;
  isPublic: boolean;
  userId: string | null;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface FilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (file: FileItem) => void;
  selectedFileId?: string;
  filterMimeTypes?: string[]; // e.g., ['image/jpeg', 'image/png']
  filterFolders?: string[]; // e.g., ['article-covers']
  title?: string;
  defaultUploadFolder?: string; // e.g., 'article-covers'
}

// Helper to extract folder from key
function getFolderFromKey(key: string): string {
  const parts = key.split('/');
  if (parts.length > 1 && parts[0] === 'public') {
    return parts[1] || 'general';
  }
  return parts[0] || 'general';
}

export function FilePicker({
  isOpen,
  onClose,
  onSelect,
  selectedFileId,
  filterMimeTypes,
  filterFolders,
  title = 'Select File',
  defaultUploadFolder,
}: FilePickerProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { notify } = useNotification();

  const userRole = user?.role || '';
  const allowedFolders = getUserAllowedFolders(userRole);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFolder, setUploadFolder] = useState(
    defaultUploadFolder && allowedFolders.some(f => f.path === defaultUploadFolder)
      ? defaultUploadFolder
      : allowedFolders[0]?.path || 'general'
  );
  const isPublic = true; // Always public - no longer user-configurable
  const [tempSelectedFile, setTempSelectedFile] = useState<FileItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch files
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['files-picker', searchTerm],
    queryFn: async () => {
      const params: any = {
        limit: 100,
        offset: 0,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await apiClient.get('/files', { params });

      return {
        files: response.data.files || [],
        total: response.data.total || 0,
      };
    },
    enabled: isOpen,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const response = await apiClient.post(
        `/files/upload-multiple?folder=${uploadFolder}&isPublic=${isPublic}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
    onSuccess: (data) => {
      notify('Files uploaded successfully', { type: 'success' });
      setShowUpload(false);
      queryClient.invalidateQueries({ queryKey: ['files-picker'] });
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Auto-select the first uploaded file
      if (data.files && data.files.length > 0) {
        onSelect(data.files[0]);
        onClose();
      }
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || error.message || 'Upload failed', { type: 'error' });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadMutation.mutate(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    const typeConfig = getFileTypeByExtension(fileName);
    const iconMap: Record<string, React.ReactNode> = {
      Image: <Image className="w-5 h-5" />,
      FileText: <FileText className="w-5 h-5" />,
      Video: <Video className="w-5 h-5" />,
      Music: <Music className="w-5 h-5" />,
      Archive: <Archive className="w-5 h-5" />,
      Code: <Code className="w-5 h-5" />,
      File: <File className="w-5 h-5" />,
    };
    return iconMap[typeConfig.icon] || <File className="w-5 h-5" />;
  };

  // Filter files
  let files = filesData?.files || [];

  // Filter by folder
  if (selectedFolder || filterFolders) {
    files = files.filter((file: FileItem) => {
      const fileFolder = getFolderFromKey(file.key);
      if (selectedFolder) {
        return fileFolder === selectedFolder;
      }
      if (filterFolders && filterFolders.length > 0) {
        return filterFolders.includes(fileFolder);
      }
      return true;
    });
  }

  // Filter by MIME type
  if (filterMimeTypes && filterMimeTypes.length > 0) {
    files = files.filter((file: FileItem) =>
      filterMimeTypes.some((type) => file.mimeType.startsWith(type.replace('/*', '')))
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          </div>

          {/* Folder filter */}
          {!filterFolders && (
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">All Folders</option>
              {allowedFolders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.name}
                </option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
            <button
              onClick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('grid')
              }}
              className={`p-1.5 rounded ${viewMode === 'grid'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('list')
              }}
              className={`p-1.5 rounded ${viewMode === 'list'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Upload button */}
          <button
            onClick={(e: any) => {
              e.preventDefault();
              e.stopPropagation();
              setShowUpload(!showUpload);
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* Upload section */}
        {showUpload && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900"
              >
                {allowedFolders.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-300 hover:border-gray-400'
                }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Click to select files or drag and drop</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {uploadMutation.isPending && (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-sm text-gray-600">Uploading...</span>
              </div>
            )}
          </div>
        )}

        {/* Files list */}
        <div className="max-h-96 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Folder className="w-12 h-12 mb-3" />
              <p className="text-sm">No files found</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {files.map((file: FileItem) => (
                <FileGridItem
                  key={file.id}
                  file={file}
                  isSelected={tempSelectedFile?.id === file.id || file.id === selectedFileId}
                  onSelect={() => setTempSelectedFile(file)}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file: FileItem) => (
                <FileListItem
                  key={file.id}
                  file={file}
                  isSelected={tempSelectedFile?.id === file.id || file.id === selectedFileId}
                  onSelect={() => setTempSelectedFile(file)}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          )}
        </div>

        {/* Confirmation footer */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (tempSelectedFile) {
                onSelect(tempSelectedFile);
                onClose();
              }
            }}
            disabled={!tempSelectedFile}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${tempSelectedFile
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Grid item component
function FileGridItem({
  file,
  isSelected,
  onSelect,
  getFileIcon,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  getFileIcon: (mimeType: string, fileName: string) => React.ReactNode;
}) {
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div
      onClick={onSelect}
      className={`relative group border rounded-lg p-2 cursor-pointer hover:shadow-md transition-all ${isSelected ? 'ring-2 ring-gray-900 border-gray-900 bg-gray-50' : 'border-gray-200'
        }`}
    >
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 bg-gray-900 text-white rounded-full p-1">
          <Check className="w-3 h-3" />
        </div>
      )}

      <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
        {isImage ? (
          <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400">{getFileIcon(file.mimeType, file.originalName)}</div>
        )}
      </div>

      <p className="text-xs font-medium text-gray-900 truncate" title={file.originalName}>
        {file.originalName}
      </p>
      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
    </div>
  );
}

// List item component
function FileListItem({
  file,
  isSelected,
  onSelect,
  getFileIcon,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  getFileIcon: (mimeType: string, fileName: string) => React.ReactNode;
}) {
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-100 ring-1 ring-gray-900' : ''
        }`}
    >
      {isSelected && (
        <div className="bg-gray-900 text-white rounded-full p-1">
          <Check className="w-3 h-3" />
        </div>
      )}

      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
        {isImage ? (
          <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400">{getFileIcon(file.mimeType, file.originalName)}</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}
