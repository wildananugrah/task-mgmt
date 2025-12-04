import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;
import config from './index';

const prismaClientSingleton = () => {
  // Build database URL with connection pool parameters
  const baseUrl = config.DATABASE_URL;
  const url = new URL(baseUrl);

  // Add connection pool parameters
  url.searchParams.set('connection_limit', config.DATABASE_POOL_MAX.toString());
  url.searchParams.set('pool_timeout', (config.DATABASE_POOL_TIMEOUT / 1000).toString());

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: url.toString(),
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: config.DATABASE_POOL_TIMEOUT,
    connectionTimeoutMillis: config.DATABASE_POOL_TIMEOUT,
  });

  // Create Prisma adapter
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (config.NODE_ENV !== 'production') globalThis.prisma = prisma;