/**
 * Storage Pool Manager
 * Manages multiple storage providers with round-robin distribution and health checks
 */

import config, { getStorageProviders } from '../config';
import logger from '../config/logger';
import { StorageProvider } from '../interfaces/storage-provider.interface';
import { MinioStorageProvider } from './minio-storage.provider';
import { AwsS3StorageProvider } from './aws-s3-storage.provider';
import type {
  UploadOptions,
  UploadResult,
  DownloadResult,
} from '../interfaces/storage-provider.interface';

interface ProviderConfig {
  id: string;
  type: 'minio' | 'aws' | 'gcs';
  name?: string;

  // Common
  bucket?: string;

  // MinIO specific
  endpoint?: string;
  port?: number;
  useSSL?: boolean;
  accessKey?: string;
  secretKey?: string;
  region?: string;

  // AWS specific
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsBucket?: string;
}

interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
}

export interface UploadResultWithProvider extends UploadResult {
  providerId?: string;
}

export class StoragePoolManager implements StorageProvider {
  private providers: Map<string, StorageProvider> = new Map();
  private providerList: string[] = [];
  private currentIndex: number = 0;
  private healthStatus: Map<string, HealthStatus> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeProviders();

    // Only start health monitoring if more than 1 provider
    if (this.providers.size > 1) {
      this.startHealthMonitoring();
    }
  }

  private initializeProviders(): void {
    const providerIds = getStorageProviders();

    if (providerIds.length === 0) {
      throw new Error('No storage providers configured in STORAGE_PROVIDERS');
    }

    for (const providerId of providerIds) {
      try {
        const provider = this.createProviderFromEnv(providerId);
        if (provider) {
          this.providers.set(providerId, provider);
          this.providerList.push(providerId);

          // Initialize health status
          this.healthStatus.set(providerId, {
            isHealthy: true,
            lastCheck: new Date(),
            consecutiveFailures: 0,
          });
        }
      } catch (error) {
        logger.error(`Failed to initialize provider ${providerId}:`, error);
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No valid storage providers could be initialized');
    }

    logger.info(`Storage Pool: Initialized ${this.providers.size} provider(s)`);
  }

  private createProviderFromEnv(providerId: string): StorageProvider | null {
    const prefix = providerId.toUpperCase().replace(/-/g, '_');

    // Read provider type
    const type = process.env[`${prefix}_TYPE`]?.toLowerCase();

    if (!type) {
      logger.warn(`No TYPE configured for provider ${providerId}`);
      return null;
    }

    // Read provider configuration
    const config: ProviderConfig = {
      id: providerId,
      type: type as 'minio' | 'aws' | 'gcs',
      name: process.env[`${prefix}_NAME`] || providerId,
    };

    // Read common fields
    config.bucket = process.env[`${prefix}_BUCKET`];

    // Read provider-specific fields
    switch (type) {
      case 'minio':
        config.endpoint = process.env[`${prefix}_ENDPOINT`];
        config.port = process.env[`${prefix}_PORT`] ? Number(process.env[`${prefix}_PORT`]) : undefined;
        config.useSSL = process.env[`${prefix}_USE_SSL`] === 'true';
        config.accessKey = process.env[`${prefix}_ACCESS_KEY`];
        config.secretKey = process.env[`${prefix}_SECRET_KEY`];
        config.region = process.env[`${prefix}_REGION`];
        break;

      case 'aws':
        config.awsRegion = process.env[`${prefix}_REGION`];
        config.awsAccessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`];
        config.awsSecretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`];
        config.awsBucket = process.env[`${prefix}_BUCKET`];
        break;

      case 'gcs':
        // Google Cloud Storage config would go here
        logger.warn('Google Cloud Storage provider not yet implemented');
        return null;

      default:
        logger.error(`Unknown provider type: ${type}`);
        return null;
    }

    return this.createProvider(config);
  }

  private createProvider(config: ProviderConfig): StorageProvider {
    switch (config.type) {
      case 'minio':
        // Create a temporary config object for MinIO provider
        const minioConfig = {
          MINIO_ENDPOINT: config.endpoint,
          MINIO_PORT: config.port,
          MINIO_USE_SSL: config.useSSL,
          MINIO_ACCESS_KEY: config.accessKey,
          MINIO_SECRET_KEY: config.secretKey,
          MINIO_BUCKET_NAME: config.bucket,
          MINIO_REGION: config.region,
        };

        // Temporarily override config for this provider
        const originalConfig = { ...require('../config').default };
        Object.assign(require('../config').default, minioConfig);
        const minioProvider = new MinioStorageProvider();
        Object.assign(require('../config').default, originalConfig);

        return minioProvider;

      case 'aws':
        // Create a temporary config object for AWS provider
        const awsConfig = {
          AWS_REGION: config.awsRegion,
          AWS_ACCESS_KEY_ID: config.awsAccessKeyId,
          AWS_SECRET_ACCESS_KEY: config.awsSecretAccessKey,
          AWS_S3_BUCKET_NAME: config.awsBucket || config.bucket,
        };

        // Temporarily override config for this provider
        const originalAwsConfig = { ...require('../config').default };
        Object.assign(require('../config').default, awsConfig);
        const awsProvider = new AwsS3StorageProvider();
        Object.assign(require('../config').default, originalAwsConfig);

        return awsProvider;

      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }

  // Get next healthy provider (round-robin with health check)
  private async getNextProvider(): Promise<{ provider: StorageProvider; providerId: string }> {
    // If only one provider, return it directly
    if (this.providers.size === 1) {
      const providerId = this.providerList[0];
      return {
        provider: this.providers.get(providerId)!,
        providerId,
      };
    }

    // Multiple providers - use round-robin with health checks
    const maxAttempts = this.providerList.length;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const providerId = this.providerList[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.providerList.length;

      const health = this.healthStatus.get(providerId);
      if (health?.isHealthy) {
        return {
          provider: this.providers.get(providerId)!,
          providerId,
        };
      }

      attempts++;
    }

    // All providers unhealthy - fail immediately
    throw new Error('All storage providers are unavailable');
  }

  // Get specific provider by ID
  private getProviderById(providerId: string): StorageProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      // Try to find any available provider as fallback
      logger.warn(`Provider ${providerId} not found, using fallback`);
      const firstProvider = this.providers.values().next().value;
      if (firstProvider) {
        return firstProvider;
      }
      throw new Error(`Provider ${providerId} not found and no fallback available`);
    }
    return provider;
  }

  // Health check for a single provider
  private async checkProviderHealth(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    const health = this.healthStatus.get(providerId)!;

    try {
      // Simple health check - try to list files with limit 1
      await provider.listFiles('_health_check_');

      health.isHealthy = true;
      health.consecutiveFailures = 0;
      health.lastCheck = new Date();
      delete health.lastError;
    } catch (error: any) {
      health.consecutiveFailures++;
      health.lastError = error.message;
      health.lastCheck = new Date();

      // Mark unhealthy after 3 consecutive failures
      if (health.consecutiveFailures >= 3) {
        health.isHealthy = false;
        logger.error(`Provider ${providerId} marked unhealthy: ${error.message}`);
      }
    }
  }

  // Start health monitoring
  private startHealthMonitoring(): void {
    const interval = config.STORAGE_HEALTH_CHECK_INTERVAL || 30000;

    // Initial health check
    this.providerList.forEach(id => this.checkProviderHealth(id));

    // Periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      const checks = this.providerList.map(id => this.checkProviderHealth(id));
      await Promise.allSettled(checks);

      // Log health summary
      const healthy = this.providerList.filter(id =>
        this.healthStatus.get(id)?.isHealthy
      ).length;

      logger.debug(`Storage health: ${healthy}/${this.providerList.length} providers healthy`);
    }, interval);
  }

  // Initialize (for compatibility with StorageProvider interface)
  async initialize(): Promise<void> {
    // Providers are already initialized in constructor
    logger.info(`Storage pool ready with ${this.providers.size} provider(s)`);
  }

  // Upload file
  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { provider, providerId } = await this.getNextProvider();

    const result = await provider.uploadFile(options);

    // Add provider info if multiple providers
    if (this.providers.size > 1) {
      return {
        ...result,
        // Store provider info in metadata or return it
        // This will be used by FileStorageService to track in DB
      } as UploadResultWithProvider;
    }

    return result;
  }

  // Download file
  async downloadFile(key: string): Promise<DownloadResult> {
    // For download, we need to know which provider has the file
    // This info should come from the database (handled by FileStorageService)
    // For now, try the first healthy provider

    for (const [providerId, provider] of this.providers) {
      const health = this.healthStatus.get(providerId);
      if (health?.isHealthy) {
        try {
          return await provider.downloadFile(key);
        } catch (error) {
          logger.warn(`Failed to download from ${providerId}, trying next`);
          continue;
        }
      }
    }

    throw new Error('Failed to download file from any provider');
  }

  // Download from specific provider
  async downloadFileFromProvider(key: string, providerId: string): Promise<DownloadResult> {
    const provider = this.getProviderById(providerId);
    return provider.downloadFile(key);
  }

  // Delete file
  async deleteFile(key: string): Promise<void> {
    // Try to delete from all providers (in case of replication)
    const deletePromises = Array.from(this.providers.entries()).map(
      async ([providerId, provider]) => {
        try {
          await provider.deleteFile(key);
          logger.debug(`Deleted ${key} from ${providerId}`);
        } catch (error) {
          logger.debug(`File ${key} not found on ${providerId}`);
        }
      }
    );

    await Promise.allSettled(deletePromises);
  }

  // Delete from specific provider
  async deleteFileFromProvider(key: string, providerId: string): Promise<void> {
    const provider = this.getProviderById(providerId);
    await provider.deleteFile(key);
  }

  // Check if file exists
  async fileExists(key: string): Promise<boolean> {
    for (const provider of this.providers.values()) {
      try {
        const exists = await provider.fileExists(key);
        if (exists) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  // Get file metadata
  async getFileMetadata(key: string): Promise<any> {
    for (const provider of this.providers.values()) {
      try {
        return await provider.getFileMetadata(key);
      } catch {
        continue;
      }
    }
    throw new Error('File not found in any provider');
  }

  // Copy file
  async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    const { provider, providerId } = await this.getNextProvider();
    return provider.copyFile(sourceKey, destinationKey);
  }

  // List files
  async listFiles(prefix?: string): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const provider of this.providers.values()) {
      try {
        const files = await provider.listFiles(prefix);
        files.forEach(file => allFiles.add(file));
      } catch {
        continue;
      }
    }

    return Array.from(allFiles);
  }

  // Get health status
  getHealthStatus(): Record<string, HealthStatus> {
    const status: Record<string, HealthStatus> = {};
    for (const [id, health] of this.healthStatus) {
      status[id] = { ...health };
    }
    return status;
  }

  // Get current provider info (for uploads)
  getCurrentProviderInfo(): { providerId: string; index: number; total: number } {
    const currentProviderId = this.providerList[
      (this.currentIndex - 1 + this.providerList.length) % this.providerList.length
    ];

    return {
      providerId: currentProviderId,
      index: this.currentIndex,
      total: this.providerList.length,
    };
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}