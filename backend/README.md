# API Generic - Schema-Driven REST & GraphQL API Generator

A powerful Bun.js application that automatically generates REST and GraphQL APIs based on your Prisma database schema. Simply define your schema and configurations, and the system creates fully-featured APIs with authentication, validation, pagination, filtering, and more.

## Features

### Core Capabilities
- **Automatic API Generation**: APIs are generated dynamically based on Prisma schema
- **Dual API Support**: Both REST and GraphQL endpoints from the same codebase
- **Schema-Driven Development**: Add new models to schema, configure validation, and APIs are automatically available
- **Full CRUD Operations**: Create, Read, Update, Delete for all models
- **Authentication & Authorization**: JWT-based auth with role-based access control (RBAC)
- **Advanced Querying**: Pagination, filtering, sorting, and search out of the box
- **Validation**: Zod-based input validation with customizable schemas
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Database Agnostic**: Works with PostgreSQL (can be extended to other databases)

### Model Features
Each model automatically gets:
- RESTful endpoints (`GET`, `POST`, `PUT`, `DELETE`)
- GraphQL queries and mutations
- Pagination with customizable page sizes
- Multi-field search capabilities
- Flexible filtering options
- Sorting by any field
- Input validation
- Permission-based access control
- Lifecycle hooks (before/after create, update, delete)
- Custom data transformations

## Quick Start

### Prerequisites
- Bun.js installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL database (or use Docker)
- Node.js 18+ (for some tooling compatibility)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd 76-api-generic
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start PostgreSQL (if using Docker):
```bash
cd database
docker-compose up -d
cd ..
```

5. Run database migrations:
```bash
bunx prisma generate
bunx prisma migrate dev
```

6. Seed the database (optional):
```bash
bun run db:seed
```

7. Start the development server:
```bash
bun run dev
```

The API will be available at:
- REST API: http://localhost:3000
- GraphQL: http://localhost:3001/graphql
- API Docs: http://localhost:3000/api/docs

## Adding New Models

The system is designed to make adding new endpoints as simple as possible:

### Step 1: Add Model to Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
model Article {
  id        String   @id @default(uuid())
  title     String
  content   String?
  slug      String   @unique
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("articles")
}
```

### Step 2: Create Model Configuration

Create `src/models/configurations/article.config.ts`:

```typescript
import { z } from 'zod';
import type { ModelConfig } from '../../utils/api-generator';

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  slug: z.string().min(1).max(200),
  published: z.boolean().default(false),
});

export const articleConfig: ModelConfig = {
  name: 'article',
  model: prisma.article,
  validation: {
    create: createArticleSchema,
    update: createArticleSchema.partial(),
  },
  permissions: {
    create: ['ADMIN', 'MANAGER'],
    read: ['ADMIN', 'MANAGER', 'USER'],
    update: ['ADMIN', 'MANAGER'],
    delete: ['ADMIN'],
  },
  search: {
    fields: ['title', 'content'],
    fuzzy: true,
  },
  filters: {
    published: { type: 'boolean' },
    authorId: { type: 'exact' },
  },
};
```

### Step 3: Register the Model

Add to `src/models/configurations/index.ts`:

```typescript
import { articleConfig } from './article.config';

