# Feature Flags Configuration

This document describes how to enable/disable features in the application using environment variables.

## File Storage Feature Toggle

### Overview

The file storage feature can be enabled or disabled using environment variables. When disabled:
- MinIO is not initialized on the backend
- File upload endpoints are not registered
- File management UI is hidden on the frontend
- File-related menu items are removed

This is useful for:
- Development environments without MinIO
- Deployments that don't require file storage
- Testing scenarios
- Reducing dependencies

### Backend Configuration

**File:** `be-api-generic/.env`

```bash
# Enable or disable file storage
ENABLE_FILE_STORAGE=true  # Set to false to disable
```

#### When `ENABLE_FILE_STORAGE=true` (Default)

- ✅ MinIO client is initialized
- ✅ File upload/download endpoints are available
- ✅ Article cover image upload works
- ✅ File management features are active

**Required environment variables:**
```bash
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

#### When `ENABLE_FILE_STORAGE=false`

- ❌ MinIO client is NOT initialized
- ❌ File endpoints return 404
- ❌ Server starts without MinIO dependency
- ✅ All other features work normally

**Console output:**
```
⚠️  File storage disabled (ENABLE_FILE_STORAGE=false)
```

MinIO configuration variables become optional.

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
   - ✅ Check server logs for "✅ MinIO storage initialized"
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
   - ✅ No MinIO initialization message
   - ✅ Navigate to http://localhost:3001 - "Files" menu is hidden
   - ✅ Visiting `/files` shows 404 or redirects
   - ✅ File upload endpoints return appropriate errors
   - ✅ All other features work normally

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
  "endpoints": {
    "auth": [...],
    "rest": [...],
    "graphql": {...}
    // Note: "files" key is absent when disabled
  }
}
```

When enabled:

```json
{
  "fileStorageEnabled": true,
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

## Best Practices

1. **Keep flags in sync:** Backend and frontend flags should typically match
2. **Development:** Enable for full-featured development
3. **Testing:** Disable to test fallback behavior
4. **Production:** Enable if you need file storage, disable if not
5. **Docker:** Set via environment variables in docker-compose.yml

## Troubleshooting

### "File storage is disabled" error on file upload

**Cause:** Backend `ENABLE_FILE_STORAGE=false` but frontend is trying to upload

**Solution:** Enable file storage on backend or disable on frontend

### Files menu still showing when disabled

**Cause:** Frontend not restarted after changing `.env`

**Solution:** Restart client dev server

### MinIO connection errors

**Cause:** `ENABLE_FILE_STORAGE=true` but MinIO is not running

**Solution:** Either start MinIO or set `ENABLE_FILE_STORAGE=false`

## Future Enhancements

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
