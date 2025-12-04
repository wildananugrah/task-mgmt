/**
 * Storage Provider Factory
 * Creates the MinIO storage provider based on configuration
 */

import config from '../config';
import logger from '../config/logger';
import type { StorageProvider } from '../interfaces/storage-provider.interface';
import { MinioStorageProvider } from './minio-storage.provider';

export class StorageProviderFactory {
  private static instance: StorageProvider | null = null;

  /**
   * Get the configured storage provider instance
   */
  static getProvider(): StorageProvider {
    if (!config.ENABLE_FILE_STORAGE) {
      throw new Error('File storage is disabled. Set ENABLE_FILE_STORAGE=true in .env to enable file uploads.');
    }

    if (!this.instance) {
      this.instance = this.createProvider();
    }

    return this.instance;
  }

  /**
   * Create a new storage provider based on configuration
   */
  private static createProvider(): StorageProvider {
    logger.info('Initializing single storage provider: minio');
    return new MinioStorageProvider();
  }

  /**
   * Initialize the storage provider (create bucket, etc.)
   */
  static async initialize(): Promise<void> {
    if (!config.ENABLE_FILE_STORAGE) {
      logger.info('File storage is disabled (ENABLE_FILE_STORAGE=false)');
      return;
    }

    const provider = this.getProvider();
    await provider.initialize();
    logger.info(`Storage provider 'minio' initialized successfully`);
  }

  /**
   * Reset the provider instance (useful for testing)
   */
  static resetProvider(): void {
    this.instance = null;
  }
}
