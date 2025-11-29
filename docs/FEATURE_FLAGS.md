# Feature Flags Configuration

This document describes how to enable/disable features in the application using environment variables.

## File Storage Feature Toggle

### Overview

The file storage feature can be enabled or disabled using environment variables. The system supports multiple storage backends (MinIO, AWS S3) through a provider abstraction layer.

When disabled:
- Storage provider is not initialized on the backend
- File upload endpoints are not registered
- File management UI is hidden on the frontend
- File-related menu items are removed

This is useful for:
- Development environments without storage
- Deployments that don't require file storage
- Testing scenarios
- Reducing dependencies

### Storage Provider Options

The system supports the following storage providers:
- **MinIO**: Self-hosted S3-compatible object storage (default)
- **AWS S3**: Amazon's cloud object storage service

You can switch between providers using the `STORAGE_PROVIDER` environment variable.

### Backend Configuration

**File:** `be-api-generic/.env`

```bash
# Enable or disable file storage
ENABLE_FILE_STORAGE=true  # Set to false to disable

# Storage provider: 'minio' or 'aws'
STORAGE_PROVIDER=minio  # Default is 'minio'
```

#### When `ENABLE_FILE_STORAGE=true` with MinIO (Default)

- ✅ MinIO client is initialized
- ✅ File upload/download endpoints are available
- ✅ Article cover image upload works
- ✅ File management features are active

**Required environment variables for MinIO:**
```bash
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=task-mgmt-uploads
MINIO_REGION=us-east-1
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,...
```

#### When `ENABLE_FILE_STORAGE=true` with AWS S3

- ✅ AWS S3 client is initialized
- ✅ File upload/download endpoints are available
- ✅ Files are stored in Amazon S3
- ✅ File management features are active

**Required environment variables for AWS S3:**
```bash
STORAGE_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=task-mgmt-uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,...
```

**Console output:**
```
✅ Storage initialized (AWS)
📁 AWS S3 Storage: task-mgmt-uploads (us-east-1)
```

#### When `ENABLE_FILE_STORAGE=false`

- ❌ Storage provider is NOT initialized
- ❌ File endpoints return 404
- ❌ Server starts without storage dependency
- ✅ All other features work normally

**Console output:**
```
⚠️  File storage disabled (ENABLE_FILE_STORAGE=false)
```

Storage configuration variables become optional.

### Frontend Configuration

**File:** `client/.env`

```bash
# Enable or disable file storage features in UI
VITE_ENABLE_FILE_STORAGE=true  # Set to false to hide file UI
```

#### When `VITE_ENABLE_FILE_STORAGE=true` (Default)

- ✅ "Files" menu item appears in sidebar
- ✅ File Management page is accessible at `/files`
- ✅ File picker component works in forms
- ✅ Article cover image upload UI is shown

#### When `VITE_ENABLE_FILE_STORAGE=false`

- ❌ "Files" menu item is hidden
- ❌ File Management route is not registered
- ❌ File model is excluded from `modelConfigs`
- ✅ All other features work normally

## Implementation Details

### Backend

#### Configuration ([config/index.ts](be-api-generic/src/config/index.ts#L69))
```typescript
ENABLE_FILE_STORAGE: z.string().default('true').transform(v => v === 'true')
```

#### MinIO Initialization ([config/minio.ts](be-api-generic/src/config/minio.ts#L6-L14))
```typescript
export const minioClient = config.ENABLE_FILE_STORAGE
  ? new Minio.Client({ /* ... */ })
  : null;
```

#### File Routes ([server.ts](be-api-generic/src/server.ts#L156))
```typescript
if (config.ENABLE_FILE_STORAGE && pathname.startsWith('/api/files')) {
  // Handle file routes
}
```

