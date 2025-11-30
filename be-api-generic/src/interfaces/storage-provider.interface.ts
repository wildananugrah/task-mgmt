/**
 * Storage Provider Interface
 * Abstraction layer for different storage backends (MinIO, AWS S3, etc.)
 */

export interface UploadOptions {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  size: number;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimetype: string;
}

export interface DownloadResult {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export interface StorageProvider {
  /**
   * Initialize the storage provider (create bucket, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Upload a file to storage
   */
  uploadFile(options: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  downloadFile(key: string): Promise<DownloadResult>;

  /**
   * Delete a file from storage
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Check if a file exists
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getFileMetadata(key: string): Promise<{ size: number; mimetype: string; lastModified: Date }>;

  /**
   * Copy a file within the storage
   */
  copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult>;

  /**
   * List files with optional prefix
   */
  listFiles(prefix?: string): Promise<string[]>;
}
