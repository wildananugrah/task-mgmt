# File Upload API Documentation

This document describes the file upload functionality integrated with MinIO object storage.

## Overview

The file upload system allows users to upload files to MinIO object storage with automatic metadata tracking in the database. Files can be organized into folders, set as public or private, and include custom metadata.

## Features

- **Single and multiple file uploads**
- **MinIO object storage integration**
- **File metadata stored in PostgreSQL**
- **Public and private file support**
- **Automatic URL generation (public URLs or presigned URLs for private files)**
- **File organization with folders**
- **File copying and deletion**
- **User-specific file management**
- **Configurable file size and type restrictions**

## Configuration

Add these environment variables to your `.env` file:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=task-mgmt-uploads
MINIO_REGION=us-east-1

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
FILE_UPLOAD_PATH=/uploads
```

## Prerequisites

1. **Start MinIO**:
```bash
cd ../minio
docker-compose up -d
```

2. **Run database migration** to create the File table:
```bash
bunx prisma migrate dev
```

3. **Install dependencies**:
```bash
bun install
```

## API Endpoints

### 1. Upload Single File
**POST** `/api/files/upload`

Upload a single file to MinIO.

**Headers:**
- `Content-Type`: `multipart/form-data`
- `Authorization`: `Bearer <token>` (optional)

**Form Data:**
- `file`: The file to upload (required)

**Query Parameters:**
- `folder`: Folder path in MinIO (optional, default: "general")
- `isPublic`: Whether file should be publicly accessible (optional, default: false)

**Example Request:**
```bash
curl -X POST \
  'http://localhost:3000/api/files/upload?folder=documents&isPublic=true' \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'file=@/path/to/document.pdf'
```

**Response:**
```json
{
  "id": "uuid-here",
  "originalName": "document.pdf",
  "fileName": "document-uuid.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "url": "http://localhost:9000/task-mgmt-uploads/public/documents/document-uuid.pdf",
  "bucket": "task-mgmt-uploads",
  "key": "public/documents/document-uuid.pdf",
  "userId": "user-uuid",
  "metadata": {
    "uploadedFrom": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  }
}
```

### 2. Upload Multiple Files
**POST** `/api/files/upload-multiple`

Upload multiple files at once (max 10 files).

**Headers:**
- `Content-Type`: `multipart/form-data`
- `Authorization`: `Bearer <token>` (optional)

**Form Data:**
- `files`: Multiple files (required, max 10)

**Query Parameters:**
- `folder`: Folder path in MinIO (optional)
- `isPublic`: Whether files should be publicly accessible (optional)

**Example Request:**
```bash
curl -X POST \
  'http://localhost:3000/api/files/upload-multiple?folder=images' \
  -H 'Authorization: Bearer your-jwt-token' \
  -F 'files=@image1.jpg' \
  -F 'files=@image2.png'
```

**Response:**
```json
{
  "files": [
    {
      "id": "uuid-1",
      "originalName": "image1.jpg",
      "fileName": "image1-uuid.jpg",
      "mimeType": "image/jpeg",
      "size": 204800,
      "url": "http://localhost:9000/...",
      "bucket": "task-mgmt-uploads",
      "key": "private/images/image1-uuid.jpg"
    },
    {
      "id": "uuid-2",
      "originalName": "image2.png",
      "fileName": "image2-uuid.png",
      "mimeType": "image/png",
      "size": 307200,
      "url": "http://localhost:9000/...",
      "bucket": "task-mgmt-uploads",
      "key": "private/images/image2-uuid.png"
    }
  ],
  "count": 2
}
```

### 3. List User Files
**GET** `/api/files`

List all files uploaded by the authenticated user.

**Headers:**
- `Authorization`: `Bearer <token>` (required)

**Query Parameters:**
- `limit`: Number of files to return (optional, default: 20)
- `offset`: Number of files to skip (optional, default: 0)

**Example Request:**
```bash
curl -X GET \
  'http://localhost:3000/api/files?limit=10&offset=0' \
  -H 'Authorization: Bearer your-jwt-token'
