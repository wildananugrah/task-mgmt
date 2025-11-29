# API Documentation Configuration Guide

The API documentation system is now fully parameterized through environment variables. You can customize every aspect of the documentation without changing any code.

## Configuration Options

All documentation settings are configured in your `.env` file. Here's a complete reference:

### Database Connection Pool Settings

```bash
# Connection Pool Configuration
DATABASE_POOL_MIN=50           # Minimum number of connections (Note: PostgreSQL doesn't use this)
DATABASE_POOL_MAX=200          # Maximum number of connections in the pool
DATABASE_POOL_TIMEOUT=15000    # Connection timeout in milliseconds
```

### Basic API Information

```bash
# API Title and Version
API_TITLE=Product Management API
API_VERSION=1.0.0
API_DESCRIPTION=Auto-generated REST and GraphQL API for product management system

# Contact Information (Optional)
API_CONTACT_NAME=API Support
API_CONTACT_EMAIL=support@example.com
API_CONTACT_URL=https://github.com/yourusername/api-generic
```

### Server Endpoints

Configure multiple server endpoints for different environments:

```bash
# Comma-separated list of server URLs
API_SERVERS=http://localhost:3000,https://api.staging.example.com,https://api.production.example.com

# Comma-separated list of server descriptions (must match number of servers)
API_SERVER_DESCRIPTIONS=Development server,Staging server,Production server
```

### Documentation UI Settings

Control the appearance and behavior of the documentation interface:

```bash
# UI Theme and Appearance
DOCS_THEME=purple              # Options: purple, blue, green, red, orange, yellow
DOCS_DARK_MODE=true            # Enable/disable dark mode
DOCS_SHOW_SIDEBAR=true         # Show/hide the navigation sidebar
DOCS_ENABLE_SEARCH=true        # Enable/disable search functionality (hotkey: 'k')
DOCS_ENABLE_TRY_IT=true        # Allow testing API endpoints from the docs
```

### Documentation Formats

Enable or disable different documentation formats:

```bash
# Documentation Format Toggles
DOCS_ENABLE_SCALAR=true        # Modern interactive documentation UI
DOCS_ENABLE_SWAGGER=true       # Classic Swagger UI
DOCS_ENABLE_POSTMAN=true       # Postman collection export
DOCS_ENABLE_MARKDOWN=true      # Markdown documentation export
```

### Security Settings

Control access to documentation:

```bash
# Documentation Security
DOCS_HIDE_IN_PRODUCTION=false  # Hide docs in production environment
DOCS_REQUIRE_AUTH=false        # Require authentication to access docs
```

## Available Documentation Endpoints

Based on your configuration, the following endpoints will be available:

| Endpoint | Description | Enabled By |
|----------|-------------|------------|
| `/api/docs` | Interactive Scalar UI documentation | `DOCS_ENABLE_SCALAR=true` |
| `/api/docs/swagger` | Swagger UI documentation | `DOCS_ENABLE_SWAGGER=true` |
| `/api/docs/openapi.json` | OpenAPI 3.0 specification | Always enabled |
| `/api/docs/postman.json` | Postman collection export | `DOCS_ENABLE_POSTMAN=true` |
| `/api/docs/markdown` | Markdown documentation | `DOCS_ENABLE_MARKDOWN=true` |

## Usage Examples

### Example 1: Production Configuration

For production, you might want to hide documentation or require authentication:

```bash
# Production settings
NODE_ENV=production
DOCS_HIDE_IN_PRODUCTION=true   # Completely hide docs
# OR
DOCS_REQUIRE_AUTH=true         # Require JWT token to access docs
```

### Example 2: Development Configuration

For development, enable all features:

```bash
# Development settings
NODE_ENV=development
DOCS_ENABLE_SCALAR=true
DOCS_ENABLE_SWAGGER=true
DOCS_ENABLE_POSTMAN=true
DOCS_ENABLE_MARKDOWN=true
DOCS_ENABLE_TRY_IT=true
DOCS_ENABLE_SEARCH=true
```

### Example 3: Custom Branding

Customize the documentation with your branding:

```bash
API_TITLE=My Awesome API
API_VERSION=2.1.0
API_DESCRIPTION=Enterprise-grade API for managing digital assets
API_CONTACT_NAME=Developer Team
API_CONTACT_EMAIL=developers@mycompany.com
API_CONTACT_URL=https://developer.mycompany.com
DOCS_THEME=blue
DOCS_DARK_MODE=false
```

