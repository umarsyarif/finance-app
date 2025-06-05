import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      email: 'admin@admin.com',
      name: 'Test User',
      password: '$2a$12$CAf67cw5SGRAmkPstFXTk.7cU4jvHahzkqQm9N6v/r2KfidxL77O6', // password: 'admin123'
      verified: true,
    },
  });

  console.log('👤 Created test user:', testUser.email);

  // Create test wallets
  const wallet1 = await prisma.wallet.upsert({
    where: { id: 'test-wallet-1' },
    update: {},
    create: {
      id: 'test-wallet-1',
      name: 'Main Wallet',
      balance: 1000.00,
      currency: 'USD',
      color: '#3B82F6',
      userId: testUser.id,
    },
  });

  const wallet2 = await prisma.wallet.upsert({
    where: { id: 'test-wallet-2' },
    update: {},
    create: {
      id: 'test-wallet-2',
      name: 'Savings Account',
      balance: 5000.00,
      currency: 'USD',
      color: '#10B981',
      userId: testUser.id,
    },
  });

  console.log('💰 Created test wallets:', wallet1.name, wallet2.name);

  // Create test categories
  const incomeCategories = [
    { id: 'income-salary', name: 'Salary', type: 'INCOME' as const, color: '#22C55E' },
    { id: 'income-freelance', name: 'Freelance', type: 'INCOME' as const, color: '#3B82F6' },
    { id: 'income-investment', name: 'Investment', type: 'INCOME' as const, color: '#8B5CF6' },
  ];

  const expenseCategories = [
    { id: 'expense-food', name: 'Food & Dining', type: 'EXPENSE' as const, color: '#EF4444' },
    { id: 'expense-transport', name: 'Transportation', type: 'EXPENSE' as const, color: '#F59E0B' },
    { id: 'expense-entertainment', name: 'Entertainment', type: 'EXPENSE' as const, color: '#EC4899' },
    { id: 'expense-utilities', name: 'Utilities', type: 'EXPENSE' as const, color: '#6B7280' },
    { id: 'expense-shopping', name: 'Shopping', type: 'EXPENSE' as const, color: '#F97316' },
  ];

  const allCategories = [...incomeCategories, ...expenseCategories];

  for (const category of allCategories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {},
      create: {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color,
        userId: testUser.id,
      },
    });
  }

  console.log('📂 Created test categories:', allCategories.length);

  // Create test transactions
  const transactions = [
    {
      id: 'trans-1',
      amount: 3000.00,
      description: 'Monthly Salary',
      date: new Date('2024-01-01'),
      walletId: wallet1.id,
      categoryId: 'income-salary',
      userId: testUser.id,
    },
    {
      id: 'trans-2',
      amount: 50.00,
      description: 'Lunch at restaurant',
      date: new Date('2024-01-02'),
      walletId: wallet1.id,
      categoryId: 'expense-food',
      userId: testUser.id,
    },
    {
      id: 'trans-3',
      amount: 25.00,
      description: 'Bus fare',
      date: new Date('2024-01-03'),
      walletId: wallet1.id,
      categoryId: 'expense-transport',
      userId: testUser.id,
    },
    {
      id: 'trans-4',
      amount: 500.00,
      description: 'Freelance project',
      date: new Date('2024-01-04'),
      walletId: wallet2.id,
      categoryId: 'income-freelance',
      userId: testUser.id,
    },
    {
      id: 'trans-5',
      amount: 100.00,
      description: 'Movie tickets',
      date: new Date('2024-01-05'),
      walletId: wallet1.id,
      categoryId: 'expense-entertainment',
      userId: testUser.id,
    },
  ];

  for (const transaction of transactions) {
    await prisma.transaction.upsert({
      where: { id: transaction.id },
      update: {},
      create: transaction,
    });
  }

  console.log('💸 Created test transactions:', transactions.length);

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });