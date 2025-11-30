# Flexible Storage Provider System

## Overview

This application supports a flexible storage system that can work with:
- **Single Provider Mode**: One storage backend (backward compatible)
- **Multi-Provider Mode**: Multiple storage backends with load balancing and failover

## Single Provider Mode (Default)

This is the simplest configuration and is **100% backward compatible** with existing setups.

### Configuration

```bash
# .env
ENABLE_FILE_STORAGE=true
STORAGE_PROVIDER=minio  # or 'aws'

# MinIO configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=task-mgmt-uploads
```

### How It Works
- Files are uploaded to a single storage provider
- No health checks needed
- No provider tracking in database
- Simple and straightforward

## Multi-Provider Mode (High Availability)

Enable multiple storage providers for:
- **Load balancing** across providers
- **Automatic failover** when a provider is down
- **High availability** for critical applications
- **Geographic distribution** of storage

### Configuration

```bash
# .env
ENABLE_FILE_STORAGE=true

# Enable multi-provider mode
STORAGE_PROVIDERS=provider1,provider2,provider3
STORAGE_STRATEGY=round-robin
STORAGE_HEALTH_CHECK_INTERVAL=30000  # 30 seconds

# Provider 1 - Primary MinIO
PROVIDER1_TYPE=minio
PROVIDER1_NAME=minio-primary
PROVIDER1_ENDPOINT=minio1.example.com
PROVIDER1_PORT=9000
PROVIDER1_USE_SSL=true
PROVIDER1_ACCESS_KEY=minioadmin1
PROVIDER1_SECRET_KEY=secret1
PROVIDER1_BUCKET=uploads
PROVIDER1_REGION=us-east-1

# Provider 2 - Secondary MinIO
PROVIDER2_TYPE=minio
PROVIDER2_NAME=minio-secondary
PROVIDER2_ENDPOINT=minio2.example.com
PROVIDER2_PORT=9000
PROVIDER2_USE_SSL=true
PROVIDER2_ACCESS_KEY=minioadmin2
PROVIDER2_SECRET_KEY=secret2
PROVIDER2_BUCKET=uploads
PROVIDER2_REGION=us-west-1

# Provider 3 - AWS S3 Backup
PROVIDER3_TYPE=aws
PROVIDER3_NAME=aws-backup
PROVIDER3_REGION=us-west-2
PROVIDER3_ACCESS_KEY_ID=AKIAXXXXXXXXX
PROVIDER3_SECRET_ACCESS_KEY=xxxxxxxxxxxx
PROVIDER3_BUCKET=backup-uploads
```

### How It Works

1. **Round-Robin Distribution**: Files are uploaded to providers in rotation
2. **Health Monitoring**: Providers are checked every 30 seconds
3. **Automatic Failover**: Unhealthy providers are skipped
4. **Provider Tracking**: Database tracks which provider stores each file

## Scaling Examples

### 1 Provider (Current Setup)
```bash
STORAGE_PROVIDER=minio
# Standard MinIO config...
```

### 2 Providers (Primary + Backup)
```bash
STORAGE_PROVIDERS=primary,backup

PROVIDER_PRIMARY_TYPE=minio
PROVIDER_PRIMARY_ENDPOINT=minio1.local
# ... primary config

PROVIDER_BACKUP_TYPE=minio
PROVIDER_BACKUP_ENDPOINT=minio2.local
# ... backup config
```

### 5 Providers (Geographic Distribution)
```bash
STORAGE_PROVIDERS=us-east,us-west,europe,asia,australia

PROVIDER_US_EAST_TYPE=aws
PROVIDER_US_EAST_REGION=us-east-1
# ... us-east config

PROVIDER_EUROPE_TYPE=minio
PROVIDER_EUROPE_ENDPOINT=minio.eu.example.com
# ... europe config

# ... more providers
```

### 10+ Providers (Large Scale)
```bash
STORAGE_PROVIDERS=dc1,dc2,dc3,dc4,dc5,aws1,aws2,gcs1,gcs2,backup
# Configure each with PROVIDER_{NAME}_* variables
```

## Features

### Automatic Detection
The system automatically detects whether you're using single or multi-provider mode:
- If `STORAGE_PROVIDERS` is set → Multi-provider mode
- If only `STORAGE_PROVIDER` is set → Single provider mode

### Health Monitoring (Multi-Provider Only)
- Providers are health-checked every 30 seconds
- After 3 consecutive failures, a provider is marked unhealthy
- Unhealthy providers are automatically skipped

### Load Balancing Strategies
Currently supported:
- **round-robin** (default): Equal distribution across providers

Future strategies:
- **random**: Random provider selection
- **weighted**: Weighted distribution based on capacity

### Database Tracking
In multi-provider mode, the database tracks:
- Which provider stores each file (`storageProvider` field)
- Enables direct download from the correct provider
- Supports provider migration in the future

## Migration Guide

### From Single to Multi-Provider

1. **Add providers to .env**:
```bash
# Keep existing config
STORAGE_PROVIDER=minio  # Will be ignored
# Add multi-provider config
STORAGE_PROVIDERS=provider1
PROVIDER1_TYPE=minio
# Copy your existing MinIO settings to PROVIDER1_*
```

2. **Restart server**:
```bash
pm2 restart be-api-generic-app --update-env
```

3. **Existing files continue to work** (storageProvider field is null)

4. **New files use the pool** (storageProvider field is set)

### Adding More Providers

Just add to the list and define configuration:
```bash
# Original
STORAGE_PROVIDERS=provider1

# Add provider2
STORAGE_PROVIDERS=provider1,provider2
PROVIDER2_TYPE=aws
PROVIDER2_REGION=us-west-2
# ... provider2 config
```

## API Response

The API info endpoint shows the current configuration:

### Single Provider Mode
```json
{
  "fileStorageEnabled": true,
  "storageProvider": "minio"
}
```

### Multi-Provider Mode
```json
{
  "fileStorageEnabled": true,
  "storageProvider": null,
  "storageProviders": ["provider1", "provider2", "provider3"],
  "storageStrategy": "round-robin"
}
```

## Architecture

```
                    FileStorageService
                            |
                   StorageProviderFactory
                            |
            ┌───────────────┴───────────────┐
            |                               |
     Single Provider               Storage Pool Manager
      (MinIO/AWS/GCS)              (Multiple Providers)
            |                               |
         Storage                    ┌───────┼───────┐
                                   P1      P2      P3
                               (MinIO)  (AWS)  (MinIO)
```

## Troubleshooting

### All providers are unavailable
**Cause**: All providers failed health checks
**Solution**: Check provider connectivity and credentials

### Files not downloading
**Cause**: Provider that stored the file is down
**Solution**: System will try other providers if configured

### Provider not initialized
**Cause**: Invalid configuration for a provider
**Solution**: Check logs for specific provider initialization errors

## Best Practices

1. **Start with 1 provider** for simplicity
2. **Add providers gradually** as needed
3. **Mix provider types** for vendor independence
4. **Use health checks** in production (30-second default)
5. **Monitor logs** for provider health status

## Example Use Cases

### Development
- Single MinIO provider
- Simple configuration
- No redundancy needed

### Staging
- 2 MinIO providers
- Primary + backup
- Test failover scenarios

### Production
- 3+ providers
- Mix of MinIO and AWS S3
- Geographic distribution
- Automatic failover

### Enterprise
- 10+ providers
- Multiple regions
- Multiple cloud providers
- High availability critical