export const registerAllModels = () => {
  // ... existing models
  apiGenerator.registerModel(articleConfig);
};
```

### Step 4: Run Migrations & Restart

```bash
bunx prisma migrate dev
bun run dev
```

That's it! Your new endpoints are automatically available:
- REST: `/api/articles`
- GraphQL: Query `articles`, Mutation `createArticle`, etc.

## API Documentation

### Authentication

#### Login
```bash
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### Register
```bash
POST /api/auth/register
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

### REST API Examples

#### Get Products with Filtering
```bash
GET /api/products?page=1&limit=10&sort=price&order=desc&categoryId=uuid&minPrice=100&maxPrice=1000
```

#### Create Product
```bash
POST /api/products
Authorization: Bearer <token>
{
  "name": "New Product",
  "sku": "SKU-001",
  "price": 99.99,
  "categoryId": "category-uuid"
}
```

### GraphQL Examples

#### Query Products
```graphql
query {
  products(filter: {
    search: "laptop",
    minPrice: 500,
    maxPrice: 2000,
    page: 1,
    limit: 10
  }) {
    data {
      id
      name
      price
      category {
        name
      }
    }
    pagination {
      total
      totalPages
    }
  }
}
```

#### Create Order
```graphql
mutation {
  createOrder(input: {
    items: [{
      productId: "product-uuid",
      quantity: 2,
      price: 99.99
    }],
    shippingInfo: {
      name: "John Doe",
      address: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA"
    }
  }) {
    id
    orderNumber
    totalAmount
  }
}
```

## Configuration Options

### Model Configuration

Each model can be configured with:

```typescript
{
  name: string,                    // Model name (lowercase)
  model: PrismaModel,              // Prisma model reference
  validation?: {                   // Zod schemas for validation
    create?: ZodSchema,
    update?: ZodSchema,
    query?: ZodSchema,
  },
  transform?: {                    // Data transformation functions
    input?: (data) => data,        // Transform before save
    output?: (data) => data,       // Transform before response
  },
  permissions?: {                  // Role-based permissions
    create?: string[],
    read?: string[],
    update?: string[],
    delete?: string[],
  },
  hooks?: {                        // Lifecycle hooks
    beforeCreate?: async (data) => data,
    afterCreate?: async (data) => void,
    beforeUpdate?: async (id, data) => data,
    afterUpdate?: async (data) => void,
    beforeDelete?: async (id) => void,
    afterDelete?: async (id) => void,
  },
  relations?: {                    // Include related data
    include?: {},
    select?: {},
  },
  search?: {                       // Search configuration
    fields?: string[],
    fuzzy?: boolean,
  },
  pagination?: {                   // Pagination settings
    defaultLimit?: number,
    maxLimit?: number,
  },
  sorting?: {                      // Sorting configuration
    defaultField?: string,
    defaultOrder?: 'asc' | 'desc',
    allowedFields?: string[],
  },
  filters?: {                      // Custom filters
    [key: string]: {
      type: 'exact' | 'contains' | 'gte' | 'lte' | 'boolean' | 'date',
      field?: string,
    }
  },
}
```

## Project Structure

```
76-api-generic/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── index.ts           # Environment config
│   │   └── database.ts        # Prisma client
│   ├── models/
│   │   └── configurations/    # Model configurations
│   │       ├── product.config.ts
│   │       ├── category.config.ts
│   │       ├── user.config.ts
│   │       └── order.config.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts           # Authentication
│   │   └── error-handler.ts  # Error handling
│   ├── routes/               # API routes
│   │   ├── api.router.ts    # REST API router
│   │   └── auth.router.ts   # Auth endpoints
│   ├── graphql/              # GraphQL setup
│   │   ├── schema.ts        # Type definitions
│   │   └── resolvers.ts     # Resolvers
│   ├── utils/                # Utility functions
│   │   ├── api-generator.ts # Core API generator
│   │   └── jwt.ts           # JWT utilities
│   ├── types/                # TypeScript types
│   └── server.ts             # Main server file
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts              # Seed script
├── database/                 # Database Docker setup
└── .env                     # Environment variables
```

## Scripts

```bash
# Development
bun run dev              # Start dev server with hot reload
bun run start           # Start production server

# Database
bun run db:generate     # Generate Prisma client
bun run db:migrate      # Run migrations
bun run db:push        # Push schema changes
bun run db:seed        # Seed database
bun run db:studio      # Open Prisma Studio
bun run db:reset       # Reset database

# Docker
bun run docker:up      # Start containers
bun run docker:down    # Stop containers
bun run docker:logs    # View logs

# Build
bun run build          # Build for production
```

## Testing

Test credentials (after seeding):
- Admin: `admin@example.com` / `admin123`
- Manager: `manager@example.com` / `manager123`
- User: `user@example.com` / `user123`

## Security Features

- JWT-based authentication
- Role-based access control (ADMIN, MANAGER, USER)
- Password hashing with bcrypt
- Input validation with Zod
- SQL injection prevention via Prisma
- Rate limiting ready (configure in middleware)
- CORS configuration

## Performance Features

- Efficient pagination
- Database query optimization
- Selective field loading
- Relationship lazy loading
- Connection pooling
- Bun.js runtime performance

## Extending the System

### Adding Custom Endpoints

While the system auto-generates endpoints, you can add custom ones:

```typescript
// src/routes/custom.router.ts
export class CustomRouter {
  async customEndpoint(req: Request): Promise<Response> {
    // Custom logic here
  }
}
```

### Adding New Filter Types

Extend the filter types in `api-generator.ts`:

```typescript
case 'customFilter':
  // Your custom filter logic
  break;
```

### Adding GraphQL Subscriptions

The schema includes subscription types - implement them using GraphQL subscriptions with WebSocket support.

## Deployment

### Using Docker

```bash
docker-compose up -d
```

### Manual Deployment

1. Build the application:
```bash
bun run build
```

2. Set production environment variables
3. Run migrations on production database
4. Start the server:
```bash
NODE_ENV=production bun run dist/server.js
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify network connectivity

### Migration Issues
```bash
bunx prisma migrate reset  # Reset database
bunx prisma generate       # Regenerate client
```

### Type Issues
```bash
bun run db:generate  # Regenerate Prisma types
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your model configuration
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.