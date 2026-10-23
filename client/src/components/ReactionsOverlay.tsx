import React from 'react';
import { useRoom } from '../context/RoomContext.js';

const AVAILABLE_EMOJIS = ['🔥', '❤️', '👏', '😂', '🍿', '🎉', '🚀'];

export const ReactionsOverlay: React.FC = () => {
  const { reactions, sendReaction } = useRoom();

  return (
    <>
      {/* Floating ephemeral emojis floating up from bottom */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {reactions.map((rx) => {
          // Semi-random horizontal positioning based on timestamp
          const leftPercent = 15 + (rx.timestamp % 70);
          return (
            <div
              key={`${rx.timestamp}-${rx.userId}`}
              className="absolute bottom-6 flex flex-col items-center animate-float-up text-3xl filter drop-shadow-lg"
              style={{
                left: `${leftPercent}%`,
              }}
            >
              <span>{rx.emoji}</span>
              <span className="text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded-full font-sans -mt-1 scale-75">
                {rx.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* Interactive Quick Reaction Bar */}
      <div className="glass-panel p-2 flex items-center justify-center gap-1.5 shadow-xl border border-white/10 rounded-full">
        {AVAILABLE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="w-9 h-9 rounded-full hover:bg-white/10 active:scale-125 transition flex items-center justify-center text-lg cursor-pointer"
            title={`React with ${emoji}`}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