#### File Storage Service ([services/file-storage.service.ts](be-api-generic/src/services/file-storage.service.ts#L39-L46))
```typescript
private checkStorageEnabled(): void {
  if (!config.ENABLE_FILE_STORAGE) {
    throw new Error('File storage is disabled. Set ENABLE_FILE_STORAGE=true...');
  }
}
```

### Frontend

#### Feature Flag Config ([config/features.config.ts](client/src/config/features.config.ts))
```typescript
export function isFileStorageEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_FILE_STORAGE === 'true';
}
```

#### Routes ([App.tsx](client/src/App.tsx#L68-L70))
```typescript
{isFileStorageEnabled() && (
  <Route path="/files" element={<FileManagementPage />} />
)}
```

#### Model Configuration ([config/models.config.ts](client/src/config/models.config.ts#L423))
```typescript
export const modelConfigs = {
  // ... other models
  ...(isFileStorageEnabled() ? { file: fileConfig } : {})
};
```

## Testing

### Test with File Storage Enabled

1. **Backend:**
   ```bash
   # .env
   ENABLE_FILE_STORAGE=true
   ```

2. **Frontend:**
   ```bash
   # .env
   VITE_ENABLE_FILE_STORAGE=true
   ```

3. **Restart services:**
   ```bash
   pm2 restart be-api-generic-app
   pm2 restart client-dev client-preview
   ```

4. **Verify:**
   - ✅ Check server logs for "✅ Storage initialized (MINIO)"
   - ✅ Navigate to http://localhost:3001 and see "Files" in sidebar
   - ✅ Visit `/files` route
   - ✅ Test file upload functionality

### Test with File Storage Disabled

1. **Backend:**
   ```bash
   # .env
   ENABLE_FILE_STORAGE=false
   ```

2. **Frontend:**
   ```bash
   # .env
   VITE_ENABLE_FILE_STORAGE=false
   ```

3. **Restart services:**
   ```bash
   pm2 restart be-api-generic-app
   pm2 restart client-dev client-preview
   ```

4. **Verify:**
   - ✅ Check server logs for "⚠️ File storage disabled"
   - ✅ No storage initialization message
   - ✅ Navigate to http://localhost:3001 - "Files" menu is hidden
   - ✅ Visiting `/files` shows 404 or redirects
   - ✅ File upload endpoints return appropriate errors
   - ✅ All other features work normally

### Test with AWS S3 Storage

1. **Backend:**
   ```bash
   # .env
   ENABLE_FILE_STORAGE=true
   STORAGE_PROVIDER=aws
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_S3_BUCKET_NAME=your-bucket-name
   ```

2. **Frontend:**
   ```bash
   # .env
   VITE_ENABLE_FILE_STORAGE=true
   ```

3. **Restart services:**
   ```bash
   pm2 restart be-api-generic-app
   pm2 restart client-dev client-preview
   ```

4. **Verify:**
   - ✅ Check server logs for "✅ Storage initialized (AWS)"
   - ✅ Navigate to http://localhost:3001 and see "Files" in sidebar
   - ✅ Visit `/files` route
   - ✅ Test file upload functionality - files are stored in S3

## API Response

When file storage is disabled, the API info endpoint shows:

```bash
curl http://localhost:3000/api | jq
```

```json
{
  "message": "Auto-Generated API Server",
  "version": "1.0.0",
  "fileStorageEnabled": false,
  "storageProvider": null,
  "endpoints": {
    "auth": [...],
    "rest": [...],
    "graphql": {...}
    // Note: "files" key is absent when disabled
  }
}
```

When enabled with MinIO:

```json
{
  "fileStorageEnabled": true,
  "storageProvider": "minio",
  "endpoints": {
    "files": [
      "POST /api/files/upload",
      "POST /api/files/upload-multiple",
      "GET /api/files",
      "GET /api/files/:id",
      "DELETE /api/files/:id",
      ...
    ]
  }
}
```

When enabled with AWS S3:

