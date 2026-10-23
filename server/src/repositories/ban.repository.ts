import { PrismaClient, BannedUser } from '@prisma/client';
import { db } from '../db/client.js';

export class BanRepository {
  constructor(private prisma: PrismaClient = db) {}

  async banUser(roomId: string, userId: string, bannedBy: string): Promise<BannedUser> {
    return this.prisma.bannedUser.upsert({
      where: {
        roomId_userId: { roomId, userId },
      },
      update: {
        bannedAt: new Date(),
        bannedBy,
      },
      create: {
        roomId,
        userId,
        bannedBy,
      },
    });
  }

  async isBanned(roomId: string, userId: string): Promise<boolean> {
    const ban = await this.prisma.bannedUser.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
    });
    return !!ban;
  }

  async getBannedUsers(roomId: string): Promise<BannedUser[]> {
    return this.prisma.bannedUser.findMany({
      where: { roomId },
      orderBy: { bannedAt: 'desc' },
    });
  }
}
