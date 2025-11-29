# Quick Reference - File Upload Testing

## 🚀 Quick Start (Recommended)

Run the automated test script:
```bash
cd tests
./test-upload.sh
```

## 📋 Manual Testing with cURL

### 1. Get Access Token
```bash
curl -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@mail.com", "password": "p@ssw0rd"}' \
  | jq -r '.accessToken'
```

### 2. Upload a File
```bash
# Replace YOUR_TOKEN with the token from step 1
curl -X POST 'http://localhost:3000/api/files/upload?folder=article-covers&isPublic=true' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'file=@image-test-1.jpg'
```

### 3. List Your Files
```bash
curl -X GET 'http://localhost:3000/api/files?limit=10' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

## ⚠️ Important Notes

- **`.http` files**: File uploads may NOT work in VSCode REST Client due to multipart/form-data limitations
- **Use curl or the test script** for reliable file upload testing
- The API endpoints are fully functional - the issue is only with the REST Client extension

## 📖 Full Documentation

- [FILE_UPLOAD_TESTS.md](FILE_UPLOAD_TESTS.md) - Complete testing guide
- [test-api.http](test-api.http) - HTTP requests (non-upload requests work fine)
- [test-upload.sh](test-upload.sh) - Automated test script

## 🔧 Troubleshooting

If uploads fail with "incorrect MIME type/boundary":
1. Verify you're using curl, not the REST Client
2. Check MinIO is running: `docker ps | grep minio`
3. Verify the file exists: `ls -la image-test-1.jpg`
4. Check server logs: `pm2 logs be-api-generic-app --lines 50`
