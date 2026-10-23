import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { RoomManager } from '../domain/room-manager.js';
import { Participant } from '../domain/participant.js';
import { PermissionPolicy } from '../domain/permissions.js';
import { Role } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { extractYouTubeVideoId, sanitizeUsername, escapeHtml } from '../utils/sanitizer.js';
import { SocketThrottle } from './throttle.js';
import { env } from '../config/env.js';
import { MemberRepository } from '../repositories/member.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { BanRepository } from '../repositories/ban.repository.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import {
  JoinRoomSchema,
  PlayPauseSchema,
  SeekSchema,
  ChangeVideoSchema,
  AssignRoleSchema,
  RemoveParticipantSchema,
  TransferHostSchema,
  RequestActionSchema,
  RequestResolutionSchema,
  ChatMessageSchema,
  ReactionSchema,
} from './schemas.js';

interface SocketSession {
  roomId: string;
  userId: string;
  throttle: SocketThrottle;
}

/**
 * Execute a DB write with 1 retry on failure per requirements
 */
async function persistWithRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (err) {
    logger.warn({ context, error: (err as Error).message }, 'DB write failed, retrying once...');
    try {
      return await operation();
    } catch (retryErr) {
      logger.error(
        { context, error: (retryErr as Error).message },
        'DB write failed after retry'
      );
      return null;
    }
  }
}

export class SocketMessageHandler {
  private io: Server;
  private roomManager: RoomManager;
  private roomRepo: RoomRepository;
  private memberRepo: MemberRepository;
  private banRepo: BanRepository;
  private chatRepo: ChatRepository;

  // Track socket session state: Map<socketId, SocketSession>
  private sessions: Map<string, SocketSession> = new Map();

  constructor(
    io: Server,
    roomManager: RoomManager,
    roomRepo?: RoomRepository,
    memberRepo?: MemberRepository,
    banRepo?: BanRepository,
    chatRepo?: ChatRepository
  ) {
    this.io = io;
    this.roomManager = roomManager;
    this.roomRepo = roomRepo ?? new RoomRepository();
    this.memberRepo = memberRepo ?? new MemberRepository();
    this.banRepo = banRepo ?? new BanRepository();
    this.chatRepo = chatRepo ?? new ChatRepository();

    this.setupListeners();
  }

  private setupListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      const throttle = new SocketThrottle();

      // Check max payload size (10KB limit)
      socket.use(([event, data], next) => {
        try {
          const payloadSize = data ? JSON.stringify(data).length : 0;
          if (payloadSize > 10 * 1024) {
            socket.emit('error_event', {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Payload exceeds 10KB limit',
            });
            return;
          }
        } catch {
          // ignore serialization check if fails
        }
        next();
      });

      // 1. JOIN ROOM
      socket.on('join_room', async (data) => {
        try {
          if (!throttle.canPerformGeneral()) {
            socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Too many requests' });
            return;
          }

          const parseResult = JoinRoomSchema.safeParse(data);
          if (!parseResult.success) {
            socket.emit('error_event', { code: 'INVALID_PAYLOAD', message: 'Invalid join parameters' });
            return;
          }

          const { roomId: requestedRoomId, username, userId: incomingUserId, reconnectToken } = parseResult.data;

          // Find or hydrate room
          const room = await this.roomManager.hydrateFromDB(requestedRoomId);
          if (!room) {
            socket.emit('error_event', { code: 'ROOM_NOT_FOUND', message: 'Room not found or expired' });
            return;
          }

          // Smart Reconnection:
          let participant: Participant | undefined;
          let isReconnect = false;

          // 1. Check if participant already exists by socket, token, or userId
          if (!participant && reconnectToken) {
            participant = room.getParticipantByReconnectToken(reconnectToken);
          }
          if (!participant && incomingUserId) {
            participant = room.getParticipant(incomingUserId);
          }
          if (!participant) {
            participant = room.getParticipantBySocketId(socket.id);
          }

          if (participant) {
            isReconnect = true;
            participant.updateSocket(socket.id);
            participant.username = username;
          }

          if (!participant) {
            const userId = incomingUserId || randomUUID();

            // Check if user is banned (in-memory fast check)
            if (room.isBanned(userId)) {
              socket.emit('removed', { message: 'You have been removed from this room' });
              socket.disconnect(true);
              return;
            }

            // The first user joining an empty room or matching hostUserId becomes HOST
            let role: Role = Role.PARTICIPANT;
            if (room.getParticipantCount() === 0 || room.hostUserId === userId) {
              role = Role.HOST;
              room.hostUserId = userId;
            }

            participant = new Participant({
              userId,
              username,
              role,
              socketId: socket.id,
            });

            room.addParticipant(participant);
          }

          // Save session
          this.sessions.set(socket.id, {
            roomId: room.id,
            userId: participant.userId,
            throttle,
          });

          socket.join(room.id);

          // Send full sync state to joiner
          socket.emit('sync_state', {
            videoId: room.state.videoId,
            playState: room.state.playState,
            currentTime: room.state.currentTime,
            updatedAt: room.state.updatedAt,
            roomCode: room.code,
            roomId: room.id,
            hostUserId: room.hostUserId,
            participants: room.getParticipantsPublic(),
            requests: room.pendingRequests,
            ownRole: participant.role,
            ownUserId: participant.userId,
            reconnectToken: participant.reconnectToken,
          });

          // Notify other participants in the room
          if (!isReconnect) {
            socket.to(room.id).emit('user_joined', {
              user: participant.toPublicJSON(),
            });

            // Persist participant in DB asynchronously
            persistWithRetry(
              () => this.memberRepo.upsertMember(room.id, participant!.userId, username, participant!.role),
              'upsertMember'
            ).catch(() => {});
          }
        } catch (err) {
          logger.error({ error: (err as Error).message }, 'Error in join_room handler');
          socket.emit('error_event', { code: 'INTERNAL_ERROR', message: 'Failed to join room' });
        }
      });

