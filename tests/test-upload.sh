#!/bin/bash

# Test file upload with curl
# Usage: ./test-upload.sh

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"

echo -e "${YELLOW}=== Testing File Upload API ===${NC}\n"

# Step 1: Login
echo -e "${YELLOW}1. Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mail.com",
    "password": "p@ssw0rd"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Upload single file
echo -e "${YELLOW}2. Uploading single file (image-test-1.jpg)...${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/files/upload?folder=article-covers&isPublic=true" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@image-test-1.jpg")

FILE_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$FILE_ID" ]; then
  echo -e "${RED}❌ Upload failed${NC}"
  echo $UPLOAD_RESPONSE
else
  echo -e "${GREEN}✓ File uploaded successfully${NC}"
  echo "File ID: $FILE_ID"
  echo "Response:"
  echo $UPLOAD_RESPONSE | jq '.' 2>/dev/null || echo $UPLOAD_RESPONSE
fi
echo ""

# Step 3: List files
echo -e "${YELLOW}3. Listing user files...${NC}"
LIST_RESPONSE=$(curl -s -X GET "$API_URL/api/files?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo $LIST_RESPONSE | jq '.' 2>/dev/null || echo $LIST_RESPONSE
echo ""

# Step 4: Get file metadata
if [ ! -z "$FILE_ID" ]; then
  echo -e "${YELLOW}4. Getting file metadata...${NC}"
  METADATA_RESPONSE=$(curl -s -X GET "$API_URL/api/files/$FILE_ID")

  echo "Response:"
  echo $METADATA_RESPONSE | jq '.' 2>/dev/null || echo $METADATA_RESPONSE
  echo ""
fi

# Step 5: Upload multiple files
echo -e "${YELLOW}5. Uploading multiple files...${NC}"
MULTI_RESPONSE=$(curl -s -X POST "$API_URL/api/files/upload-multiple?folder=test-multi&isPublic=false" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@image-test-1.jpg" \
  -F "files=@image-test-2.jpg")

echo "Response:"
echo $MULTI_RESPONSE | jq '.' 2>/dev/null || echo $MULTI_RESPONSE
echo ""

echo -e "${GREEN}=== Testing Complete ===${NC}"
