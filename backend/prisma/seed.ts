import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import path from 'path';

const { Pool } = pkg;

// Load environment variables
config({ path: path.join(__dirname, '..', '.env') });

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('p@ssw0rd', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mail.com' },
    update: {},
    create: {
      email: 'admin@mail.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create manager user
  const managerPassword = await bcrypt.hash('p@ssw0rd', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@mail.com' },
    update: {},
    create: {
      email: 'manager@mail.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      isActive: true,
    },
  });

  console.log('✅ Created manager user:', manager.email);

  // Create regular user
  const userPassword = await bcrypt.hash('p@ssw0rd', 10);
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@mail.com' },
    update: {},
    create: {
      email: 'user@mail.com',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
      isActive: true,
    },
  });

  console.log('✅ Created regular user:', regularUser.email);

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('  Admin: admin@mail.com / p@ssw0rd');
  console.log('  Manager: manager@mail.com / p@ssw0rd');
  console.log('  User: user@mail.com / p@ssw0rd');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });