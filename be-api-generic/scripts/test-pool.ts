#!/usr/bin/env bun

import config from '../src/config';
import prisma from '../src/config/database';

async function testConnectionPool() {
  console.log('🔍 Testing Database Connection Pool Configuration...\n');

  console.log('📊 Pool Configuration:');
  console.log(`  - Min Connections: ${config.DATABASE_POOL_MIN}`);
  console.log(`  - Max Connections: ${config.DATABASE_POOL_MAX}`);
  console.log(`  - Pool Timeout: ${config.DATABASE_POOL_TIMEOUT}ms (${config.DATABASE_POOL_TIMEOUT / 1000}s)\n`);

  try {
    // Test basic connection
    console.log('✓ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');

    // Test concurrent connections
    console.log('🔄 Testing concurrent connections...');
    const promises = [];
    const concurrentCount = 10;

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        prisma.user.count().then((count) => {
          console.log(`  ✓ Connection ${i + 1}: User count = ${count}`);
          return count;
        })
      );
    }

    const results = await Promise.all(promises);
    console.log(`✅ Successfully executed ${concurrentCount} concurrent queries!\n`);

    // Note: The connection pool is configured via URL parameters:
    // - connection_limit=${config.DATABASE_POOL_MAX} (max connections)
    // - pool_timeout=${config.DATABASE_POOL_TIMEOUT / 1000}s (timeout in seconds)
    console.log('📈 Connection Pool Configuration Applied:');
    console.log(`  - Maximum connections in pool: ${config.DATABASE_POOL_MAX}`);
    console.log(`  - Connection timeout: ${config.DATABASE_POOL_TIMEOUT}ms`);
    console.log('  ℹ️  Note: PostgreSQL manages the pool size dynamically');

  } catch (error) {
    console.error('❌ Error testing connection pool:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Test completed and disconnected from database');
  }
}

// Run the test
testConnectionPool().catch(console.error);