```json
{
  "fileStorageEnabled": true,
  "storageProvider": "aws",
  "endpoints": {
    "files": [
      "POST /api/files/upload",
      "POST /api/files/upload-multiple",
      "GET /api/files",
      "GET /api/files/:id",
      "DELETE /api/files/:id",
      ...
    ]
  }
}
```

## Switching Between Storage Providers

To switch from MinIO to AWS S3 (or vice versa):

1. **Update backend `.env`:**
   ```bash
   # Change from MinIO to AWS
   STORAGE_PROVIDER=aws
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_S3_BUCKET_NAME=your-bucket
   ```

2. **Restart backend:**
   ```bash
   pm2 restart be-api-generic-app --update-env
   ```

3. **Verify:**
   ```bash
   curl http://localhost:3000/api | jq '.storageProvider'
   # Should output: "aws"
   ```

**Note:** Existing files will remain in the old storage provider. You'll need to migrate them manually if needed.

## Best Practices

1. **Keep flags in sync:** Backend and frontend flags should typically match
2. **Development:** Enable for full-featured development with MinIO
3. **Testing:** Disable to test fallback behavior
4. **Production:**
   - Use AWS S3 for production deployments (scalable, managed)
   - Use MinIO for on-premise or self-hosted deployments
5. **Docker:** Set via environment variables in docker-compose.yml
6. **Provider choice:**
   - **MinIO**: Development, self-hosted, on-premise, no cloud costs
   - **AWS S3**: Production, cloud-hosted, managed service, pay-per-use

## Troubleshooting

### "File storage is disabled" error on file upload

**Cause:** Backend `ENABLE_FILE_STORAGE=false` but frontend is trying to upload

**Solution:** Enable file storage on backend or disable on frontend

### Files menu still showing when disabled

**Cause:** Frontend not restarted after changing `.env`

**Solution:** Restart client dev server

### Storage connection errors (MinIO)

**Cause:** `STORAGE_PROVIDER=minio` but MinIO is not running

**Solution:** Either start MinIO or switch to AWS S3

### Storage connection errors (AWS S3)

**Cause:** Invalid AWS credentials or bucket doesn't exist

**Solution:**
- Verify AWS credentials are correct
- Check bucket name and region
- Ensure AWS account has S3 permissions
- Check AWS credentials have not expired

### "Unknown storage provider" error

**Cause:** Invalid `STORAGE_PROVIDER` value

**Solution:** Set `STORAGE_PROVIDER` to either `minio` or `aws`

### Files uploaded to wrong storage provider

**Cause:** Changed `STORAGE_PROVIDER` but old files are in different provider

**Solution:** This is expected - migrate files manually if needed

## Architecture

### Storage Provider Abstraction

The system uses a provider abstraction layer for storage operations:

```
┌─────────────────────────────────────┐
│   FileStorageService                │
│   (Business Logic)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   StorageProviderFactory            │
│   (Creates appropriate provider)    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐ ┌──────────────┐
│ MinioStorage │ │ AwsS3Storage │
│   Provider   │ │   Provider   │
└──────────────┘ └──────────────┘
```

**Key files:**
- `interfaces/storage-provider.interface.ts` - Storage provider interface
- `providers/storage-provider.factory.ts` - Factory for creating providers
- `providers/minio-storage.provider.ts` - MinIO implementation
- `providers/aws-s3-storage.provider.ts` - AWS S3 implementation
- `services/file-storage.service.ts` - Business logic using providers

## Future Enhancements

### Potential Storage Providers
- Google Cloud Storage (GCS)
- Azure Blob Storage
- Cloudflare R2
- DigitalOcean Spaces
- Backblaze B2

### Other Feature Toggles
Potential additions to the feature flag system:
- Analytics tracking toggle
- Email notifications toggle
- PDF generation toggle
- Export functionality toggle
- Advanced search toggle

Each would follow the same pattern:
1. Environment variable
2. Config file
3. Conditional initialization
4. Conditional UI rendering