```

**Response:**
```json
{
  "files": [
    {
      "id": "uuid",
      "originalName": "document.pdf",
      "fileName": "document-uuid.pdf",
      "mimeType": "application/pdf",
      "size": 1048576,
      "url": "https://...",
      "bucket": "task-mgmt-uploads",
      "key": "private/documents/document-uuid.pdf",
      "isPublic": false,
      "userId": "user-uuid",
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 25,
  "limit": 10,
  "offset": 0
}
```

### 4. Get File Metadata
**GET** `/api/files/:id`

Get metadata for a specific file.

**Parameters:**
- `id`: File ID (UUID)

**Example Request:**
```bash
curl -X GET 'http://localhost:3000/api/files/file-uuid-here'
```

**Response:**
```json
{
  "id": "file-uuid",
  "originalName": "document.pdf",
  "fileName": "document-uuid.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "url": "https://...",
  "bucket": "task-mgmt-uploads",
  "key": "public/documents/document-uuid.pdf",
  "isPublic": true,
  "userId": "user-uuid",
  "metadata": {},
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "minioMetadata": {
    "size": 1048576,
    "metaData": {},
    "lastModified": "2024-01-01T12:00:00Z",
    "etag": "etag-value"
  }
}
```

### 5. Download File
**GET** `/api/files/:id/download`

Download a file by its ID.

**Parameters:**
- `id`: File ID (UUID)

**Example Request:**
```bash
curl -X GET \
  'http://localhost:3000/api/files/file-uuid/download' \
  -o downloaded-file.pdf
```

**Response:**
Binary file data with appropriate headers:
- `Content-Type`: File MIME type
- `Content-Disposition`: `attachment; filename="original-name.pdf"`
- `Content-Length`: File size in bytes

### 6. Delete File
**DELETE** `/api/files/:id`

Delete a file from MinIO and database. Only the file owner can delete their files.

**Headers:**
- `Authorization`: `Bearer <token>` (required)

**Parameters:**
- `id`: File ID (UUID)

**Example Request:**
```bash
curl -X DELETE \
  'http://localhost:3000/api/files/file-uuid' \
  -H 'Authorization: Bearer your-jwt-token'
```

**Response:**
```json
{
  "message": "File deleted successfully",
  "id": "file-uuid"
}
```

### 7. Copy File
**POST** `/api/files/:id/copy`

Create a copy of an existing file in a new folder.

**Headers:**
- `Authorization`: `Bearer <token>` (optional)
- `Content-Type`: `application/json`

**Parameters:**
- `id`: File ID to copy (UUID)

**Request Body:**
```json
{
  "folder": "copies"
}
```

**Example Request:**
```bash
curl -X POST \
  'http://localhost:3000/api/files/file-uuid/copy' \
  -H 'Authorization: Bearer your-jwt-token' \
  -H 'Content-Type: application/json' \
  -d '{"folder": "backup"}'
```

**Response:**
```json
{
  "id": "new-file-uuid",
  "originalName": "document.pdf",
  "fileName": "copy-uuid-document-uuid.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "url": "https://...",
  "bucket": "task-mgmt-uploads",
  "key": "private/backup/copy-uuid-document-uuid.pdf",
  "userId": "user-uuid"
}
```

## File Organization

Files are organized in MinIO with the following structure:
```
bucket/
├── public/          # Publicly accessible files
│   ├── general/     # Default folder
│   ├── images/      # User-specified folder
│   └── documents/   # User-specified folder
└── private/         # Private files (require presigned URLs)
    ├── general/     # Default folder
    ├── personal/    # User-specified folder
    └── secure/      # User-specified folder
```

## File Type Restrictions

Default allowed file types:
- Images: `image/jpeg`, `image/png`, `image/gif`
- Documents: `application/pdf`, `text/plain`
- Office: `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- Office: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created (successful upload)
- `400` - Bad Request (invalid file, missing parameters)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (file doesn't exist)
- `413` - Payload Too Large (file exceeds size limit)
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

Common error codes:
- `FILE_TOO_LARGE` - File exceeds maximum size limit
- `TOO_MANY_FILES` - Too many files uploaded at once
- `UNEXPECTED_FIELD` - Unexpected form field name
- `UPLOAD_ERROR` - General upload error

## MinIO Console Access

You can view and manage files directly in MinIO console:
1. Open http://localhost:9001
2. Login with:
   - Username: `minioadmin`
   - Password: `minioadmin123`
3. Navigate to the `task-mgmt-uploads` bucket

## Security Considerations

1. **Authentication**: Use JWT tokens for authenticated uploads
2. **File Size Limits**: Configure `MAX_FILE_SIZE` to prevent abuse
3. **File Type Validation**: Only allowed MIME types are accepted
4. **User Isolation**: Users can only delete their own files
5. **Private Files**: Use presigned URLs with expiration for private files
6. **Metadata Sanitization**: Sensitive data is not stored in metadata

## Performance Tips

1. **Batch Uploads**: Use `/upload-multiple` for uploading multiple files
2. **File Compression**: Compress large files before upload
3. **CDN Integration**: Serve public files through a CDN for better performance
4. **Caching**: Cache presigned URLs for private files (respect expiration)
5. **Background Jobs**: Process large files asynchronously

## Example Integration

### React Component Example
```jsx
import React, { useState } from 'react';
import axios from 'axios';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        'http://localhost:3000/api/files/upload?folder=uploads&isPublic=false',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      console.log('File uploaded:', response.data);
      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.response?.data?.error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  );
}
```

## Troubleshooting

### MinIO Connection Issues
- Ensure MinIO is running: `docker ps | grep minio`
- Check MinIO health: `curl http://localhost:9000/minio/health/live`
- Verify credentials in `.env` file

### File Upload Failures
- Check file size against `MAX_FILE_SIZE`
- Verify file type is in `ALLOWED_FILE_TYPES`
- Ensure bucket exists and has proper permissions
- Check MinIO logs: `docker logs task-mgmt-minio`

### Database Issues
- Run migrations: `bunx prisma migrate dev`
- Check database connection in `.env`
- Verify File table exists: `bunx prisma studio`