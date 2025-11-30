import { PrismaClient } from '@prisma/client';
import config from './index';

const prismaClientSingleton = () => {
  // Build database URL with connection pool parameters
  const baseUrl = config.DATABASE_URL;
  const url = new URL(baseUrl);

  // Add connection pool parameters to the URL
  url.searchParams.set('connection_limit', config.DATABASE_POOL_MAX.toString());
  url.searchParams.set('pool_timeout', (config.DATABASE_POOL_TIMEOUT / 1000).toString()); // Convert ms to seconds

  // Note: Prisma doesn't directly support min pool size for PostgreSQL
  // The connection_limit sets the maximum number of connections

  return new PrismaClient({
    datasources: {
      db: {
        url: url.toString(),
      },
    },
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (config.NODE_ENV !== 'production') globalThis.prisma = prisma;