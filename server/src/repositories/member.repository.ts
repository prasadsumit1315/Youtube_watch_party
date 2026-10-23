import { PrismaClient, Member, Role, AuditAction } from '@prisma/client';
import { db } from '../db/client.js';

export class MemberRepository {
  constructor(private prisma: PrismaClient = db) {}

  async upsertMember(roomId: string, userId: string, username: string, role: Role = Role.PARTICIPANT): Promise<Member> {
    return this.prisma.member.upsert({
      where: {
        roomId_userId: { roomId, userId },
      },
      update: {
        username,
        leftAt: null,
      },
      create: {
        roomId,
        userId,
        username,
        role,
      },
    });
  }

  async findByRoomAndUser(roomId: string, userId: string): Promise<Member | null> {
    return this.prisma.member.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
    });
  }

  async findByRoomId(roomId: string): Promise<Member[]> {
    return this.prisma.member.findMany({
      where: { roomId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateRole(roomId: string, userId: string, role: Role, actorUserId: string): Promise<Member> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: {
          roomId_userId: { roomId, userId },
        },
        data: { role },
      });

      await tx.auditLog.create({
        data: {
          roomId,
          actorUserId,
          action: AuditAction.ROLE_ASSIGNED,
          targetUserId: userId,
        },
      });

      return member;
    });
  }

  async markLeft(roomId: string, userId: string): Promise<Member | null> {
    try {
      return await this.prisma.member.update({
        where: {
          roomId_userId: { roomId, userId },
        },
        data: {
          leftAt: new Date(),
        },
      });
    } catch {
      return null;
    }
  }

  async removeMember(roomId: string, userId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.member.deleteMany({
        where: { roomId, userId },
      });

      await tx.auditLog.create({
        data: {
          roomId,
          actorUserId,
          action: AuditAction.MEMBER_REMOVED,
          targetUserId: userId,
        },
      });
    });
  }
}
