import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    const gracefulShutdown = async () => {
      logger.info('Disconnecting Prisma client...');
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Prisma client disconnected');
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  return prisma;
}

export const db = getPrismaClient();
