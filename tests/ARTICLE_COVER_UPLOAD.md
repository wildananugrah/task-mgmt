# Article Cover Image Direct Upload

## Overview

The `POST /api/articles/:id/cover-image` endpoint allows direct upload of cover images to articles in a single request.

## Endpoint

```
POST /api/articles/:id/cover-image
```

## Features

- ✅ Direct upload - No need to upload file first, then update article
- ✅ Automatic file validation (type and size)
- ✅ Automatic folder organization (saves to `article-covers` folder)
- ✅ Public access - Cover images are automatically set as public
- ✅ Activity logging - Tracks who uploaded what and when
- ✅ Returns complete article with file information

## Authentication

Requires Bearer token with one of these roles:
- `ADMIN`
- `MANAGER`

## Request Format

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file`: The image file to upload

## Validation Rules

### Allowed File Types
- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/gif` (.gif)
- `image/webp` (.webp)
- `image/svg+xml` (.svg)

### File Size
- Maximum: 10MB

## Response Format

**Success (200 OK):**

```json
{
  "id": "article-uuid",
  "title": "Article Title",
  "content": "Article content...",
  "slug": "article-slug",
  "published": true,
  "authorId": "author-uuid",
  "fileId": "file-uuid",
  "createdAt": "2025-11-29T02:04:41.622Z",
  "updatedAt": "2025-11-29T02:04:41.702Z",
  "author": {
    "id": "author-uuid",
    "email": "author@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "file": {
    "id": "file-uuid",
    "originalName": "cover-image.jpg",
    "fileName": "cover-image-unique-id.jpg",
    "mimeType": "image/jpeg",
    "size": 474489,
    "bucket": "task-mgmt-uploads",
    "key": "public/article-covers/cover-image-unique-id.jpg",
    "url": "http://localhost:9000/task-mgmt-uploads/public/article-covers/cover-image-unique-id.jpg",
    "isPublic": true,
    "userId": "user-uuid",
    "metadata": {
      "ip": "127.0.0.1",
      "articleId": "article-uuid",
      "uploadedFrom": "curl/8.4.0"
    },
    "createdAt": "2025-11-29T02:04:41.699Z",
    "updatedAt": "2025-11-29T02:04:41.699Z"
  }
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 404 Not Found
{
  "error": "Article not found"
}

// 400 Bad Request - No file
{
  "error": "No file uploaded"
}

// 400 Bad Request - Invalid file type
{
  "error": "File type 'application/pdf' is not allowed. Only images are accepted.",
  "code": "INVALID_FILE_TYPE",
  "allowedTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
}

// 400 Bad Request - File too large
{
  "error": "File too large. Maximum size is 10MB",
  "code": "FILE_TOO_LARGE"
}
```

## Usage Examples

### cURL

```bash
# Get auth token
TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mail.com", "password": "p@ssw0rd"}' \
  | jq -r '.accessToken')

# Upload cover image
curl -X POST "http://localhost:3000/api/articles/YOUR_ARTICLE_ID/cover-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./path/to/image.jpg"
```

### Automated Test

```bash
# Run the test script
cd tests
./test-article-cover-upload.sh
```

This script will:
1. Login and get a token
2. Create a test article
3. Upload a cover image to the article
4. Display the results

### JavaScript/Fetch API

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch(`http://localhost:3000/api/articles/${articleId}/cover-image`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const updatedArticle = await response.json();
console.log('Cover image uploaded:', updatedArticle.file.url);
```

### Axios (Node.js/Browser)

```javascript
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('./image.jpg'));

const response = await axios.post(
  `http://localhost:3000/api/articles/${articleId}/cover-image`,
  form,
  {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  }
);

console.log('Uploaded:', response.data.file.url);
```

## Comparison: Two Upload Methods

### Option 1: Two-Step Upload

```bash
# 1. Upload file first
FILE_RESPONSE=$(curl -X POST "http://localhost:3000/api/files/upload?folder=article-covers&isPublic=true" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./image.jpg")

FILE_ID=$(echo $FILE_RESPONSE | jq -r '.id')

# 2. Update article with file ID
curl -X PUT "http://localhost:3000/api/articles/$ARTICLE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileId\": \"$FILE_ID\"}"
```

### Option 2: Direct Upload (New)

```bash
# Single request
curl -X POST "http://localhost:3000/api/articles/$ARTICLE_ID/cover-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./image.jpg"
```

**Benefits of Direct Upload:**
- ✅ Single API call instead of two
- ✅ Simpler client code
- ✅ Automatic folder organization
- ✅ Atomic operation (upload + update together)
- ✅ Better error handling

## Notes

1. **VSCode REST Client:** Does not support multipart/form-data file uploads properly. Use cURL or the test script instead.

2. **File Storage:** Files are stored in MinIO at `public/article-covers/filename-uuid.ext`

3. **Public Access:** Cover images are automatically marked as public for easy sharing.

4. **Metadata:** The system stores metadata including:
   - Article ID reference
   - Upload source (user agent)
   - IP address (if available)

5. **Activity Logging:** All uploads are logged for audit purposes.

## Troubleshooting

### "Invalid or expired token"
Get a new token by logging in again.

### "Article not found"
Verify the article ID is correct and the article exists.

### "File type not allowed"
Ensure you're uploading an image file (JPEG, PNG, GIF, WebP, or SVG).

### "File too large"
Reduce the file size to under 10MB.

### "Can't decode form data from body because of incorrect MIME type/boundary"
This error appears when using VSCode REST Client. Use cURL or the automated test script instead.
