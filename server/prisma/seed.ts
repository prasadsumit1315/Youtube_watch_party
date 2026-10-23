import { db } from '../src/db/client.js';
import { Role, AuditAction } from '@prisma/client';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('Seeding database with sample demo room...');

  const hostUserId = 'a0000000-0000-0000-0000-000000000001';
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Check if demo room already exists
  const existing = await db.room.findUnique({
    where: { code: 'DEMO2026' },
  });

  if (!existing) {
    await db.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          code: 'DEMO2026',
          currentVideoId: 'dQw4w9WgXcQ',
          hostUserId,
          expiresAt,
        },
      });

      await tx.member.create({
        data: {
          roomId: room.id,
          userId: hostUserId,
          username: 'DemoHost',
          role: Role.HOST,
        },
      });

      await tx.auditLog.create({
        data: {
          roomId: room.id,
          actorUserId: hostUserId,
          action: AuditAction.ROOM_CREATED,
        },
      });

      logger.info({ roomId: room.id, code: room.code }, 'Created sample demo room');
    });
  } else {
    logger.info('Sample demo room already exists');
  }
}

main()
  .catch((e) => {
    logger.error({ error: (e as Error).message }, 'Seeding failed');
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
