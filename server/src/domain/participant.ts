import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';

export interface PublicParticipant {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
  avatar?: string;
}

export class Participant {
  public readonly userId: string;
  public username: string;
  public role: Role;
  public socketId: string;
  public avatar?: string;
  public readonly reconnectToken: string;
  public readonly joinedAt: number;
  public lastActiveAt: number;

  constructor(params: {
    userId: string;
    username: string;
    role: Role;
    socketId: string;
    avatar?: string;
    reconnectToken?: string;
    joinedAt?: number;
  }) {
    this.userId = params.userId;
    this.username = params.username;
    this.role = params.role;
    this.socketId = params.socketId;
    this.avatar = params.avatar;
    this.reconnectToken = params.reconnectToken ?? randomBytes(24).toString('hex');
    this.joinedAt = params.joinedAt ?? Date.now();
    this.lastActiveAt = Date.now();
  }

  updateSocket(newSocketId: string): void {
    this.socketId = newSocketId;
    this.lastActiveAt = Date.now();
  }

  touch(): void {
    this.lastActiveAt = Date.now();
  }

  /**
   * Safe serialization for clients.
   * STRICT SECURITY RULE: NEVER leaks socketId, reconnectToken, or internal state.
   */
  toPublicJSON(): PublicParticipant {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
      avatar: this.avatar,
    };
  }
}
