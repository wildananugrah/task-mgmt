import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      isActive: true,
    },
  });

  console.log('✅ Created manager user:', manager.email);

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
      isActive: true,
    },
  });

  console.log('✅ Created regular user:', regularUser.email);

  // Create categories
  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      slug: 'electronics',
      isActive: true,
    },
  });

  const computers = await prisma.category.upsert({
    where: { slug: 'computers' },
    update: {},
    create: {
      name: 'Computers',
      description: 'Desktop and laptop computers',
      slug: 'computers',
      parentId: electronics.id,
      isActive: true,
    },
  });

  const smartphones = await prisma.category.upsert({
    where: { slug: 'smartphones' },
    update: {},
    create: {
      name: 'Smartphones',
      description: 'Mobile phones and accessories',
      slug: 'smartphones',
      parentId: electronics.id,
      isActive: true,
    },
  });

  const clothing = await prisma.category.upsert({
    where: { slug: 'clothing' },
    update: {},
    create: {
      name: 'Clothing',
      description: 'Apparel and fashion items',
      slug: 'clothing',
      isActive: true,
    },
  });

  console.log('✅ Created categories');

  // Create products
  const products = [
    {
      name: 'MacBook Pro 16"',
      description: 'High-performance laptop for professionals',
      sku: 'MBP16-2024',
      barcode: 'MBP16-2024-001',
      price: 2499.99,
      cost: 1800.00,
      quantity: 15,
      minQuantity: 5,
      unit: 'piece',
      weight: 2.0,
      dimensions: { length: 35.79, width: 24.59, height: 1.68 },
      images: ['https://example.com/macbook-pro-16.jpg'],
      tags: ['laptop', 'apple', 'professional'],
      status: 'ACTIVE' as const,
      featured: true,
      categoryId: computers.id,
      createdById: admin.id,
    },
    {
      name: 'iPhone 15 Pro',
      description: 'Latest flagship smartphone from Apple',
      sku: 'IP15P-256',
      barcode: 'IP15P-256-001',
      price: 1199.99,
      cost: 850.00,
      quantity: 30,
      minQuantity: 10,
      unit: 'piece',
      weight: 0.187,
      dimensions: { length: 14.66, width: 7.06, height: 0.82 },
      images: ['https://example.com/iphone-15-pro.jpg'],
      tags: ['smartphone', 'apple', '5G'],
      status: 'ACTIVE' as const,
      featured: true,
      categoryId: smartphones.id,
      createdById: admin.id,
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Premium Android smartphone with S Pen',
      sku: 'SGS24U-512',
      barcode: 'SGS24U-512-001',
      price: 1299.99,
      cost: 900.00,
      quantity: 25,
      minQuantity: 8,
      unit: 'piece',
      weight: 0.233,
      dimensions: { length: 16.26, width: 7.86, height: 0.89 },
      images: ['https://example.com/galaxy-s24-ultra.jpg'],
      tags: ['smartphone', 'samsung', 'android', '5G'],
      status: 'ACTIVE' as const,
      featured: true,
      categoryId: smartphones.id,
      createdById: admin.id,
    },
    {
      name: 'Dell XPS 15',
      description: 'Premium Windows laptop with OLED display',
      sku: 'DXPS15-2024',
      barcode: 'DXPS15-2024-001',
      price: 1799.99,
      cost: 1300.00,
      quantity: 10,
      minQuantity: 3,
      unit: 'piece',
      weight: 1.92,
      dimensions: { length: 34.5, width: 23.1, height: 1.8 },
      images: ['https://example.com/dell-xps-15.jpg'],
      tags: ['laptop', 'dell', 'windows'],
      status: 'ACTIVE' as const,
      featured: false,
      categoryId: computers.id,
      createdById: manager.id,
    },
    {
      name: 'Classic T-Shirt',
      description: '100% cotton comfortable t-shirt',
      sku: 'TSH-BLK-M',
      barcode: 'TSH-BLK-M-001',
      price: 29.99,
      cost: 12.00,
      quantity: 100,
      minQuantity: 20,
      unit: 'piece',
      weight: 0.2,
      images: ['https://example.com/classic-tshirt.jpg'],
      tags: ['apparel', 'casual', 'cotton'],
      status: 'ACTIVE' as const,
      featured: false,
      categoryId: clothing.id,
      createdById: manager.id,
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.create({
      data: productData,
    });

    // Create initial stock movement
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'PURCHASE',
        quantity: product.quantity,
        previousQty: 0,
        currentQty: product.quantity,
        reference: 'Initial stock',
        notes: 'Database seed',
      },
    });

    console.log(`✅ Created product: ${product.name}`);
  }

  // Create sample order
  const order = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2024-0001',
      userId: regularUser.id,
      status: 'PENDING',
      totalAmount: 1229.98,
      tax: 98.40,
      shipping: 0,
      discount: 0,
      notes: 'Sample order from database seed',
      shippingInfo: {
        name: 'John Doe',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        phone: '+1234567890',
      },
      paymentInfo: {
        method: 'CREDIT_CARD',
        status: 'PENDING',
      },
      orderItems: {
        create: [
          {
            productId: products[1].sku === 'IP15P-256'
              ? (await prisma.product.findUnique({ where: { sku: 'IP15P-256' } }))?.id!
              : '',
            quantity: 1,
            price: 1199.99,
            discount: 0,
            total: 1199.99,
          },
          {
            productId: products[4].sku === 'TSH-BLK-M'
              ? (await prisma.product.findUnique({ where: { sku: 'TSH-BLK-M' } }))?.id!
              : '',
            quantity: 1,
            price: 29.99,
            discount: 0,
            total: 29.99,
          },
        ],
      },
    },
  });

  console.log('✅ Created sample order:', order.orderNumber);

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📝 Test credentials:');
  console.log('  Admin: admin@example.com / admin123');
  console.log('  Manager: manager@example.com / manager123');
  console.log('  User: user@example.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });