import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext.js';
import { Plus, X, Sparkles, Crown } from 'lucide-react';

const QUICK_EMOJIS = ['🔥', '❤️', '🍿', '😂', '👏', '👑', '🚀', '✨', '🥳', '💯'];

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: 'Hype & Cinema',
    icon: '🍿',
    emojis: ['🔥', '🍿', '🎬', '🚀', '💯', '⚡', '💎', '💥', '🤯', '👏', '🙌', '🍻'],
  },
  {
    name: 'Love & Magic',
    icon: '💖',
    emojis: ['❤️', '💖', '✨', '🌟', '🥰', '🤩', '😍', '🥺', '🫶', '🎉', '💐', '🌈'],
  },
  {
    name: 'Fun & Wild',
    icon: '😂',
    emojis: ['😂', '🤣', '💀', '🤪', '🥳', '💃', '🕺', '🍕', '🍔', '🍦', '🍩', '🥑'],
  },
  {
    name: 'VIP & Legends',
    icon: '👑',
    emojis: ['👑', '🕶️', '🏆', '🥇', '🎯', '🦾', '🦄', '👻', '👾', '👽', '⚔️', '🛡️'],
  },
];

export const ReactionsOverlay: React.FC = () => {
  const { reactions, sendReaction, syncState } = useRoom();
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [customInput, setCustomInput] = useState('');

  const handleSend = (emoji: string) => {
    if (!emoji.trim()) return;
    sendReaction(emoji.trim());
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    handleSend(trimmed);
    setCustomInput('');
  };

  return (
    <>
      {/* Floating ephemeral emojis floating up from bottom */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {reactions.map((rx) => {
          // Semi-random horizontal positioning based on timestamp
          const leftPercent = 15 + (rx.timestamp % 70);
          const isHost = rx.isHost || rx.role === 'HOST' || syncState?.hostUserId === rx.userId;

          return (
            <div
              key={`${rx.timestamp}-${rx.userId}`}
              className={`absolute bottom-6 flex flex-col items-center animate-float-up filter ${
                isHost ? 'scale-125 z-30 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]' : 'drop-shadow-lg'
              }`}
              style={{
                left: `${leftPercent}%`,
              }}
            >
              {/* Special Host Sparkle Crown Effect */}
              {isHost && (
                <div className="flex items-center gap-1 text-amber-300 animate-pulse text-xs -mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <Crown className="w-4 h-4 fill-amber-400 text-amber-300" />
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Emoji Display */}
              <span className={`select-none ${isHost ? 'text-5xl' : 'text-3xl'}`}>
                {rx.emoji}
              </span>

              {/* Sender Pill */}
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans mt-0.5 backdrop-blur-md transition ${
                  isHost
                    ? 'bg-gradient-to-r from-amber-500/90 via-pink-500/90 to-amber-500/90 text-white font-bold border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-black/60 text-white/90 border border-white/10'
                }`}
              >
                {rx.avatar && (
                  rx.avatar.startsWith('data:image/') ? (
                    <img
                      src={rx.avatar}
                      alt={rx.username}
                      className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="text-xs">{rx.avatar}</span>
                  )
                )}
                {isHost && <Crown className="w-2.5 h-2.5 fill-amber-200 text-amber-100" />}
                <span>{rx.username}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modern Emoji Picker Modal Popover */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute right-4 bottom-14 z-40 w-72 sm:w-80 p-3 bg-brand-darkBg/95 backdrop-blur-xl border border-brand-border rounded-2xl shadow-2xl animate-fade-in flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-pink" /> React with Emojis
              </span>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(idx)}
                  className={`flex-1 py-1 text-xs rounded-lg font-medium transition flex items-center justify-center gap-1 ${
                    activeCategory === idx
                      ? 'bg-brand-pink text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={cat.name}
                >
                  <span>{cat.icon}</span>
                </button>
              ))}
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1 py-1">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    handleSend(emoji);
                  }}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 active:scale-125 transition flex items-center justify-center text-xl cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Add Custom Emoji Input */}
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
              <input
                type="text"
                maxLength={12}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Type or paste any emoji..."
                className="flex-1 px-3 py-1.5 bg-brand-darkSurface border border-white/10 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-pink"
              />
              <button
                type="submit"
                disabled={!customInput.trim()}
                className="px-3 py-1.5 rounded-xl gradient-btn text-xs font-semibold text-white disabled:opacity-40 transition shadow"
              >
                React
              </button>
            </form>
          </div>
        </>
      )}

      {/* Interactive Quick Reaction Bar */}
      <div className="glass-panel p-1.5 sm:p-2 flex items-center justify-center gap-1 sm:gap-1.5 shadow-xl border border-white/10 rounded-full max-w-full overflow-x-auto">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleSend(emoji)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-white/10 active:scale-125 transition flex items-center justify-center text-base sm:text-lg cursor-pointer shrink-0"
            title={`React with ${emoji}`}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        {/* Plus / More Emojis Button */}
        <button
          type="button"
          onClick={() => setShowPicker((prev) => !prev)}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full transition flex items-center justify-center shrink-0 cursor-pointer ${
            showPicker
              ? 'bg-brand-pink text-white shadow-lg'
              : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10'
          }`}
          title="More Emojis & Custom Emoji"
          aria-label="More Emojis & Custom Emoji"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};
