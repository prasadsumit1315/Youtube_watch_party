import { PrismaClient, Room, Role, AuditAction } from '@prisma/client';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface CreateRoomInput {
  id?: string;
  code: string;
  hostUserId: string;
  hostUsername: string;
  currentVideoId?: string;
  expiresInHours?: number;
}

export class RoomRepository {
  constructor(private prisma: PrismaClient = db) {}

  /**
   * Atomic multi-step transaction to create room, host member, and audit log.
   */
  async createRoomWithHost(input: CreateRoomInput): Promise<Room> {
    const hours = input.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          id: input.id,
          code: input.code,
          currentVideoId: input.currentVideoId ?? null,
          hostUserId: input.hostUserId,
          expiresAt,
        },
      });

      await tx.member.create({
        data: {
          roomId: room.id,
          userId: input.hostUserId,
          username: input.hostUsername,
          role: Role.HOST,
        },
      });

      await tx.auditLog.create({
        data: {
          roomId: room.id,
          actorUserId: input.hostUserId,
          action: AuditAction.ROOM_CREATED,
        },
      });

      return room;
    });
  }

  async findByCode(code: string): Promise<Room | null> {
    return this.prisma.room.findUnique({
      where: { code },
    });
  }

  async findById(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({
      where: { id },
      include: {
        members: true,
        bannedUsers: true,
      },
    });
  }

  async updateCurrentVideo(id: string, videoId: string, actorUserId?: string): Promise<Room> {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.update({
        where: { id },
        data: {
          currentVideoId: videoId,
          lastActiveAt: new Date(),
        },
      });

      if (actorUserId) {
        await tx.auditLog.create({
          data: {
            roomId: id,
            actorUserId,
            action: AuditAction.VIDEO_CHANGED,
          },
        });
      }

      return room;
    });
  }

  /**
   * Atomic transaction for host transfer:
   * 1. Update room hostUserId
   * 2. Demote current host to MODERATOR
   * 3. Promote target user to HOST
   * 4. Audit log HOST_TRANSFERRED
   */
  async transferHost(
    roomId: string,
    currentHostUserId: string,
    newHostUserId: string
  ): Promise<Room> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Demote old host
      await tx.member.update({
        where: {
          roomId_userId: {
            roomId,
            userId: currentHostUserId,
          },
        },
        data: { role: Role.MODERATOR },
      });

      // 2. Promote new host
      await tx.member.update({
        where: {
          roomId_userId: {
            roomId,
            userId: newHostUserId,
          },
        },
        data: { role: Role.HOST },
      });

      // 3. Update room hostUserId
      const room = await tx.room.update({
        where: { id: roomId },
        data: {
          hostUserId: newHostUserId,
          lastActiveAt: new Date(),
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          roomId,
          actorUserId: currentHostUserId,
          action: AuditAction.HOST_TRANSFERRED,
          targetUserId: newHostUserId,
        },
      });

      return room;
    });
  }

  async touchActivity(id: string, extendHours: number = 24): Promise<void> {
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + extendHours * 60 * 60 * 1000);
    await this.prisma.room.update({
      where: { id },
      data: {
        lastActiveAt: now,
        expiresAt: newExpiresAt,
      },
    });
  }

  async deleteExpiredRooms(): Promise<number> {
    const result = await this.prisma.room.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    logger.info({ count: result.count }, 'Deleted expired rooms');
    return result.count;
  }
}
