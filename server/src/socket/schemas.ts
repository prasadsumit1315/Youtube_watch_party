import { z } from 'zod';
import { Role } from '@prisma/client';

import { sanitizeUsername } from '../utils/sanitizer.js';

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(64),
  username: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeUsername(val))
    .refine((val) => val.length >= 1 && val.length <= 24, {
      message: 'Username must be between 1 and 24 characters',
    }),
  userId: z.string().optional(),
  reconnectToken: z.string().optional(),
});

export const PlayPauseSchema = z.object({
  currentTime: z.number().min(0).optional(),
});

export const SeekSchema = z.object({
  targetTime: z.number().min(0).max(86400), // Max 24 hours
});

export const ChangeVideoSchema = z.object({
  urlOrId: z.string().min(1).max(500),
});

export const AssignRoleSchema = z.object({
  targetUserId: z.string().uuid(),
  newRole: z.nativeEnum(Role),
});

export const RemoveParticipantSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const TransferHostSchema = z.object({
  targetUserId: z.string().uuid(),
});

export const RequestActionSchema = z.object({
  actionType: z.enum(['PLAY', 'PAUSE', 'SEEK', 'CHANGE_VIDEO']),
  targetTime: z.number().min(0).optional(),
  videoId: z.string().optional(),
});

export const RequestResolutionSchema = z.object({
  requestId: z.string().min(1).max(64),
});

export const ChatMessageSchema = z.object({
  text: z.string().min(1).max(300),
});

export const ReactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});
