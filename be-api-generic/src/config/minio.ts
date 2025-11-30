/**
 * Storage initialization module
 * Replaces MinIO-specific initialization with storage provider abstraction
 */

import config from './index';
import logger from './logger';
import { StorageProviderFactory } from '../providers/storage-provider.factory';

/**
 * Initialize storage provider (MinIO, AWS S3, etc.)
 * This replaces the old MinIO-specific initialization
 */
export async function initializeStorage(): Promise<void> {
  // Skip initialization if file storage is disabled
  if (!config.ENABLE_FILE_STORAGE) {
    logger.info('File storage is disabled (ENABLE_FILE_STORAGE=false)');
    return;
  }

  try {
    await StorageProviderFactory.initialize();
    logger.info(`Storage provider '${config.STORAGE_PROVIDER}' initialized successfully`);
  } catch (error) {
    logger.error(`Failed to initialize storage provider '${config.STORAGE_PROVIDER}':`, error);
    throw error;
  }
}

// Export for backward compatibility (will be removed in future versions)
export { initializeStorage as initializeMinIO };
