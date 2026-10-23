import { Role } from '@prisma/client';

export type ActionType =
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'CHANGE_VIDEO'
  | 'ASSIGN_ROLE'
  | 'REMOVE_PARTICIPANT'
  | 'TRANSFER_HOST'
  | 'APPROVE_REQUEST'
  | 'REJECT_REQUEST'
  | 'CHAT'
  | 'REACTION'
  | 'REQUEST_ACTION';

export interface PermissionCheckContext {
  actorRole: Role;
  actorUserId: string;
  targetUserId?: string;
  targetUserRole?: Role;
  newRole?: Role;
}

/**
 * Single source of truth for Role-Based Access Control in WatchParty.
 * Rules:
 * - HOST: All actions. Host cannot be removed or demoted except via transfer_host.
 * - MODERATOR: play, pause, seek, change_video, approve/reject requests, chat, reactions.
 * - PARTICIPANT: watch only, chat, reactions, request_action.
 */
export class PermissionPolicy {
  static can(action: ActionType, context: PermissionCheckContext): boolean {
    const { actorRole, actorUserId, targetUserId, targetUserRole, newRole } = context;

    switch (action) {
      case 'PLAY':
      case 'PAUSE':
      case 'SEEK':
      case 'CHANGE_VIDEO':
      case 'APPROVE_REQUEST':
      case 'REJECT_REQUEST':
        // Host and Moderator can perform playback control and handle requests
        return actorRole === Role.HOST || actorRole === Role.MODERATOR;

      case 'ASSIGN_ROLE':
        // Only HOST can assign roles
        if (actorRole !== Role.HOST) return false;
        // Cannot assign role to self
        if (targetUserId && targetUserId === actorUserId) return false;
        // Cannot assign HOST role via assign_role; must use TRANSFER_HOST
        if (newRole === Role.HOST) return false;
        // Cannot demote existing host
        if (targetUserRole === Role.HOST) return false;
        return true;

      case 'REMOVE_PARTICIPANT':
        // Only HOST can remove/kick participants
        if (actorRole !== Role.HOST) return false;
        // Host cannot remove themselves
        if (targetUserId && targetUserId === actorUserId) return false;
        // Host cannot remove another host
        if (targetUserRole === Role.HOST) return false;
        return true;

      case 'TRANSFER_HOST':
        // Only current HOST can transfer host ship
        if (actorRole !== Role.HOST) return false;
        // Cannot transfer to self
        if (targetUserId && targetUserId === actorUserId) return false;
        return true;

      case 'CHAT':
      case 'REACTION':
        // All active room members can chat and react
        return true;

      case 'REQUEST_ACTION':
        // Participants (and other non-hosts) can request actions
        return true;

      default:
        return false;
    }
  }

  static isHost(role: Role): boolean {
    return role === Role.HOST;
  }

  static isModerator(role: Role): boolean {
    return role === Role.MODERATOR;
  }

  static isParticipant(role: Role): boolean {
    return role === Role.PARTICIPANT;
  }
}
