export type Role = 'HOST' | 'MODERATOR' | 'PARTICIPANT';

export interface PublicParticipant {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
}

export type PlayState = 'PLAYING' | 'PAUSED';

export interface ActionRequest {
  id: string;
  userId: string;
  username: string;
  actionType: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_VIDEO';
  targetTime?: number;
  videoId?: string;
  requestedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: number;
}

export interface ReactionEvent {
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

export interface SyncStatePayload {
  videoId: string | null;
  playState: PlayState;
  currentTime: number;
  updatedAt: number;
  roomCode: string;
  roomId: string;
  hostUserId: string;
  participants: PublicParticipant[];
  requests: ActionRequest[];
  ownRole?: Role;
  ownUserId?: string;
  reconnectToken?: string;
}

export interface ErrorEventPayload {
  code: string;
  message: string;
}
