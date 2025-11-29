#!/bin/bash

# Test script for Article Cover Image Direct Upload
# Tests the POST /api/articles/:id/cover-image endpoint

BASE_URL="http://localhost:3000"
TEST_IMAGE="./image-test-1.jpg"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Article Cover Image Upload Test"
echo "=========================================="

# Step 1: Login
echo -e "\n${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mail.com",
    "password": "p@ssw0rd"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."

# Step 2: Create an article
echo -e "\n${YELLOW}Step 2: Creating a test article...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/articles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Article for Cover Upload",
    "content": "This article will get a cover image",
    "slug": "test-article-cover-'$(date +%s)'",
    "published": true,
    "authorId": "e4e4eb64-7166-45cd-a6c3-86c0841b001f"
  }')

ARTICLE_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ARTICLE_ID" ]; then
  echo -e "${RED}❌ Article creation failed${NC}"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Article created${NC}"
echo "Article ID: $ARTICLE_ID"

# Step 3: Check if test image exists
if [ ! -f "$TEST_IMAGE" ]; then
  echo -e "${RED}❌ Test image not found: $TEST_IMAGE${NC}"
  echo "Please make sure the test image exists in the tests directory"
  exit 1
fi

echo -e "${GREEN}✓ Test image found: $TEST_IMAGE${NC}"

# Step 4: Upload cover image directly to the article
echo -e "\n${YELLOW}Step 3: Uploading cover image to article...${NC}"
UPLOAD_RESPONSE=$(curl -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/api/articles/${ARTICLE_ID}/cover-image" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TEST_IMAGE}" 2>&1)

HTTP_STATUS=$(echo "$UPLOAD_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "\n${GREEN}✅ SUCCESS: Cover image uploaded directly to article!${NC}"

  # Extract file ID from response
  FILE_ID=$(echo "$BODY" | grep -o '"fileId":"[^"]*' | cut -d'"' -f4)
  if [ ! -z "$FILE_ID" ]; then
    echo "File ID: $FILE_ID"
  fi

  # Show file details if available
  FILE_URL=$(echo "$BODY" | grep -o '"url":"[^"]*' | cut -d'"' -f4)
  if [ ! -z "$FILE_URL" ]; then
    echo "File URL: $FILE_URL"
  fi

  exit 0
else
  echo -e "\n${RED}❌ FAILED: Upload failed with status $HTTP_STATUS${NC}"
  exit 1
fi
