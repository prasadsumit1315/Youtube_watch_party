import { PrismaClient, AuditLog, AuditAction } from '@prisma/client';
import { db } from '../db/client.js';

export class AuditRepository {
  constructor(private prisma: PrismaClient = db) {}

  async log(
    roomId: string,
    actorUserId: string,
    action: AuditAction,
    targetUserId?: string
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        roomId,
        actorUserId,
        action,
        targetUserId,
      },
    });
  }

  async getRoomLogs(roomId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
