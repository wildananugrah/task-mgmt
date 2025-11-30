import { apiGenerator } from '../models/configurations';
import config, { getApiServers } from '../config';
import type { ModelConfig } from './api-generator';

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export class OpenAPIGenerator {
  private modelConfigs: Map<string, ModelConfig> = new Map();

  generateOpenAPISpec(): OpenAPISchema {
    // Build contact object if any contact info is provided
    const contact: any = {};
    if (config.API_CONTACT_NAME) contact.name = config.API_CONTACT_NAME;
    if (config.API_CONTACT_EMAIL) contact.email = config.API_CONTACT_EMAIL;
    if (config.API_CONTACT_URL) contact.url = config.API_CONTACT_URL;

    const spec: OpenAPISchema = {
      openapi: '3.0.3',
      info: {
        title: config.API_TITLE,
        version: config.API_VERSION,
        description: config.API_DESCRIPTION,
        ...(Object.keys(contact).length > 0 && { contact }),
      },
      servers: getApiServers(),
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from /api/auth/login endpoint',
          },
        },
      },
      tags: [],
    };

    // Add authentication paths
    this.addAuthPaths(spec);

    // Generate paths and schemas for each model
    const models = apiGenerator.getRegisteredModels();
    models.forEach(modelName => {
      const config = apiGenerator.getModelConfig(modelName);
      if (config) {
        this.addModelPaths(spec, modelName, config);
        this.addModelSchemas(spec, modelName, config);
        spec.tags.push({
          name: this.capitalize(modelName),
          description: `${this.capitalize(modelName)} management endpoints`,
        });
      }
    });

    // Add common schemas
    this.addCommonSchemas(spec);

    return spec;
  }

  private addAuthPaths(spec: OpenAPISchema) {
    spec.tags.push({
      name: 'Authentication',
      description: 'Authentication and authorization endpoints',
    });

    spec.paths['/api/auth/login'] = {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and receive JWT tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'admin@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    example: 'admin123',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
                example: {
                  user: {
                    id: 'uuid',
                    email: 'admin@example.com',
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'ADMIN',
                  },
                  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    };

    spec.paths['/api/auth/register'] = {
      post: {
        tags: ['Authentication'],
        summary: 'User registration',
        description: 'Register a new user account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    minLength: 8,
                  },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Email already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    };

    spec.paths['/api/auth/refresh'] = {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get a new access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private addModelPaths(spec: OpenAPISchema, modelName: string, config: ModelConfig) {
    const plural = modelName === 'category' ? 'categories' : modelName + 's';
    const capitalizedName = this.capitalize(modelName);

    // GET /api/{models} - List
    spec.paths[`/api/${plural}`] = {
      get: {
        tags: [capitalizedName],
        summary: `List ${plural}`,
        description: `Get a paginated list of ${plural} with filtering and sorting`,
        security: config.permissions?.read ? [{ BearerAuth: [] }] : undefined,
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: {
              type: 'integer',
              default: config.pagination?.defaultLimit || 20,
              maximum: config.pagination?.maxLimit || 100,
            },
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Field to sort by',
            schema: {
              type: 'string',
              enum: config.sorting?.allowedFields || ['createdAt', 'updatedAt'],
              default: config.sorting?.defaultField || 'createdAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            description: 'Sort order',
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: config.sorting?.defaultOrder || 'desc',
            },
          },
          {
            name: 'search',
            in: 'query',
            description: `Search in fields: ${config.search?.fields?.join(', ') || 'name'}`,
            schema: { type: 'string' },
          },
          ...this.generateFilterParameters(modelName, config),
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${capitalizedName}` },
                    },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
                example: this.generateListExample(modelName),
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: [capitalizedName],
        summary: `Create ${modelName}`,
        description: `Create a new ${modelName}`,
        security: config.permissions?.create ? [{ BearerAuth: [] }] : undefined,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${capitalizedName}Input` },
              example: this.generateCreateExample(modelName),
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${capitalizedName}` },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    };

    // GET /api/{models}/:id - Get by ID
    spec.paths[`/api/${plural}/{id}`] = {
      get: {
        tags: [capitalizedName],
        summary: `Get ${modelName} by ID`,
        description: `Get a single ${modelName} by its ID`,
        security: config.permissions?.read ? [{ BearerAuth: [] }] : undefined,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: `${capitalizedName} ID`,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${capitalizedName}` },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: [capitalizedName],
        summary: `Update ${modelName}`,
        description: `Update an existing ${modelName}`,
        security: config.permissions?.update ? [{ BearerAuth: [] }] : undefined,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: `${capitalizedName} ID`,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${capitalizedName}UpdateInput` },
              example: this.generateUpdateExample(modelName),
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${capitalizedName}` },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: [capitalizedName],
        summary: `Delete ${modelName}`,
        description: `Delete an existing ${modelName}`,
        security: config.permissions?.delete ? [{ BearerAuth: [] }] : undefined,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: `${capitalizedName} ID`,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    id: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    };
  }

  private generateFilterParameters(modelName: string, config: ModelConfig): any[] {
    const params: any[] = [];

    if (!config.filters) return params;

    Object.entries(config.filters).forEach(([key, filterConfig]) => {
      const param: any = {
        name: key,
        in: 'query',
        description: `Filter by ${key}`,
      };

      switch (filterConfig.type) {
        case 'exact':
        case 'contains':
        case 'startsWith':
        case 'endsWith':
          param.schema = { type: 'string' };
          break;
        case 'gte':
        case 'lte':
          param.schema = { type: 'number' };
          param.description = filterConfig.type === 'gte'
            ? `Minimum ${filterConfig.field || key}`
            : `Maximum ${filterConfig.field || key}`;
          break;
        case 'boolean':
          param.schema = { type: 'boolean' };
          break;
        case 'date':
          param.schema = { type: 'string', format: 'date-time' };
          break;
        case 'in':
          param.schema = {
            type: 'array',
            items: { type: 'string' },
          };
          param.style = 'form';
          param.explode = false;
          break;
        case 'between':
          // This would need two parameters
          params.push({
            name: `${key}From`,
            in: 'query',
            description: `${key} from`,
            schema: { type: 'number' },
          });
          params.push({
            name: `${key}To`,
            in: 'query',
            description: `${key} to`,
            schema: { type: 'number' },
          });
          return;
      }

      params.push(param);
    });

    return params;
  }

  private addModelSchemas(spec: OpenAPISchema, modelName: string, config: ModelConfig) {
    const capitalizedName = this.capitalize(modelName);

    // Main model schema
    spec.components.schemas[capitalizedName] = this.generateModelSchema(modelName);

    // Input schemas
    spec.components.schemas[`${capitalizedName}Input`] = this.generateInputSchema(modelName, 'create');
    spec.components.schemas[`${capitalizedName}UpdateInput`] = this.generateInputSchema(modelName, 'update');
  }

  private generateModelSchema(modelName: string): any {
    const schemas: Record<string, any> = {
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          sku: { type: 'string' },
          barcode: { type: 'string', nullable: true },
          price: { type: 'number', format: 'float' },
          cost: { type: 'number', format: 'float', nullable: true },
          quantity: { type: 'integer' },
          minQuantity: { type: 'integer' },
          unit: { type: 'string' },
          weight: { type: 'number', nullable: true },
          dimensions: { type: 'object', nullable: true },
          images: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'] },
          featured: { type: 'boolean' },
          categoryId: { type: 'string', format: 'uuid' },
          category: { $ref: '#/components/schemas/Category' },
          stockStatus: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          slug: { type: 'string' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          isActive: { type: 'boolean' },
          productCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
          isActive: { type: 'boolean' },
          displayName: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] },
          totalAmount: { type: 'number', format: 'float' },
          tax: { type: 'number', format: 'float', nullable: true },
          shipping: { type: 'number', format: 'float', nullable: true },
          discount: { type: 'number', format: 'float', nullable: true },
          notes: { type: 'string', nullable: true },
          shippingInfo: { type: 'object', nullable: true },
          paymentInfo: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    };

    return schemas[this.capitalize(modelName)] || {};
  }

  private generateInputSchema(modelName: string, type: 'create' | 'update'): any {
    const schemas: Record<string, any> = {
      product: {
        create: {
          type: 'object',
          required: ['name', 'sku', 'price', 'categoryId'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            sku: { type: 'string', minLength: 1, maxLength: 50 },
            barcode: { type: 'string' },
            price: { type: 'number', minimum: 0 },
            cost: { type: 'number', minimum: 0 },
            quantity: { type: 'integer', minimum: 0 },
            minQuantity: { type: 'integer', minimum: 0 },
            unit: { type: 'string' },
            weight: { type: 'number', minimum: 0 },
            dimensions: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'] },
            featured: { type: 'boolean' },
            categoryId: { type: 'string', format: 'uuid' },
            metadata: { type: 'object' },
          },
        },
        update: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            barcode: { type: 'string' },
            price: { type: 'number', minimum: 0 },
            cost: { type: 'number', minimum: 0 },
            quantity: { type: 'integer', minimum: 0 },
            minQuantity: { type: 'integer', minimum: 0 },
            unit: { type: 'string' },
            weight: { type: 'number', minimum: 0 },
            dimensions: { type: 'object' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'] },
            featured: { type: 'boolean' },
            categoryId: { type: 'string', format: 'uuid' },
            metadata: { type: 'object' },
          },
        },
      },
      category: {
        create: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string' },
            slug: { type: 'string', minLength: 1, maxLength: 100 },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            isActive: { type: 'boolean' },
          },
        },
        update: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string' },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            isActive: { type: 'boolean' },
          },
        },
      },
      user: {
        create: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, maxLength: 100 },
            firstName: { type: 'string', minLength: 1, maxLength: 100 },
            lastName: { type: 'string', minLength: 1, maxLength: 100 },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
            isActive: { type: 'boolean' },
          },
        },
        update: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string', minLength: 1, maxLength: 100 },
            lastName: { type: 'string', minLength: 1, maxLength: 100 },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER'] },
            isActive: { type: 'boolean' },
            password: { type: 'string', minLength: 8, maxLength: 100 },
          },
        },
      },
      order: {
        create: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['productId', 'quantity', 'price'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantity: { type: 'integer', minimum: 1 },
                  price: { type: 'number', minimum: 0 },
                  discount: { type: 'number', minimum: 0 },
                },
              },
            },
            tax: { type: 'number', minimum: 0 },
            shipping: { type: 'number', minimum: 0 },
            discount: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
            shippingInfo: { type: 'object' },
            paymentInfo: { type: 'object' },
          },
        },
        update: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] },
            notes: { type: 'string' },
            shippingInfo: { type: 'object' },
            paymentInfo: { type: 'object' },
          },
        },
      },
    };

    return schemas[modelName]?.[type] || {};
  }

  private generateCreateExample(modelName: string): any {
    const examples: Record<string, any> = {
      product: {
        name: 'MacBook Pro 14"',
        description: 'Latest MacBook Pro with M3 chip',
        sku: 'MBP14-M3-2024',
        price: 1999.99,
        cost: 1500.00,
        quantity: 50,
        minQuantity: 10,
        unit: 'piece',
        weight: 1.6,
        dimensions: { length: 31.26, width: 22.12, height: 1.55 },
        images: ['https://example.com/mbp14.jpg'],
        tags: ['laptop', 'apple', 'professional'],
        status: 'ACTIVE',
        featured: true,
        categoryId: 'uuid-of-computers-category',
      },
      category: {
        name: 'Laptops',
        description: 'Portable computers',
        slug: 'laptops',
        parentId: 'uuid-of-computers-category',
        isActive: true,
      },
      user: {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER',
        isActive: true,
      },
      order: {
        items: [
          {
            productId: 'uuid-of-product',
            quantity: 2,
            price: 99.99,
            discount: 10.00,
          },
        ],
        tax: 17.99,
        shipping: 5.00,
        discount: 10.00,
        notes: 'Please gift wrap',
        shippingInfo: {
          name: 'John Doe',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
      },
    };

    return examples[modelName] || {};
  }

  private generateUpdateExample(modelName: string): any {
    const examples: Record<string, any> = {
      product: {
        name: 'MacBook Pro 14" Updated',
        price: 1899.99,
        quantity: 45,
        status: 'ACTIVE',
      },
      category: {
        name: 'Premium Laptops',
        description: 'High-end portable computers',
        isActive: true,
      },
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'MANAGER',
      },
      order: {
        status: 'PROCESSING',
        notes: 'Order confirmed, preparing for shipment',
      },
    };

    return examples[modelName] || {};
  }

  private generateListExample(modelName: string): any {
    const item = this.generateCreateExample(modelName);
    return {
      data: [
        { id: 'uuid-1', ...item, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'uuid-2', ...item, createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      },
    };
  }

  private addCommonSchemas(spec: OpenAPISchema) {
    spec.components.schemas.Pagination = {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 100 },
        totalPages: { type: 'integer', example: 5 },
      },
    };

    spec.components.schemas.Error = {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        code: { type: 'string' },
      },
    };

    spec.components.schemas.ValidationError = {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Validation Error' },
        message: { type: 'string', example: 'Invalid input data' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const openAPIGenerator = new OpenAPIGenerator();