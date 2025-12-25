import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { settings } from './settings.server';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = settings.DATABASE_URL;
  
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: settings.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Prevent multiple instances of Prisma Client in development
const prisma = globalThis.__prisma ?? createPrismaClient();

if (settings.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { prisma };
