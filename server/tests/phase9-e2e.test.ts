import { describe, it, expect, vi } from 'vitest';
import { PermissionPolicy } from '../src/domain/permissions.js';
import { Room } from '../src/domain/room.js';
import { Participant } from '../src/domain/participant.js';
import { RoomManager } from '../src/domain/room-manager.js';
import { RoomRepository } from '../src/repositories/room.repository.js';
import { BanRepository } from '../src/repositories/ban.repository.js';
import { Role, AuditAction } from '@prisma/client';

describe('Phase 9: Comprehensive Test Suite', () => {
  // 1. PermissionPolicy Edge Cases
  describe('1. PermissionPolicy Comprehensive Verification', () => {
    it('Strictly denies PARTICIPANTS from mutating playback state', () => {
      const participantId = 'user-p1';
      expect(
        PermissionPolicy.can('PLAY', { actorRole: Role.PARTICIPANT, actorUserId: participantId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('PAUSE', { actorRole: Role.PARTICIPANT, actorUserId: participantId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('SEEK', { actorRole: Role.PARTICIPANT, actorUserId: participantId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('CHANGE_VIDEO', { actorRole: Role.PARTICIPANT, actorUserId: participantId })
      ).toBe(false);
    });

    it('Allows MODERATORS playback control but forbids destructive actions', () => {
      const modId = 'user-mod';
      const targetId = 'user-target';

      // Allowed
      expect(PermissionPolicy.can('PLAY', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);
      expect(PermissionPolicy.can('PAUSE', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);
      expect(PermissionPolicy.can('SEEK', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);
      expect(PermissionPolicy.can('CHANGE_VIDEO', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);
      expect(PermissionPolicy.can('APPROVE_REQUEST', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);
      expect(PermissionPolicy.can('REJECT_REQUEST', { actorRole: Role.MODERATOR, actorUserId: modId })).toBe(true);

      // Forbidden
      expect(
        PermissionPolicy.can('ASSIGN_ROLE', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: targetId,
          newRole: Role.PARTICIPANT,
        })
      ).toBe(false);
      expect(
        PermissionPolicy.can('REMOVE_PARTICIPANT', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: targetId,
        })
      ).toBe(false);
      expect(
        PermissionPolicy.can('TRANSFER_HOST', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: targetId,
        })
      ).toBe(false);
    });

    it('Forbids HOST from removing or demoting self or promoting another user to HOST via ASSIGN_ROLE', () => {
      const hostId = 'user-host';
      const otherUser = 'user-other';

      // Cannot remove self
      expect(
        PermissionPolicy.can('REMOVE_PARTICIPANT', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: hostId,
          targetUserRole: Role.HOST,
        })
      ).toBe(false);

      // Cannot assign HOST role via ASSIGN_ROLE (must use TRANSFER_HOST)
      expect(
        PermissionPolicy.can('ASSIGN_ROLE', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: otherUser,
          newRole: Role.HOST,
        })
      ).toBe(false);
    });
  });

  // 2. Room State & Drift Calculation
  describe('2. Room State and Live Time Calculation', () => {
    it('Accurately tracks elapsed time while playing and locks time on pause', async () => {
      const room = new Room({
        id: 'r-test',
        code: 'TESTROOM',
        hostUserId: 'h-1',
        initialVideoId: 'video123',
      });

      expect(room.state.playState).toBe('PAUSED');
      expect(room.getLiveTime()).toBe(0);

      // Play at 30 seconds
      room.applyPlay(30);
      expect(room.state.playState).toBe('PLAYING');
      expect(room.getLiveTime()).toBeGreaterThanOrEqual(30);

      // Advance by small delay
      await new Promise((r) => setTimeout(r, 50));
      const liveTime = room.getLiveTime();
      expect(liveTime).toBeGreaterThanOrEqual(30.04);

      // Pause at current live time
      room.applyPause(liveTime);
      expect(room.state.playState).toBe('PAUSED');
      const pausedTime = room.getLiveTime();
      await new Promise((r) => setTimeout(r, 30));
      // In paused state, time does NOT advance
      expect(room.getLiveTime()).toBe(pausedTime);
    });
  });

  // 3. Transfer Host Atomicity
  describe('3. Transfer Host Atomicity', () => {
    it('Atomically executes host transfer in DB and updates roles', async () => {
      const mockTx = {
        member: {
          update: vi.fn().mockResolvedValue({}),
        },
        room: {
          update: vi.fn().mockResolvedValue({
            id: 'room-1',
            hostUserId: 'user-new-host',
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb) => cb(mockTx)),
      } as any;

      const roomRepo = new RoomRepository(mockPrisma);
      await roomRepo.transferHost('room-1', 'user-old-host', 'user-new-host');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify old host demoted to MODERATOR
      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room-1', userId: 'user-old-host' } },
        data: { role: Role.MODERATOR },
      });

      // Verify new host promoted to HOST
      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room-1', userId: 'user-new-host' } },
        data: { role: Role.HOST },
      });

      // Verify room record updated
      expect(mockTx.room.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { hostUserId: 'user-new-host', lastActiveAt: expect.any(Date) },
      });

      // Verify audit log created
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          actorUserId: 'user-old-host',
          action: AuditAction.HOST_TRANSFERRED,
          targetUserId: 'user-new-host',
        },
      });
    });
  });

  // 4. Hydration After Server Restart
  describe('4. Hydration After Server Restart', () => {
    it('Hydrates room from DB into fresh in-memory manager with paused state at 0', async () => {
      const mockRoomRepo = {
        findByCode: vi.fn().mockResolvedValue({
          id: 'room-restart-id',
          code: 'HYDRATE1',
          hostUserId: 'h-persisted',
          currentVideoId: 'youtube-xyz',
          expiresAt: new Date(Date.now() + 10000000),
        }),
        deleteExpiredRooms: vi.fn(),
      } as any;

      const mockBanRepo = {
        getBannedUsers: vi.fn().mockResolvedValue([
          { userId: 'banned-troll-1', bannedBy: 'h-persisted' },
        ]),
      } as any;

      // Fresh room manager simulates server restart
      const freshRoomManager = new RoomManager(mockRoomRepo, undefined, mockBanRepo);
      const hydratedRoom = await freshRoomManager.hydrateFromDB('HYDRATE1');

      expect(hydratedRoom).toBeDefined();
      expect(hydratedRoom?.id).toBe('room-restart-id');
      expect(hydratedRoom?.code).toBe('HYDRATE1');
      expect(hydratedRoom?.hostUserId).toBe('h-persisted');
      expect(hydratedRoom?.state.videoId).toBe('youtube-xyz');

      // SPEC: "Playback resets to paused at 0"
      expect(hydratedRoom?.state.playState).toBe('PAUSED');
      expect(hydratedRoom?.state.currentTime).toBe(0);

      // Verify banned users were hydrated into memory
      expect(hydratedRoom?.isBanned('banned-troll-1')).toBe(true);
    });
  });

  // 5. Banned User Cannot Rejoin
  describe('5. Banned User Cannot Rejoin', () => {
    it('Detects banned user from both in-memory set and DB ban repository', async () => {
      const room = new Room({
        id: 'r-ban-check',
        code: 'BANCHECK',
        hostUserId: 'h-1',
      });

      room.banUser('bad-actor-99');
      expect(room.isBanned('bad-actor-99')).toBe(true);
      expect(room.isBanned('good-actor-1')).toBe(false);

      // Verify BanRepository isBanned returns true
      const mockPrisma = {
        bannedUser: {
          findUnique: vi.fn().mockResolvedValue({
            roomId: 'r-ban-check',
            userId: 'bad-actor-99',
          }),
        },
      } as any;

      const banRepo = new BanRepository(mockPrisma);
      const isBanned = await banRepo.isBanned('r-ban-check', 'bad-actor-99');
      expect(isBanned).toBe(true);
    });
  });

  // 6. Cleanup Job (Empty Rooms & Expired Rooms)
  describe('6. Cleanup Job Verification', () => {
    it('Evicts rooms that have been empty for > 10 minutes from memory', () => {
      const roomManager = new RoomManager();
      const emptyRoom = new Room({
        id: 'empty-room-1',
        code: 'EMPTY111',
        hostUserId: 'h-none',
      });

      // Simulate room being empty since 11 minutes ago
      emptyRoom.emptySince = Date.now() - 11 * 60 * 1000;
      roomManager['registerRoomInMemory'](emptyRoom);

      expect(roomManager.getRoom('EMPTY111')).toBeDefined();

      const cleaned = roomManager.cleanupEmptyRooms();
      expect(cleaned).toBe(1);
      expect(roomManager.getRoom('EMPTY111')).toBeUndefined();
    });

    it('RoomRepository.deleteExpiredRooms deletes expired records from DB', async () => {
      const mockPrisma = {
        room: {
          deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
        },
      } as any;

      const repo = new RoomRepository(mockPrisma);
      const count = await repo.deleteExpiredRooms();

      expect(count).toBe(4);
      expect(mockPrisma.room.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
