import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string(),

  // Database Connection Pool Settings
  DATABASE_POOL_MIN: z.string().default('50').transform(Number),
  DATABASE_POOL_MAX: z.string().default('200').transform(Number),
  DATABASE_POOL_TIMEOUT: z.string().default('15000').transform(Number),

  // JWT
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRE_TIME: z.string().default('15m'),
  JWT_REFRESH_EXPIRE_TIME: z.string().default('7d'),

  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.string().default('10').transform(Number),

  // Pagination
  DEFAULT_PAGE_SIZE: z.string().default('20').transform(Number),
  MAX_PAGE_SIZE: z.string().default('100').transform(Number),

  // API Documentation
  API_TITLE: z.string().default('Auto-Generated API'),
  API_VERSION: z.string().default('1.0.0'),
  API_DESCRIPTION: z.string().default('REST and GraphQL API automatically generated from database schema'),
  API_CONTACT_NAME: z.string().optional(),
  API_CONTACT_EMAIL: z.string().email().optional(),
  API_CONTACT_URL: z.string().url().optional(),

  // Documentation Servers
  API_SERVERS: z.string().default('http://localhost:3000'),
  API_SERVER_DESCRIPTIONS: z.string().default('Development server'),

  // Documentation UI
  DOCS_THEME: z.string().default('purple'),
  DOCS_DARK_MODE: z.string().default('true').transform(v => v === 'true'),
  DOCS_SHOW_SIDEBAR: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_SEARCH: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_TRY_IT: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_SWAGGER: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_SCALAR: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_POSTMAN: z.string().default('true').transform(v => v === 'true'),
  DOCS_ENABLE_MARKDOWN: z.string().default('true').transform(v => v === 'true'),

  // Documentation Security
  DOCS_HIDE_IN_PRODUCTION: z.string().default('false').transform(v => v === 'true'),
  DOCS_REQUIRE_AUTH: z.string().default('false').transform(v => v === 'true'),

  // Logging and Monitoring
  LOKI_URL: z.string().optional().default('http://localhost:3100'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().default('true').transform(v => v === 'true'),
  ENABLE_RESPONSE_LOGGING: z.string().default('true').transform(v => v === 'true'),
  LOG_SENSITIVE_DATA: z.string().default('false').transform(v => v === 'true'),

  // File Storage Configuration
  ENABLE_FILE_STORAGE: z.string().default('true').transform(v => v === 'true'),
  STORAGE_PROVIDER: z.enum(['minio']).optional().default('minio'),

  // MinIO Configuration
  MINIO_ENDPOINT: z.string().optional().default('localhost'),
  MINIO_PORT: z.string().optional().default('9000').transform(v => v ? Number(v) : 9000),
  MINIO_USE_SSL: z.string().optional().default('false').transform(v => v === 'true'),
  MINIO_ACCESS_KEY: z.string().optional().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().optional().default('minioadmin123'),
  MINIO_BUCKET_NAME: z.string().optional().default('task-mgmt-uploads'),
  MINIO_REGION: z.string().optional().default('us-east-1'),

  // File Upload Configuration
  MAX_FILE_SIZE: z.string().optional().default('10485760').transform(v => v ? Number(v) : 10485760), // 10MB default
  ALLOWED_FILE_TYPES: z.string().optional().default('image/jpeg,image/png,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  FILE_UPLOAD_PATH: z.string().optional().default('/uploads'),
});

export const config = envSchema.parse(process.env);

// Helper to parse comma-separated server lists
export const getApiServers = () => {
  const servers = config.API_SERVERS.split(',').map(s => s.trim());
  const descriptions = config.API_SERVER_DESCRIPTIONS.split(',').map(d => d.trim());

  return servers.map((url, index) => ({
    url,
    description: descriptions[index] || 'API Server'
  }));
};

export default config;