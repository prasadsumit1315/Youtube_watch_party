import { describe, it, expect, vi } from 'vitest';
import { RoomRepository } from '../src/repositories/room.repository.js';
import { BanRepository } from '../src/repositories/ban.repository.js';
import { MemberRepository } from '../src/repositories/member.repository.js';
import { Role, AuditAction } from '@prisma/client';

describe('Repositories Unit Tests', () => {
  it('RoomRepository.createRoomWithHost calls $transaction and creates room, member, and audit', async () => {
    const mockTx = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-1',
          code: 'TESTCODE',
          hostUserId: 'user-1',
          currentVideoId: 'video-123',
        }),
      },
      member: {
        create: vi.fn().mockResolvedValue({
          id: 'mem-1',
          roomId: 'room-1',
          userId: 'user-1',
          username: 'HostUser',
          role: Role.HOST,
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: 'audit-1',
          roomId: 'room-1',
          actorUserId: 'user-1',
          action: AuditAction.ROOM_CREATED,
        }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    } as any;

    const repo = new RoomRepository(mockPrisma);
    const room = await repo.createRoomWithHost({
      code: 'TESTCODE',
      hostUserId: 'user-1',
      hostUsername: 'HostUser',
      currentVideoId: 'video-123',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockTx.room.create).toHaveBeenCalled();
    expect(mockTx.member.create).toHaveBeenCalled();
    expect(mockTx.auditLog.create).toHaveBeenCalled();
    expect(room.id).toBe('room-1');
  });

  it('BanRepository.isBanned checks bannedUser properly', async () => {
    const mockPrisma = {
      bannedUser: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 'ban-1',
          roomId: 'room-1',
          userId: 'banned-user',
        }).mockResolvedValueOnce(null),
      },
    } as any;

    const banRepo = new BanRepository(mockPrisma);
    const banned = await banRepo.isBanned('room-1', 'banned-user');
    expect(banned).toBe(true);

    const notBanned = await banRepo.isBanned('room-1', 'good-user');
    expect(notBanned).toBe(false);
  });

  it('MemberRepository.updateRole creates audit log and updates member', async () => {
    const mockTx = {
      member: {
        update: vi.fn().mockResolvedValue({
          id: 'mem-2',
          roomId: 'room-1',
          userId: 'user-2',
          role: Role.MODERATOR,
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: 'audit-2',
        }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
    } as any;

    const memberRepo = new MemberRepository(mockPrisma);
    const res = await memberRepo.updateRole('room-1', 'user-2', Role.MODERATOR, 'host-1');

    expect(res.role).toBe(Role.MODERATOR);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        roomId: 'room-1',
        actorUserId: 'host-1',
        action: AuditAction.ROLE_ASSIGNED,
        targetUserId: 'user-2',
      },
    });
  });
});