      // Helper to get active session and room
      const getSessionAndRoom = () => {
        const session = this.sessions.get(socket.id);
        if (!session) {
          socket.emit('error_event', { code: 'UNAUTHORIZED', message: 'Not connected to a room' });
          return null;
        }
        const room = this.roomManager.getRoom(session.roomId);
        if (!room) {
          socket.emit('error_event', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          return null;
        }
        const participant = room.getParticipant(session.userId);
        if (!participant) {
          socket.emit('error_event', { code: 'NOT_A_MEMBER', message: 'User is not an active participant' });
          return null;
        }
        return { session, room, participant };
      };

      // 2. PLAY
      socket.on('play', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = PlayPauseSchema.safeParse(data ?? {});
        if (!valid.success) return;

        if (!PermissionPolicy.can('PLAY', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host and Moderator can control playback' });
          return;
        }

        room.applyPlay(valid.data.currentTime);
        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.state.currentTime,
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });
      });

      // 3. PAUSE
      socket.on('pause', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = PlayPauseSchema.safeParse(data ?? {});
        if (!valid.success) return;

        if (!PermissionPolicy.can('PAUSE', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host and Moderator can control playback' });
          return;
        }

        room.applyPause(valid.data.currentTime);
        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.state.currentTime,
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });
      });

      // 4. SEEK
      socket.on('seek', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = SeekSchema.safeParse(data);
        if (!valid.success) return;

        if (!PermissionPolicy.can('SEEK', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host and Moderator can seek' });
          return;
        }

        room.applySeek(valid.data.targetTime);
        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.state.currentTime,
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });
      });

      // 5. CHANGE VIDEO
      socket.on('change_video', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = ChangeVideoSchema.safeParse(data);
        if (!valid.success) {
          socket.emit('error_event', { code: 'INVALID_PAYLOAD', message: 'Invalid video input' });
          return;
        }

        if (!PermissionPolicy.can('CHANGE_VIDEO', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host and Moderator can change video' });
          return;
        }

        const videoId = extractYouTubeVideoId(valid.data.urlOrId);
        if (!videoId) {
          socket.emit('error_event', { code: 'INVALID_VIDEO', message: 'Invalid YouTube URL or ID' });
          return;
        }

        // 1. Update in-memory first for instantaneous sync
        room.applyChangeVideo(videoId);
        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.state.currentTime,
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });

        // 2. Persist to DB with retry
        await persistWithRetry(
          () => this.roomRepo.updateCurrentVideo(room.id, videoId, participant.userId),
          'updateCurrentVideo'
        );
      });

      // 6. ASSIGN ROLE
      socket.on('assign_role', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = AssignRoleSchema.safeParse(data);
        if (!valid.success) return;

        const target = room.getParticipant(valid.data.targetUserId);
        const canAssign = PermissionPolicy.can('ASSIGN_ROLE', {
          actorRole: participant.role,
          actorUserId: participant.userId,
          targetUserId: valid.data.targetUserId,
          targetUserRole: target?.role,
          newRole: valid.data.newRole,
        });

        if (!canAssign) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Unauthorized role assignment' });
          return;
        }

        // 1. Update memory
        room.assignRole(valid.data.targetUserId, valid.data.newRole);

        // 2. Broadcast role_assigned
        this.io.to(room.id).emit('role_assigned', {
          targetUserId: valid.data.targetUserId,
          role: valid.data.newRole,
          actorUserId: participant.userId,
        });

        // Also broadcast full sync_state
        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.getLiveTime(),
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });

        // 3. Persist to DB with retry
        await persistWithRetry(
          () => this.memberRepo.updateRole(room.id, valid.data.targetUserId, valid.data.newRole, participant.userId),
          'updateRole'
        );
      });

      // 7. REMOVE PARTICIPANT (Kick & Ban)
      socket.on('remove_participant', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = RemoveParticipantSchema.safeParse(data);
        if (!valid.success) return;

        const target = room.getParticipant(valid.data.targetUserId);
        const canRemove = PermissionPolicy.can('REMOVE_PARTICIPANT', {
          actorRole: participant.role,
          actorUserId: participant.userId,
          targetUserId: valid.data.targetUserId,
          targetUserRole: target?.role,
        });

        if (!canRemove) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Unauthorized removal' });
          return;
        }

        const targetSocketId = target?.socketId;

        // 1. Memory update: ban user and remove
        room.banUser(valid.data.targetUserId);

        // 2. If target is connected, notify and disconnect
        if (targetSocketId) {
          const targetSocket = this.io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.emit('removed', { message: 'You have been removed from the room by the host' });
            targetSocket.disconnect(true);
          }
        }

        // 3. Broadcast to rest of room
        this.io.to(room.id).emit('participant_removed', {
          targetUserId: valid.data.targetUserId,
          actorUserId: participant.userId,
        });

        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.getLiveTime(),
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });

        // 4. Persist ban & deletion in DB
        await persistWithRetry(
          () =>
            Promise.all([
              this.banRepo.banUser(room.id, valid.data.targetUserId, participant.userId),
              this.memberRepo.removeMember(room.id, valid.data.targetUserId, participant.userId),
            ]),
          'removeParticipantAndBan'
        );
      });

      // 8. TRANSFER HOST
      socket.on('transfer_host', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = TransferHostSchema.safeParse(data);
        if (!valid.success) return;

        const canTransfer = PermissionPolicy.can('TRANSFER_HOST', {
          actorRole: participant.role,
          actorUserId: participant.userId,
          targetUserId: valid.data.targetUserId,
        });

        if (!canTransfer) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Unauthorized host transfer' });
          return;
        }

        const oldHostUserId = participant.userId;
        const newHostUserId = valid.data.targetUserId;

        // 1. Update memory
        const transferred = room.transferHost(newHostUserId);
        if (!transferred) {
          socket.emit('error_event', { code: 'NOT_FOUND', message: 'Target user is not in room' });
          return;
        }

        // 2. Broadcast
        this.io.to(room.id).emit('host_transferred', {
          oldHostUserId,
          newHostUserId,
        });

        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.getLiveTime(),
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });

        // 3. Persist to DB with retry
        await persistWithRetry(
          () => this.roomRepo.transferHost(room.id, oldHostUserId, newHostUserId),
          'transferHost'
        );
      });

      // 9. REQUEST ACTION (Participants ask Host/Mod to play/pause/seek/change)
      socket.on('request_action', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = RequestActionSchema.safeParse(data);
        if (!valid.success) return;

        let videoId: string | undefined;
        if (valid.data.actionType === 'CHANGE_VIDEO' && valid.data.videoId) {
          videoId = extractYouTubeVideoId(valid.data.videoId) ?? undefined;
          if (!videoId) {
            socket.emit('error_event', { code: 'INVALID_VIDEO', message: 'Invalid video URL or ID' });
            return;
          }
        }

        const request = {
          id: randomUUID(),
          userId: participant.userId,
          username: participant.username,
          actionType: valid.data.actionType,
          targetTime: valid.data.targetTime,
          videoId,
          requestedAt: Date.now(),
        };

        room.addRequest(request);

        this.io.to(room.id).emit('action_requested', request);
      });

      // 10. APPROVE REQUEST
      socket.on('approve_request', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = RequestResolutionSchema.safeParse(data);
        if (!valid.success) return;

        if (!PermissionPolicy.can('APPROVE_REQUEST', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host or Moderator can approve requests' });
          return;
        }

        const req = room.removeRequest(valid.data.requestId);
        if (!req) return;

        // Apply requested action
        switch (req.actionType) {
          case 'PLAY':
            room.applyPlay(req.targetTime);
            break;
          case 'PAUSE':
            room.applyPause(req.targetTime);
            break;
          case 'SEEK':
            if (typeof req.targetTime === 'number') {
              room.applySeek(req.targetTime);
            }
            break;
          case 'CHANGE_VIDEO':
            if (req.videoId) {
              room.applyChangeVideo(req.videoId);
              await persistWithRetry(
                () => this.roomRepo.updateCurrentVideo(room.id, req.videoId!, participant.userId),
                'updateCurrentVideoFromRequest'
              );
            }
            break;
        }

        this.io.to(room.id).emit('sync_state', {
          videoId: room.state.videoId,
          playState: room.state.playState,
          currentTime: room.state.currentTime,
          updatedAt: room.state.updatedAt,
          roomCode: room.code,
          roomId: room.id,
          hostUserId: room.hostUserId,
          participants: room.getParticipantsPublic(),
          requests: room.pendingRequests,
        });
      });

      // 11. REJECT REQUEST
      socket.on('reject_request', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Rate limit exceeded' });
          return;
        }

        const valid = RequestResolutionSchema.safeParse(data);
        if (!valid.success) return;

        if (!PermissionPolicy.can('REJECT_REQUEST', { actorRole: participant.role, actorUserId: participant.userId })) {
          socket.emit('error_event', { code: 'FORBIDDEN', message: 'Only Host or Moderator can reject requests' });
          return;
        }

        room.removeRequest(valid.data.requestId);
        this.io.to(room.id).emit('action_rejected', { requestId: valid.data.requestId });
      });

      // 12. CHAT MESSAGE
      socket.on('chat_message', async (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        // Chat throttling: max 5 messages per 10s
        if (!session.throttle.canPerformChat()) {
          socket.emit('error_event', { code: 'RATE_LIMITED', message: 'Chat rate limit exceeded. Please wait a moment.' });
          return;
        }

        const valid = ChatMessageSchema.safeParse(data);
        if (!valid.success) return;

        const safeText = escapeHtml(valid.data.text);
        const messagePayload = {
          id: randomUUID(),
          userId: participant.userId,
          username: participant.username,
          text: safeText,
          createdAt: Date.now(),
        };

        this.io.to(room.id).emit('chat_message', messagePayload);

        if (env.PERSIST_CHAT) {
          await persistWithRetry(
            () => this.chatRepo.saveMessage(room.id, participant.userId, participant.username, safeText),
            'saveChatMessage'
          );
        }
      });

      // 13. REACTION
      socket.on('reaction', (data) => {
        const ctx = getSessionAndRoom();
        if (!ctx) return;
        const { session, room, participant } = ctx;

        if (!session.throttle.canPerformGeneral()) return;

        const valid = ReactionSchema.safeParse(data);
        if (!valid.success) return;

        this.io.to(room.id).emit('reaction', {
          userId: participant.userId,
          username: participant.username,
          emoji: valid.data.emoji,
          timestamp: Date.now(),
        });
      });

      // 14. LEAVE ROOM
      socket.on('leave_room', async () => {
        const session = this.sessions.get(socket.id);
        if (!session) return;

        const room = this.roomManager.getRoom(session.roomId);
        if (room) {
          const removed = room.removeParticipant(session.userId);
          if (removed) {
            socket.to(room.id).emit('user_left', {
              userId: removed.userId,
              username: removed.username,
            });
            await persistWithRetry(() => this.memberRepo.markLeft(room.id, removed.userId), 'markLeft');
          }
        }

        socket.leave(session.roomId);
        this.sessions.delete(socket.id);
      });

      // 15. DISCONNECT
      socket.on('disconnect', async () => {
        const session = this.sessions.get(socket.id);
        if (!session) return;

        const room = this.roomManager.getRoom(session.roomId);
        if (room) {
          const participant = room.getParticipant(session.userId);
          if (participant && participant.socketId === socket.id) {
            // Give 30s grace period for quick reconnect before broadcasting user_left
            setTimeout(async () => {
              const currentP = room.getParticipant(session.userId);
              if (currentP && currentP.socketId === socket.id) {
                room.removeParticipant(session.userId);
                this.io.to(room.id).emit('user_left', {
                  userId: currentP.userId,
                  username: currentP.username,
                });
                await persistWithRetry(() => this.memberRepo.markLeft(room.id, currentP.userId), 'markLeft');
              }
            }, 30000);
          }
        }

        this.sessions.delete(socket.id);
      });
    });
  }
}
