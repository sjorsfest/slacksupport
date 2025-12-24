import pkg from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a demo account
  const account = await prisma.account.upsert({
    where: { id: 'demo-account' },
    update: {},
    create: {
      id: 'demo-account',
      name: 'Demo Company',
      allowedDomains: ['localhost', '127.0.0.1'],
    },
  });

  console.log('Created account:', account.name);

  // Create a demo user
  const passwordHash = await bcrypt.hash('demo123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      accountId: account.id,
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
      role: 'admin',
    },
  });

  console.log('Created user:', user.email);

  // Create default widget config
  await prisma.widgetConfig.upsert({
    where: { accountId: account.id },
    update: {},
    create: {
      accountId: account.id,
      primaryColor: '#4A154B',
      accentColor: '#1264A3',
      greetingText: 'Hi! How can we help you today?',
      companyName: 'Demo Company',
    },
  });

  console.log('Created widget config');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

