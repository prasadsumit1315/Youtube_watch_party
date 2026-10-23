import React from 'react';
import { useRoom } from '../context/RoomContext.js';
import { Play, Pause, FastForward, Tv, Check, X, Clock } from 'lucide-react';

export const RequestsTab: React.FC = () => {
  const { requests, ownRole, approveRequest, rejectRequest } = useRoom();

  const canModerate = ownRole === 'HOST' || ownRole === 'MODERATOR';

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'PLAY':
        return <Play className="w-4 h-4 text-emerald-400 fill-current" />;
      case 'PAUSE':
        return <Pause className="w-4 h-4 text-amber-400 fill-current" />;
      case 'SEEK':
        return <FastForward className="w-4 h-4 text-blue-400" />;
      case 'CHANGE_VIDEO':
        return <Tv className="w-4 h-4 text-purple-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Pending Requests ({requests.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {requests.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Clock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs">No pending requests.</p>
            <p className="text-[11px] text-slate-600">
              Participants' playback & video suggestions will appear here.
            </p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="p-3 rounded-theme bg-white/[0.04] border border-white/10 hover:border-brand-violet/30 transition flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/5">
                    {getActionIcon(req.actionType)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      {req.username}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Requests: <strong className="text-slate-300">{req.actionType}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {req.videoId && (
                <div className="text-[10px] text-slate-400 font-mono bg-black/40 px-2 py-1 rounded truncate">
                  Video ID: {req.videoId}
                </div>
              )}

              {canModerate && (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => approveRequest(req.id)}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
