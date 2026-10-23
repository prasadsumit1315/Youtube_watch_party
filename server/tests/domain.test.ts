import { describe, it, expect, vi } from 'vitest';
import { PermissionPolicy } from '../src/domain/permissions.js';
import { Participant } from '../src/domain/participant.js';
import { Room } from '../src/domain/room.js';
import { RoomManager, generateRoomCode } from '../src/domain/room-manager.js';
import { Role } from '@prisma/client';

describe('Phase 3: Domain Classes & PermissionPolicy Unit Tests', () => {
  describe('PermissionPolicy', () => {
    const hostId = 'host-user-1';
    const modId = 'mod-user-2';
    const partId = 'part-user-3';

    it('HOST can perform all actions', () => {
      expect(
        PermissionPolicy.can('PLAY', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('PAUSE', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('SEEK', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('CHANGE_VIDEO', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('APPROVE_REQUEST', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('REJECT_REQUEST', { actorRole: Role.HOST, actorUserId: hostId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('ASSIGN_ROLE', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: partId,
          newRole: Role.MODERATOR,
        })
      ).toBe(true);
      expect(
        PermissionPolicy.can('REMOVE_PARTICIPANT', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: partId,
          targetUserRole: Role.PARTICIPANT,
        })
      ).toBe(true);
      expect(
        PermissionPolicy.can('TRANSFER_HOST', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: modId,
        })
      ).toBe(true);
    });

    it('HOST cannot remove or demote self or assign HOST via ASSIGN_ROLE', () => {
      // Host cannot remove self
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
          targetUserId: modId,
          newRole: Role.HOST,
        })
      ).toBe(false);

      // Host cannot transfer host to self
      expect(
        PermissionPolicy.can('TRANSFER_HOST', {
          actorRole: Role.HOST,
          actorUserId: hostId,
          targetUserId: hostId,
        })
      ).toBe(false);
    });

    it('MODERATOR can play/pause/seek/change_video/requests but NOT assign roles, remove, or transfer host', () => {
      expect(
        PermissionPolicy.can('PLAY', { actorRole: Role.MODERATOR, actorUserId: modId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('PAUSE', { actorRole: Role.MODERATOR, actorUserId: modId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('SEEK', { actorRole: Role.MODERATOR, actorUserId: modId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('CHANGE_VIDEO', { actorRole: Role.MODERATOR, actorUserId: modId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('APPROVE_REQUEST', { actorRole: Role.MODERATOR, actorUserId: modId })
      ).toBe(true);

      // Disallowed for MODERATOR:
      expect(
        PermissionPolicy.can('ASSIGN_ROLE', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: partId,
          newRole: Role.PARTICIPANT,
        })
      ).toBe(false);
      expect(
        PermissionPolicy.can('REMOVE_PARTICIPANT', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: partId,
        })
      ).toBe(false);
      expect(
        PermissionPolicy.can('TRANSFER_HOST', {
          actorRole: Role.MODERATOR,
          actorUserId: modId,
          targetUserId: partId,
        })
      ).toBe(false);
    });

    it('PARTICIPANT cannot play/pause/seek/change_video directly, but CAN request_action, chat, react', () => {
      expect(
        PermissionPolicy.can('PLAY', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('PAUSE', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('SEEK', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(false);
      expect(
        PermissionPolicy.can('CHANGE_VIDEO', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(false);

      // Allowed for PARTICIPANT:
      expect(
        PermissionPolicy.can('REQUEST_ACTION', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('CHAT', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(true);
      expect(
        PermissionPolicy.can('REACTION', { actorRole: Role.PARTICIPANT, actorUserId: partId })
      ).toBe(true);
    });
  });

  describe('Participant', () => {
    it('toPublicJSON never leaks socketId or reconnectToken', () => {
      const participant = new Participant({
        userId: 'u-123',
        username: 'CoolWatcher',
        role: Role.PARTICIPANT,
        socketId: 'socket_secret_999',
        reconnectToken: 'reconnect_secret_token_123',
      });

      const pub = participant.toPublicJSON();
      expect(pub.userId).toBe('u-123');
      expect(pub.username).toBe('CoolWatcher');
      expect(pub.role).toBe(Role.PARTICIPANT);
      expect(pub).not.toHaveProperty('socketId');
      expect(pub).not.toHaveProperty('reconnectToken');
      expect((pub as any).socketId).toBeUndefined();
      expect((pub as any).reconnectToken).toBeUndefined();
    });
  });

  describe('Room', () => {
    it('calculates live time dynamically when playing vs paused', async () => {
      const room = new Room({
        id: 'r-1',
        code: 'TEST1234',
        hostUserId: 'u-host',
      });

      expect(room.getLiveTime()).toBe(0);

      room.applyPlay(10);
      expect(room.state.playState).toBe('PLAYING');
      expect(room.getLiveTime()).toBeGreaterThanOrEqual(10);

      // Wait 50ms and verify live time increases
      await new Promise((r) => setTimeout(r, 60));
      expect(room.getLiveTime()).toBeGreaterThan(10.04);

      room.applyPause(15);
      expect(room.state.playState).toBe('PAUSED');
      expect(room.getLiveTime()).toBe(15);
    });

    it('manages participants and host transfer correctly', () => {
      const room = new Room({
        id: 'r-1',
        code: 'TEST1234',
        hostUserId: 'u-host',
      });

      const host = new Participant({
        userId: 'u-host',
        username: 'Host',
        role: Role.HOST,
        socketId: 'sock-1',
      });
      const member = new Participant({
        userId: 'u-member',
        username: 'Member',
        role: Role.PARTICIPANT,
        socketId: 'sock-2',
      });

      room.addParticipant(host);
      room.addParticipant(member);
      expect(room.getParticipantCount()).toBe(2);

      // Transfer host
      const transferred = room.transferHost('u-member');
      expect(transferred).toBe(true);
      expect(room.hostUserId).toBe('u-member');
      expect(member.role).toBe(Role.HOST);
      expect(host.role).toBe(Role.MODERATOR); // Old host demoted to MODERATOR
    });

    it('preserves both participants and keeps host role intact when a viewer has the same username as host', () => {
      const room = new Room({
        id: 'r-same-name',
        code: 'SAMENAME',
        hostUserId: 'host-1',
      });
      const host = new Participant({
        userId: 'host-1',
        username: 'Sumit',
        role: Role.HOST,
        socketId: 'sock-host',
      });
      const viewer = new Participant({
        userId: 'viewer-2',
        username: 'Sumit',
        role: Role.PARTICIPANT,
        socketId: 'sock-viewer',
      });

      room.addParticipant(host);
      room.addParticipant(viewer);

      expect(room.getParticipantCount()).toBe(2);
      expect(room.hostUserId).toBe('host-1');
      expect(room.getParticipant('host-1')?.role).toBe(Role.HOST);
      expect(room.getParticipant('viewer-2')?.role).toBe(Role.PARTICIPANT);
    });

    it('enforces bans and removes banned participants', () => {
      const room = new Room({
        id: 'r-1',
        code: 'TEST1234',
        hostUserId: 'u-host',
      });
      const badUser = new Participant({
        userId: 'u-bad',
        username: 'Troll',
        role: Role.PARTICIPANT,
        socketId: 'sock-bad',
      });

      room.addParticipant(badUser);
      expect(room.getParticipant('u-bad')).toBeDefined();

      room.banUser('u-bad');
      expect(room.isBanned('u-bad')).toBe(true);
      expect(room.getParticipant('u-bad')).toBeUndefined();
    });
  });

  describe('RoomManager & Code Generation', () => {
    it('generates 8-char random room code with no ambiguous characters (0, 1, I, O, L)', () => {
      const ambiguousRegex = /[01IOL]/;
      for (let i = 0; i < 50; i++) {
        const code = generateRoomCode();
        expect(code).toHaveLength(8);
        expect(ambiguousRegex.test(code)).toBe(false);
      }
    });

    it('hydrates room from DB when not in memory and resets playback to paused at 0', async () => {
      const mockRoomRepo = {
        findByCode: vi.fn().mockResolvedValue({
          id: 'room-uuid-1',
          code: 'CODE1234',
          hostUserId: 'host-1',
          currentVideoId: 'video-abc',
          expiresAt: new Date(Date.now() + 1000000),
        }),
        deleteExpiredRooms: vi.fn(),
      } as any;

      const mockBanRepo = {
        getBannedUsers: vi.fn().mockResolvedValue([{ userId: 'banned-user-1' }]),
      } as any;

      const roomManager = new RoomManager(mockRoomRepo, undefined, mockBanRepo);
      const hydrated = await roomManager.hydrateFromDB('CODE1234');

      expect(hydrated).toBeDefined();
      expect(hydrated?.id).toBe('room-uuid-1');
      expect(hydrated?.code).toBe('CODE1234');
      expect(hydrated?.state.videoId).toBe('video-abc');
      expect(hydrated?.state.playState).toBe('PAUSED');
      expect(hydrated?.state.currentTime).toBe(0);
      expect(hydrated?.isBanned('banned-user-1')).toBe(true);
    });
  });
});
