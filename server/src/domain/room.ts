import { Role } from '@prisma/client';
import { Participant, PublicParticipant } from './participant.js';

export type PlayState = 'PLAYING' | 'PAUSED';

export interface PlaybackState {
  videoId: string | null;
  playState: PlayState;
  currentTime: number;
  updatedAt: number;
}

export interface ActionRequest {
  id: string;
  userId: string;
  username: string;
  actionType: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO';
  targetTime?: number;
  videoId?: string;
  requestedAt: number;
}

export class Room {
  public readonly id: string;
  public readonly code: string;
  public hostUserId: string;

  // In-memory playback state
  public state: PlaybackState;

  // In-memory active participants (keyed by userId)
  private participants: Map<string, Participant> = new Map();

  // Banned userIds for quick memory check
  private bannedUserIds: Set<string> = new Set();

  // Pending participant action requests
  public pendingRequests: ActionRequest[] = [];

  public lastActiveAt: number;
  public emptySince: number | null = null;

  constructor(params: {
    id: string;
    code: string;
    hostUserId: string;
    initialVideoId?: string | null;
  }) {
    this.id = params.id;
    this.code = params.code;
    this.hostUserId = params.hostUserId;
    this.state = {
      videoId: params.initialVideoId ?? null,
      playState: 'PAUSED',
      currentTime: 0,
      updatedAt: Date.now(),
    };
    this.lastActiveAt = Date.now();
  }

  // --- Participants Management ---

  addParticipant(participant: Participant): void {
    this.participants.set(participant.userId, participant);
    this.emptySince = null;
    this.touch();
  }

  removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (participant) {
      this.participants.delete(userId);
      if (this.participants.size === 0) {
        this.emptySince = Date.now();
      }
      this.touch();
    }
    return participant;
  }

  getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  getParticipantBySocketId(socketId: string): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.socketId === socketId) {
        return participant;
      }
    }
    return undefined;
  }

  getParticipantByReconnectToken(token: string): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.reconnectToken === token) {
        return participant;
      }
    }
    return undefined;
  }

  getParticipantsPublic(): PublicParticipant[] {
    return Array.from(this.participants.values()).map((p) => p.toPublicJSON());
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  // --- Roles Management ---

  assignRole(targetUserId: string, newRole: Role): boolean {
    const participant = this.participants.get(targetUserId);
    if (!participant) return false;
    participant.role = newRole;
    this.touch();
    return true;
  }

  transferHost(newHostUserId: string): boolean {
    const newHost = this.participants.get(newHostUserId);
    if (!newHost) return false;

    const oldHost = this.participants.get(this.hostUserId);
    if (oldHost) {
      oldHost.role = Role.MODERATOR;
    }

    newHost.role = Role.HOST;
    this.hostUserId = newHostUserId;
    this.touch();
    return true;
  }

  // --- Ban Management ---

  banUser(userId: string): void {
    this.bannedUserIds.add(userId);
    this.removeParticipant(userId);
    this.touch();
  }

  isBanned(userId: string): boolean {
    return this.bannedUserIds.has(userId);
  }

  loadBannedUsers(userIds: string[]): void {
    userIds.forEach((id) => this.bannedUserIds.add(id));
  }

  // --- Playback State & Drift Engine ---

  /**
   * Calculates live playback time:
   * currentTime + elapsed since updatedAt if playing, else currentTime.
   */
  getLiveTime(): number {
    if (this.state.playState === 'PLAYING') {
      const elapsedSeconds = (Date.now() - this.state.updatedAt) / 1000;
      return Math.max(0, this.state.currentTime + elapsedSeconds);
    }
    return this.state.currentTime;
  }

  applyPlay(currentTime?: number): void {
    const liveTime = typeof currentTime === 'number' ? currentTime : this.getLiveTime();
    this.state = {
      ...this.state,
      playState: 'PLAYING',
      currentTime: liveTime,
      updatedAt: Date.now(),
    };
    this.touch();
  }

  applyPause(currentTime?: number): void {
    const liveTime = typeof currentTime === 'number' ? currentTime : this.getLiveTime();
    this.state = {
      ...this.state,
      playState: 'PAUSED',
      currentTime: liveTime,
      updatedAt: Date.now(),
    };
    this.touch();
  }

  applySeek(targetTime: number): void {
    this.state = {
      ...this.state,
      currentTime: Math.max(0, targetTime),
      updatedAt: Date.now(),
    };
    this.touch();
  }

  applyChangeVideo(videoId: string): void {
    this.state = {
      videoId,
      playState: 'PAUSED',
      currentTime: 0,
      updatedAt: Date.now(),
    };
    this.touch();
  }

  // --- Requests Queue ---

  addRequest(request: ActionRequest): void {
    // Keep max 20 pending requests to avoid memory bloat
    if (this.pendingRequests.length >= 20) {
      this.pendingRequests.shift();
    }
    this.pendingRequests.push(request);
    this.touch();
  }

  removeRequest(requestId: string): ActionRequest | undefined {
    const index = this.pendingRequests.findIndex((r) => r.id === requestId);
    if (index !== -1) {
      const [req] = this.pendingRequests.splice(index, 1);
      this.touch();
      return req;
    }
    return undefined;
  }

  touch(): void {
    this.lastActiveAt = Date.now();
  }
}
