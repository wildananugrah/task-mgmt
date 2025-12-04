import path from 'node:path';
import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';

// Load .env file from backend root
config({ path: path.join(__dirname, '..', '.env') });

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
