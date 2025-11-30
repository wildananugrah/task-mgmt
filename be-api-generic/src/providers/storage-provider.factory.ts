/**
 * Storage Provider Factory
 * Creates the appropriate storage provider based on configuration
 * Supports both single and multi-provider modes
 */

import config, { isMultiProviderMode, getProviderCount } from '../config';
import logger from '../config/logger';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { MinioStorageProvider } from './minio-storage.provider';
import { AwsS3StorageProvider } from './aws-s3-storage.provider';
import { StoragePoolManager } from './storage-pool.manager';

export class StorageProviderFactory {
  private static instance: StorageProvider | null = null;

  /**
   * Get the configured storage provider instance
   * Automatically detects single vs multi-provider mode
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
    // Check if multi-provider mode is enabled
    if (isMultiProviderMode()) {
      const count = getProviderCount();
      logger.info(`Initializing storage pool with ${count} provider(s)`);
      return new StoragePoolManager();
    }

    // Single provider mode (backward compatible)
    const provider = config.STORAGE_PROVIDER || 'minio';
    logger.info(`Initializing single storage provider: ${provider}`);

    switch (provider) {
      case 'minio':
        return new MinioStorageProvider();
      case 'aws':
        return new AwsS3StorageProvider();
      default:
        throw new Error(`Unknown storage provider: ${provider}. Supported providers: 'minio', 'aws'`);
    }
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

    if (isMultiProviderMode()) {
      logger.info(`Storage pool initialized with ${getProviderCount()} provider(s)`);
    } else {
      logger.info(`Storage provider '${config.STORAGE_PROVIDER || 'minio'}' initialized successfully`);
    }
  }

  /**
   * Reset the provider instance (useful for testing)
   */
  static resetProvider(): void {
    this.instance = null;
  }
}
