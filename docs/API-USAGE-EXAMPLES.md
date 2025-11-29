# API Usage Examples

## 📚 Interactive Documentation

Visit the interactive API documentation at:
- **Scalar UI (Recommended)**: http://localhost:3000/api/docs
- **Swagger UI**: http://localhost:3000/api/docs/swagger
- **OpenAPI Spec**: http://localhost:3000/api/docs/openapi.json
- **Postman Collection**: http://localhost:3000/api/docs/postman.json
- **Markdown Docs**: http://localhost:3000/api/docs/markdown

## 🔐 Authentication

### 1. Login to Get Token
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r .accessToken)

echo "Your token: $TOKEN"
```

## 📦 Product Management

### List Products with Filters
```bash
# Get products with pagination, sorting, and filtering
curl -s "http://localhost:3000/api/products?page=1&limit=5&sort=price&order=desc&minPrice=100&maxPrice=2000" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Search Products
```bash
# Search for products containing "laptop"
curl -s "http://localhost:3000/api/products?search=laptop" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get Single Product
```bash
# Get product by ID
PRODUCT_ID="your-product-id"
curl -s "http://localhost:3000/api/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create New Product
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 16 Pro",
    "description": "Latest iPhone with A18 chip",
    "sku": "IPH16P-256",
    "price": 1499.99,
    "cost": 1100,
    "quantity": 25,
    "minQuantity": 5,
    "categoryId": "YOUR-CATEGORY-ID",
    "images": ["https://example.com/iphone16.jpg"],
    "tags": ["smartphone", "apple", "premium"],
    "featured": true
  }' | jq
```

### Update Product
```bash
curl -X PUT "http://localhost:3000/api/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 1399.99,
    "quantity": 30,
    "featured": false
  }' | jq
```

## 📁 Category Management

### List Categories
```bash
curl -s http://localhost:3000/api/categories \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create Category
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tablets",
    "description": "Tablet computers and accessories",
    "slug": "tablets",
    "isActive": true
  }' | jq
```

## 👥 User Management (Admin Only)

### List Users
```bash
curl -s http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }' | jq
```

## 🛒 Order Management

### Create Order
```bash
# First, get a product ID
PRODUCT_ID=$(curl -s http://localhost:3000/api/products?limit=1 \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

# Create order
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "'$PRODUCT_ID'",
        "quantity": 2,
        "price": 99.99
      }
    ],
    "tax": 19.99,
    "shipping": 5.99,
    "shippingInfo": {
      "name": "John Doe",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    }
  }' | jq
```

### List Orders
```bash
curl -s "http://localhost:3000/api/orders?status=PENDING" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Update Order Status
```bash
ORDER_ID="your-order-id"
curl -X PUT "http://localhost:3000/api/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PROCESSING"
  }' | jq
```

## 🔍 Advanced Filtering Examples

### Products by Multiple Criteria
```bash
# Get active, featured products in a price range
curl -s "http://localhost:3000/api/products?\
status=ACTIVE&\
featured=true&\
minPrice=100&\
maxPrice=1000&\
sort=price&\
order=asc" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Products by Category
```bash
# First get category ID
CATEGORY_ID=$(curl -s "http://localhost:3000/api/categories?search=electronics" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

# Then get products in that category
curl -s "http://localhost:3000/api/products?categoryId=$CATEGORY_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 📊 Response Format

### Successful List Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Product Name",
      "price": 99.99,
      // ... other fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": "Validation Error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "price",
      "message": "Must be a positive number"
    }
  ]
}
```

## 🎯 Tips

1. **Use the Interactive Docs**: Visit http://localhost:3000/api/docs for a beautiful, interactive API explorer
2. **Import to Postman**: Download http://localhost:3000/api/docs/postman.json and import into Postman
3. **Token Management**: Tokens expire after 15 minutes, use refresh token to get new access token
4. **Filtering**: Most list endpoints support filtering - check the docs for available filters
5. **Pagination**: Default page size is 20, max is 100
6. **Search**: Use the `search` parameter for fuzzy text search across configured fields

## 🔧 Test Credentials

After seeding the database:
- **Admin**: admin@example.com / admin123 (full access)
- **Manager**: manager@example.com / manager123 (limited admin access)
- **User**: user@example.com / user123 (read-only for most resources)