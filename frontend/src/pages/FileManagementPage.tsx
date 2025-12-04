import React, { useState, useCallback, useRef } from 'react';
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
  Download,
  Trash2,
  Eye,
  RefreshCw,
  X,
  FolderOpen,
  Edit,
} from 'lucide-react';
import { useNotification } from '../components/Notification';
import Modal from '../components/Modal';
import { useAuthStore } from '../stores/auth.store';
import { apiClient } from '../lib/api-client';
import {
  fileManagementConfig,
  canUserUpload,
  canUserDelete,
  canUserViewAll,
  getFileTypeByExtension,
  formatFileSize,
  isFilePreviewable,
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

// Helper to extract folder from key (e.g., "public/article-covers/file.jpg" -> "article-covers")
function getFolderFromKey(key: string): string {
  const parts = key.split('/');
  if (parts.length > 1 && parts[0] === 'public') {
    return parts[1] || 'general';
  }
  return parts[0] || 'general';
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function FileManagementPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { notify } = useNotification();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    fileManagementConfig.ui.defaultViewMode
  );
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('general');
  const isPublic = true; // Always public - no longer user-configurable
  const [isDragging, setIsDragging] = useState(false);
  const [editFile, setEditFile] = useState<FileItem | null>(null);
  const [editFolder, setEditFolder] = useState('general');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userRole = user?.role || '';
  const allowedFolders = getUserAllowedFolders(userRole);

  // Fetch files
  const { data: filesData, isLoading, refetch } = useQuery({
    queryKey: ['files', selectedFolder, searchTerm],
    queryFn: async () => {
      const params: any = {
        limit: 100,
        offset: 0,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await apiClient.get('/files', { params });

      // Files endpoint returns: { files: [...], total, limit, offset }
      // Different from generic model API which returns: { data: [...], pagination: {...} }
      return {
        files: response.data.files || [],
        total: response.data.total || 0,
        limit: response.data.limit || 100,
        offset: response.data.offset || 0,
      };
    },
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
    onSuccess: () => {
      notify('Files uploaded successfully', { type: 'success' });
      setShowUploadModal(false);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || error.message || 'Upload failed', { type: 'error' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiClient.delete(`/files/${fileId}`);
      return response.data;
    },
    onSuccess: () => {
      notify('File deleted successfully', { type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || error.message || 'Delete failed', { type: 'error' });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      await Promise.all(
        fileIds.map((id) => apiClient.delete(`/files/${id}`))
      );
    },
    onSuccess: () => {
      notify('Files deleted successfully', { type: 'success' });
      setSelectedFiles(new Set());
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || error.message || 'Bulk delete failed', { type: 'error' });
    },
  });

  // Edit file mutation
  const editFileMutation = useMutation({
    mutationFn: async ({ fileId, updates }: { fileId: string; updates: { folder?: string; isPublic?: boolean } }) => {
      const response = await apiClient.patch(`/files/${fileId}`, updates);
      return response.data;
    },
    onSuccess: (updatedFile) => {
      notify('File updated successfully', { type: 'success' });
      setEditFile(null);

      // If the preview modal is open for this file, update it with the new data
      if (previewFile && previewFile.id === updatedFile.id) {
        setPreviewFile(updatedFile);
      }

      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error: any) => {
      notify(error.response?.data?.message || error.message || 'Update failed', { type: 'error' });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setPendingFiles(filesArray);
      setShowPreview(true);
      setShowUploadModal(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setPendingFiles(filesArray);
      setShowPreview(true);
      setShowUploadModal(false);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = (file: FileItem) => {
    if (canUserDelete(userRole, file.userId === user?.id)) {
      if (window.confirm(`Delete ${file.originalName}?`)) {
        deleteMutation.mutate(file.id);
      }
    } else {
      notify('You do not have permission to delete this file', { type: 'error' });
    }
  };

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) return;

    if (window.confirm(`Delete ${selectedFiles.size} file(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedFiles));
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === files.length) {
      // Deselect all if all are selected
      setSelectedFiles(new Set());
    } else {
      // Select all visible files
      const allFileIds = files.map((file: FileItem) => file.id);
      setSelectedFiles(new Set(allFileIds));
    }
  };

  const handleEditFile = (file: FileItem) => {
    setEditFile(file);
    setEditFolder(getFolderFromKey(file.key));
  };

  const handleSaveEdit = () => {
    if (!editFile) return;

    const updates: { folder?: string } = {};

    const currentFolder = getFolderFromKey(editFile.key);
    if (editFolder !== currentFolder) {
      updates.folder = editFolder;
    }

    if (Object.keys(updates).length > 0) {
      editFileMutation.mutate({ fileId: editFile.id, updates });
    } else {
      setEditFile(null);
    }
  };

  const handleConfirmUpload = () => {
    if (pendingFiles.length === 0) return;

    const fileList = new DataTransfer();
    pendingFiles.forEach((file) => fileList.items.add(file));

    uploadMutation.mutate(fileList.files);
    setShowPreview(false);
    setPendingFiles([]);
  };

  const handleCancelUpload = () => {
    setShowPreview(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(newFiles);
    if (newFiles.length === 0) {
      setShowPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  // Filter files by folder on the client side
  let files = filesData?.files || [];
  if (selectedFolder) {
    files = files.filter((file: FileItem) => getFolderFromKey(file.key) === selectedFolder);
  }

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 p-10 rounded-xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FolderOpen className="w-7 h-7" />
          File Management
        </h1>
        <p className="text-gray-600">Upload and manage your files</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>

        {/* Folder filter */}
        {fileManagementConfig.features.enableFolderOrganization && (
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
        <div className="flex gap-2 border border-gray-300 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${
              viewMode === 'grid'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              viewMode === 'list'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {fileManagementConfig.features.enableBulkOperations && files.length > 0 && (
            <button
              onClick={selectAllFiles}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              {selectedFiles.size === files.length && files.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}

          {selectedFiles.size > 0 && fileManagementConfig.features.enableBulkOperations && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedFiles.size})
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canUserUpload(userRole) && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          )}
        </div>
      </div>

      {/* Files Grid/List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Folder className="w-16 h-16 mb-4" />
            <p>No files found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {files.map((file: FileItem) => (
              <FileGridItem
                key={file.id}
                file={file}
                isSelected={selectedFiles.has(file.id)}
                onSelect={() => toggleFileSelection(file.id)}
                onPreview={() => setPreviewFile(file)}
                onEdit={() => handleEditFile(file)}
                onDelete={() => handleDelete(file)}
                canDelete={canUserDelete(userRole, file.userId === user?.id)}
                getFileIcon={getFileIcon}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {fileManagementConfig.features.enableBulkOperations && (
                    <th className="w-12 px-4 py-3"></th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file: FileItem) => (
                  <FileListItem
                    key={file.id}
                    file={file}
                    isSelected={selectedFiles.has(file.id)}
                    onSelect={() => toggleFileSelection(file.id)}
                    onPreview={() => setPreviewFile(file)}
                    onEdit={() => handleEditFile(file)}
                    onDelete={() => handleDelete(file)}
                    canDelete={canUserDelete(userRole, file.userId === user?.id)}
                    getFileIcon={getFileIcon}
                    enableBulkOperations={fileManagementConfig.features.enableBulkOperations}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Files"
        size="md"
      >
        <div className="space-y-4">
          {/* Folder selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder
            </label>
            <select
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              {allowedFolders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.name} - {folder.description}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">Drag and drop files here</p>
            <p className="text-sm text-gray-500 mb-4">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-4">
              Max file size: {formatFileSize(fileManagementConfig.maxFileSize)}
            </p>
          </div>

          {uploadMutation.isPending && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-600">Uploading...</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Edit File Modal */}
      {editFile && (
        <Modal
          isOpen={true}
          onClose={() => setEditFile(null)}
          title="Edit File Properties"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File Name
              </label>
              <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                {editFile.originalName}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Location
              </label>
              <select
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {allowedFolders.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    {folder.name} - {folder.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={() => setEditFile(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editFileMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {editFileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Preview Modal */}
      {showPreview && (
        <Modal
          isOpen={true}
          onClose={handleCancelUpload}
          title={`Preview ${pendingFiles.length} File${pendingFiles.length > 1 ? 's' : ''}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Upload settings */}
            <div className="pb-4 border-b">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder
                </label>
                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {allowedFolders.map((folder) => (
                    <option key={folder.path} value={folder.path}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* File previews */}
            <div className="max-h-96 overflow-y-auto space-y-3">
              {pendingFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                      />
                    ) : (
                      <div className="text-gray-400">
                        {getFileIcon(file.type, file.name)}
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <button
                onClick={handleCancelUpload}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={uploadMutation.isPending || pendingFiles.length === 0}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadMutation.isPending ? 'Uploading...' : `Upload ${pendingFiles.length} File${pendingFiles.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// File Grid Item Component
function FileGridItem({
  file,
  isSelected,
  onSelect,
  onPreview,
  onDelete,
  onEdit,
  canDelete,
  getFileIcon,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onEdit: () => void;
  canDelete: boolean;
  getFileIcon: (mimeType: string, fileName: string) => React.ReactNode;
}) {
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div
      className={`relative group border rounded-lg p-3 hover:shadow-lg transition-shadow cursor-pointer ${
        isSelected ? 'ring-2 ring-gray-900 border-gray-900' : 'border-gray-200'
      }`}
      onClick={onPreview}
    >
      {fileManagementConfig.features.enableBulkOperations && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
          />
        </div>
      )}

      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
        {isImage && fileManagementConfig.features.enablePreview ? (
          <img
            src={file.url}
            alt={file.originalName}
            className="w-full h-full object-cover"
            key={`${file.id}-${file.updatedAt}`}
          />
        ) : (
          <div className="text-gray-400">{getFileIcon(file.mimeType, file.originalName)}</div>
        )}
      </div>

      <p className="text-sm font-medium text-gray-900 truncate" title={file.originalName}>
        {file.originalName}
      </p>
      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>

      {/* Actions on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 bg-white rounded shadow hover:bg-blue-50"
          title="Edit"
        >
          <Edit className="w-4 h-4 text-blue-600" />
        </button>
        <a
          href={`${API_BASE_URL}/api/files/${file.id}/download`}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Download"
        >
          <Download className="w-4 h-4 text-gray-700" />
        </a>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 bg-white rounded shadow hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        )}
      </div>
    </div>
  );
}

// File List Item Component
function FileListItem({
  file,
  isSelected,
  onSelect,
  onPreview,
  onDelete,
  onEdit,
  canDelete,
  getFileIcon,
  enableBulkOperations,
}: {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onEdit: () => void;
  canDelete: boolean;
  getFileIcon: (mimeType: string, fileName: string) => React.ReactNode;
  enableBulkOperations: boolean;
}) {
  return (
    <tr className="hover:bg-gray-50">
      {enableBulkOperations && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
          />
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-gray-400">{getFileIcon(file.mimeType, file.originalName)}</div>
          <span className="text-sm text-gray-900">{file.originalName}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{file.mimeType}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{formatFileSize(file.size)}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{getFolderFromKey(file.key)}</td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {new Date(file.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onPreview}
            className="p-1.5 text-gray-600 hover:text-gray-900"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-blue-600 hover:text-blue-700"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <a
            href={`${API_BASE_URL}/api/files/${file.id}/download`}
            className="p-1.5 text-gray-600 hover:text-gray-900"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-red-600 hover:text-red-700"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// File Preview Modal Component
function FilePreviewModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const canPreview = isFilePreviewable(file.mimeType);

  return (
    <Modal isOpen={true} onClose={onClose} title={file.originalName} size="xl">
      <div className="space-y-4">
        {/* Preview */}
        {canPreview ? (
          <div className="bg-gray-100 rounded-lg flex items-center justify-center min-h-[400px]">
            {isImage && (
              <img
                src={file.url}
                alt={file.originalName}
                className="max-w-full max-h-[600px]"
                key={`preview-${file.id}-${file.updatedAt}`}
              />
            )}
            {isVideo && (
              <video
                src={file.url}
                controls
                className="max-w-full max-h-[600px]"
                key={`preview-${file.id}-${file.updatedAt}`}
              >
                Your browser does not support video playback.
              </video>
            )}
            {isAudio && (
              <audio
                src={file.url}
                controls
                className="w-full"
                key={`preview-${file.id}-${file.updatedAt}`}
              >
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-12 text-center">
            <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Preview not available for this file type</p>
          </div>
        )}

        {/* File Info */}
        {fileManagementConfig.features.showFileMetadata && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">File Name</p>
              <p className="text-sm font-medium">{file.originalName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Type</p>
              <p className="text-sm font-medium">{file.mimeType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Size</p>
              <p className="text-sm font-medium">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm font-medium">{getFolderFromKey(file.key)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Uploaded</p>
              <p className="text-sm font-medium">
                {new Date(file.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Public</p>
              <p className="text-sm font-medium">{file.isPublic ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <a
            href={`${API_BASE_URL}/api/files/${file.id}/download`}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
