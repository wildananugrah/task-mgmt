import { openAPIGenerator } from '../utils/openapi-generator';
import { apiGenerator } from '../models/configurations';
import config from '../config';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../types/auth';

export class DocsRouter {
  private getOpenAPISpec(): any {
    // Generate spec on demand to ensure models are registered
    return openAPIGenerator.generateOpenAPISpec();
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Check if docs should be hidden in production
    if (config.DOCS_HIDE_IN_PRODUCTION && config.NODE_ENV === 'production') {
      return new Response('Documentation is not available in production', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Check if authentication is required for docs
    if (config.DOCS_REQUIRE_AUTH) {
      try {
        await authenticate(req as AuthRequest);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: 'Authentication required to access documentation',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Serve OpenAPI JSON spec
    if (pathname === '/api/docs/openapi.json') {
      return new Response(JSON.stringify(this.getOpenAPISpec(), null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Serve Scalar API Reference UI
    if ((pathname === '/api/docs' || pathname === '/api/docs/') && config.DOCS_ENABLE_SCALAR) {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${config.API_TITLE} - API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <script id="api-reference" data-url="/api/docs/openapi.json"></script>
  <script>
    var configuration = {
      theme: '${config.DOCS_THEME}',
      layout: 'modern',
      darkMode: ${config.DOCS_DARK_MODE},
      searchHotKey: ${config.DOCS_ENABLE_SEARCH ? "'k'" : "null"},
      showSidebar: ${config.DOCS_SHOW_SIDEBAR},
      customCss: \`
        .scalar-api-reference {
          --scalar-font: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .dark-mode {
          --scalar-background-1: #0f0f0f;
          --scalar-background-2: #1a1a1a;
          --scalar-background-3: #252525;
        }
      \`,
      authentication: {
        preferredSecurityScheme: 'BearerAuth',
        apiKey: {
          token: ''
        }
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development Server'
        }
      ],
      defaultHttpClient: {
        targetKey: 'curl',
        clientKey: 'curl'
      }
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>
      `;

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // Serve SwaggerUI as alternative
    if (pathname === '/api/docs/swagger' && config.DOCS_ENABLE_SWAGGER) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Swagger UI - API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        }
      });
    };
  </script>
</body>
</html>
      `;

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // API collection for Postman/Insomnia
    if (pathname === '/api/docs/postman.json' && config.DOCS_ENABLE_POSTMAN) {
      const postmanCollection = this.generatePostmanCollection();
      return new Response(JSON.stringify(postmanCollection, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="api-collection.postman.json"',
        },
      });
    }

    // Markdown documentation
    if (pathname === '/api/docs/markdown' && config.DOCS_ENABLE_MARKDOWN) {
      const markdown = this.generateMarkdownDocs();
      return new Response(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return null;
  }

  private generatePostmanCollection(): any {
    const collection: any = {
      info: {
        name: config.API_TITLE,
        description: config.API_DESCRIPTION,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{access_token}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:3000',
          type: 'string',
        },
        {
          key: 'access_token',
          value: '',
          type: 'string',
        },
      ],
      item: [],
    };

    // Add authentication folder
    collection.item.push({
      name: 'Authentication',
      item: [
        {
          name: 'Login',
          event: [
            {
              listen: 'test',
              script: {
                exec: [
                  'const response = pm.response.json();',
                  'pm.collectionVariables.set("access_token", response.accessToken);',
                  'pm.collectionVariables.set("refresh_token", response.refreshToken);',
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                email: 'admin@example.com',
                password: 'admin123',
              }, null, 2),
            },
            url: '{{baseUrl}}/api/auth/login',
          },
        },
      ],
    });

    // Add model folders
    const models = apiGenerator.getRegisteredModels();
    models.forEach(modelName => {
      const plural = modelName === 'category' ? 'categories' : modelName + 's';
      const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1) + 's';
      const folder = {
        name: capitalizedName,
        item: [
          {
            name: `List ${capitalizedName}`,
            request: {
              method: 'GET',
              url: {
                raw: `{{baseUrl}}/api/${plural}?page=1&limit=10`,
                host: ['{{baseUrl}}'],
                path: ['api', plural],
                query: [
                  { key: 'page', value: '1' },
                  { key: 'limit', value: '10' },
                  { key: 'sort', value: 'createdAt', disabled: true },
                  { key: 'order', value: 'desc', disabled: true },
                  { key: 'search', value: '', disabled: true },
                ],
              },
            },
          },
          {
            name: `Get ${capitalizedName.slice(0, -1)} by ID`,
            request: {
              method: 'GET',
              url: `{{baseUrl}}/api/${plural}/:id`,
            },
          },
          {
            name: `Create ${capitalizedName.slice(0, -1)}`,
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: {
                mode: 'raw',
                raw: '{}', // Would be populated with example
              },
              url: `{{baseUrl}}/api/${plural}`,
            },
          },
          {
            name: `Update ${capitalizedName.slice(0, -1)}`,
            request: {
              method: 'PUT',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: {
                mode: 'raw',
                raw: '{}',
              },
              url: `{{baseUrl}}/api/${plural}/:id`,
            },
          },
          {
            name: `Delete ${capitalizedName.slice(0, -1)}`,
            request: {
              method: 'DELETE',
              url: `{{baseUrl}}/api/${plural}/:id`,
            },
          },
        ],
      };
      collection.item.push(folder);
    });

    return collection;
  }

  private generateMarkdownDocs(): string {
    let markdown = `# API Documentation

## Base URL
\`\`\`
http://localhost:3000
\`\`\`

## Authentication
This API uses JWT Bearer token authentication. To access protected endpoints:

1. Login via \`POST /api/auth/login\`
2. Include the token in the Authorization header: \`Bearer <token>\`

### Login
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@example.com", "password": "admin123"}'
\`\`\`

## Available Endpoints

`;

    // Add endpoints documentation
    const modelNames = apiGenerator.getRegisteredModels();
    const models = modelNames.map(modelName => ({
      name: modelName.charAt(0).toUpperCase() + modelName.slice(1) + 's',
      path: modelName === 'category' ? 'categories' : modelName + 's'
    }));

    models.forEach(model => {
      markdown += `
### ${model.name}

#### List ${model.name}
\`\`\`
GET /api/${model.path}
\`\`\`

**Query Parameters:**
- \`page\` (integer): Page number (default: 1)
- \`limit\` (integer): Items per page (default: 20, max: 100)
- \`sort\` (string): Field to sort by
- \`order\` (string): Sort order (asc/desc)
- \`search\` (string): Search term

#### Get ${model.name.slice(0, -1)} by ID
\`\`\`
GET /api/${model.path}/:id
\`\`\`

#### Create ${model.name.slice(0, -1)}
\`\`\`
POST /api/${model.path}
\`\`\`

#### Update ${model.name.slice(0, -1)}
\`\`\`
PUT /api/${model.path}/:id
\`\`\`

#### Delete ${model.name.slice(0, -1)}
\`\`\`
DELETE /api/${model.path}/:id
\`\`\`
`;
    });

    markdown += `

## Response Formats

### Success Response
\`\`\`json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
\`\`\`

## Status Codes
- \`200\` - Success
- \`201\` - Created
- \`400\` - Bad Request / Validation Error
- \`401\` - Unauthorized
- \`403\` - Forbidden
- \`404\` - Not Found
- \`409\` - Conflict
- \`500\` - Internal Server Error
`;

    return markdown;
  }
}

export const docsRouter = new DocsRouter();