# File Upload API Tests

The file upload API is now working! Use the commands below to test it.

## ✅ Working: cURL Commands

### 1. Login and Get Token

```bash
# Login
curl -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@mail.com",
    "password": "p@ssw0rd"
  }'

# Save the token from the response
export TOKEN="YOUR_ACCESS_TOKEN_HERE"
```

### 2. Upload Single File

```bash
curl -X POST 'http://localhost:3000/api/files/upload?folder=article-covers&isPublic=true' \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@image-test-1.jpg'
```

### 3. Upload Multiple Files

```bash
curl -X POST 'http://localhost:3000/api/files/upload-multiple?folder=test-multi&isPublic=false' \
  -H "Authorization: Bearer $TOKEN" \
  -F 'files=@image-test-1.jpg' \
  -F 'files=@image-test-2.jpg'
```

### 4. List Files

```bash
curl -X GET 'http://localhost:3000/api/files?limit=10' \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Get File Metadata

```bash
# Replace FILE_ID with actual file ID from upload response
curl -X GET 'http://localhost:3000/api/files/FILE_ID'
```

### 6. Download File

```bash
curl -X GET 'http://localhost:3000/api/files/FILE_ID/download' \
  -o downloaded-file.jpg
```

### 7. Delete File

```bash
curl -X DELETE 'http://localhost:3000/api/files/FILE_ID' \
  -H "Authorization: Bearer $TOKEN"
```

### 8. Copy File

```bash
curl -X POST 'http://localhost:3000/api/files/FILE_ID/copy' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"folder": "backup"}'
```

## Automated Test Script

Run the complete test suite:

```bash
cd tests
./test-upload.sh
```

## ⚠️ Known Issue: VSCode REST Client

The VSCode REST Client extension (`.http` files) has limited support for multipart/form-data file uploads. While we've added file upload requests to `test-api.http`, they may not work reliably.

**Recommendation**: Use curl commands or the test script instead for file uploads.

## File Upload Configuration

From `.env`:
- `MAX_FILE_SIZE`: 10MB (10485760 bytes)
- `ALLOWED_FILE_TYPES`: image/jpeg, image/png, image/gif, application/pdf, text/plain, DOCX, XLSX
- `MINIO_BUCKET_NAME`: task-mgmt-uploads

## MinIO Console

View uploaded files in MinIO console:
- URL: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin123`
