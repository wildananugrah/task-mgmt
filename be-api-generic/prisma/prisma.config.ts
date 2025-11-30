/**
 * Prisma 7 Configuration File
 *
 * This file is used for Prisma CLI commands (migrate, generate, etc.)
 * Runtime database connection is handled via adapter in src/config/database.ts
 */

export default {
  schema: './schema.prisma',
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};
