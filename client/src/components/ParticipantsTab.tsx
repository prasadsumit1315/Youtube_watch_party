import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext.js';
import { PublicParticipant, Role } from '../types/index.js';
import {
  Shield,
  MoreVertical,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Crown,
} from 'lucide-react';

export const ParticipantsTab: React.FC = () => {
  const {
    participants,
    ownRole,
    ownUserId,
    assignRole,
    removeParticipant,
    transferHost,
  } = useRoom();

  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'remove' | 'transfer' | 'role';
    targetUser: PublicParticipant;
    newRole?: Role;
  } | null>(null);

  const isHost = ownRole === 'HOST';

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'HOST':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Crown className="w-3 h-3" /> Host
          </span>
        );
      case 'MODERATOR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Shield className="w-3 h-3" /> Moderator (Co-Host)
          </span>
        );
      case 'PARTICIPANT':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            Viewer
          </span>
        );
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const handleConfirmAction = () => {
    if (!confirmDialog) return;
    const { type, targetUser, newRole } = confirmDialog;

    if (type === 'remove') {
      removeParticipant(targetUser.userId);
    } else if (type === 'transfer') {
      transferHost(targetUser.userId);
    } else if (type === 'role' && newRole) {
      assignRole(targetUser.userId, newRole);
    }

    setConfirmDialog(null);
    setActiveMenuUserId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          In Room ({participants.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {participants.map((user) => {
          const isCurrentUser = user.userId === ownUserId;
          const isTargetHost = user.role === 'HOST';

          return (
            <div
              key={user.userId}
              className="flex items-center justify-between p-2.5 rounded-theme bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition"
            >
              <div className="flex items-center gap-3">
                {/* Profile Photo / Avatar */}
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center text-xs font-bold text-white shadow shrink-0 border border-white/10">
                  {user.avatar ? (
                    user.avatar.startsWith('data:image/') ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base select-none">{user.avatar}</span>
                    )
                  ) : (
                    <span>{getInitials(user.username)}</span>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-200">
                      {user.username}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] text-slate-500 font-mono">(You)</span>
                    )}
                  </div>
                  <div>{getRoleBadge(user.role)}</div>
                </div>
              </div>

              {/* Host actions dropdown menu */}
              {isHost && !isCurrentUser && !isTargetHost && (
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveMenuUserId(activeMenuUserId === user.userId ? null : user.userId)
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                    aria-label={`Moderation options for ${user.username}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuUserId === user.userId && (
                    <div className="absolute right-0 top-8 z-30 w-56 glass-panel p-1.5 rounded-theme shadow-2xl border border-brand-border animate-fade-in text-xs">
                      {user.role === 'PARTICIPANT' ? (
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              type: 'role',
                              targetUser: user,
                              newRole: 'MODERATOR',
                            });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-slate-200 hover:bg-white/10 hover:text-white"
                        >
                          <Shield className="w-3.5 h-3.5 text-brand-violet" />
                          <span>Give Host Controls (Make Mod)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              type: 'role',
                              targetUser: user,
                              newRole: 'PARTICIPANT',
                            });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-slate-200 hover:bg-white/10 hover:text-white"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Revoke Host Controls (Make Viewer)</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setConfirmDialog({
                            type: 'transfer',
                            targetUser: user,
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-amber-300 hover:bg-amber-500/10"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer Full Host
                      </button>

                      <div className="my-1 border-t border-white/5" />

                      <button
                        onClick={() => {
                          setConfirmDialog({
                            type: 'remove',
                            targetUser: user,
                          });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium"
                      >
                        <UserX className="w-3.5 h-3.5" /> Remove & Ban
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 border border-brand-border rounded-card shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2">
              {confirmDialog.type === 'remove' && `Remove and Ban ${confirmDialog.targetUser.username}?`}
              {confirmDialog.type === 'transfer' && `Transfer Host to ${confirmDialog.targetUser.username}?`}
              {confirmDialog.type === 'role' &&
                (confirmDialog.newRole === 'MODERATOR'
                  ? `Give Host Controls to ${confirmDialog.targetUser.username}?`
                  : `Revoke Host Controls from ${confirmDialog.targetUser.username}?`)}
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {confirmDialog.type === 'remove' &&
                'This user will be immediately disconnected and blocked from rejoining this room.'}
              {confirmDialog.type === 'transfer' &&
                'You will hand over room ownership. You will be demoted to Moderator.'}
              {confirmDialog.type === 'role' &&
                (confirmDialog.newRole === 'MODERATOR'
                  ? `Grant ${confirmDialog.targetUser.username} full video playback controls (play, pause, seek, change video, and approve requests). You can change this back at any time.`
                  : `Revoke Moderator video playback controls and return ${confirmDialog.targetUser.username} to a regular viewer.`)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-theme text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-theme text-xs font-semibold text-white shadow ${
                  confirmDialog.type === 'remove'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'gradient-btn'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