### Example 4: Multi-Environment Setup

Configure multiple server endpoints:

```bash
# Local, staging, and production servers
API_SERVERS=http://localhost:3000,https://api-staging.myapp.com,https://api.myapp.com
API_SERVER_DESCRIPTIONS=Local Development,Staging Environment,Production Environment
```

## Dynamic Features

The documentation automatically adapts based on your configuration:

1. **Server Selection**: Users can switch between configured servers in the documentation UI
2. **Try It Out**: When enabled, users can test API endpoints directly from the documentation
3. **Search**: Quick search across all endpoints and schemas (Ctrl+K or Cmd+K)
4. **Export**: Download documentation in various formats for offline use

## Security Considerations

### Hiding Documentation in Production

If you set `DOCS_HIDE_IN_PRODUCTION=true` and `NODE_ENV=production`, the documentation endpoints will return 404:

```bash
NODE_ENV=production
DOCS_HIDE_IN_PRODUCTION=true
```

### Requiring Authentication

If you set `DOCS_REQUIRE_AUTH=true`, users must provide a valid JWT token to access documentation:

```bash
DOCS_REQUIRE_AUTH=true

# Access with authentication
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/docs/openapi.json
```

## Testing Your Configuration

After updating your `.env` file:

1. Restart the server:
   ```bash
   bun run dev
   ```

2. Check the OpenAPI spec to verify your settings:
   ```bash
   curl http://localhost:3000/api/docs/openapi.json | jq '.info'
   ```

3. Visit the documentation UI:
   - Scalar UI: http://localhost:3000/api/docs
   - Swagger UI: http://localhost:3000/api/docs/swagger

## Troubleshooting

### Changes Not Reflecting

The server needs to be restarted after changing `.env` variables:

```bash
# Stop the server (Ctrl+C)
# Start again
bun run dev
```

### Documentation Not Accessible

Check these settings:
- Is `NODE_ENV=production` and `DOCS_HIDE_IN_PRODUCTION=true`?
- Is `DOCS_REQUIRE_AUTH=true` without providing a token?
- Is the specific format disabled (e.g., `DOCS_ENABLE_SWAGGER=false`)?

### Invalid Configuration

If you see validation errors, check that:
- Email addresses are valid format
- URLs include protocol (http:// or https://)
- Boolean values are 'true' or 'false' (lowercase)
- Server counts match description counts

## Database Connection Pool

The application supports configuring the database connection pool through environment variables:

### Pool Configuration

```bash
DATABASE_POOL_MIN=50           # Minimum connections (informational only for PostgreSQL)
DATABASE_POOL_MAX=200          # Maximum connections in the pool
DATABASE_POOL_TIMEOUT=15000    # Connection timeout in milliseconds (15 seconds)
```

### How It Works

- **DATABASE_POOL_MAX**: Sets the `connection_limit` parameter in the PostgreSQL connection URL
- **DATABASE_POOL_TIMEOUT**: Sets the `pool_timeout` parameter (converted to seconds)
- **DATABASE_POOL_MIN**: Stored for reference but not directly used by PostgreSQL/Prisma

### Testing Connection Pool

You can test the connection pool configuration using the provided script:

```bash
bun scripts/test-pool.ts
```

This will:
1. Display the current pool configuration
2. Test the database connection
3. Execute concurrent queries to verify pooling
4. Show the applied configuration

### Performance Considerations

- **Development**: Use smaller pool sizes (e.g., 10-20 connections)
- **Production**: Scale based on your load (typical range: 50-200 connections)
- **Timeout**: Set based on your query complexity (15-30 seconds is typical)

### Example Configurations

#### Development
```bash
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=20
DATABASE_POOL_TIMEOUT=5000    # 5 seconds
```

#### Production
```bash
DATABASE_POOL_MIN=50
DATABASE_POOL_MAX=200
DATABASE_POOL_TIMEOUT=15000   # 15 seconds
```

## Best Practices

1. **Use different `.env` files** for different environments (`.env.development`, `.env.production`)
2. **Keep sensitive information** in `.env` and never commit it to version control
3. **Document your API version** properly - update `API_VERSION` when making breaking changes
4. **Provide contact information** so API users know how to get support
5. **Enable authentication** for documentation in production if your API contains sensitive information
6. **Test your configuration** in a staging environment before deploying to production
7. **Monitor connection pool usage** in production to optimize settings
8. **Adjust pool size** based on your database server capacity and application load