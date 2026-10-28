import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, checkRoomExists, pingServer } from '../services/api.js';
import { AvatarSelector } from '../components/AvatarSelector.js';
import {
  Tv,
  Sparkles,
  ArrowRight,
  Shield,
  Film,
  Clapperboard,
  Crown,
  Heart,
  Flame,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [hostName, setHostName] = useState(
    () => sessionStorage.getItem('wp_username') || ''
  );
  const [videoUrl, setVideoUrl] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState(
    () => sessionStorage.getItem('wp_username') || ''
  );
  const [avatar, setAvatar] = useState<string>(
    () => sessionStorage.getItem('wp_avatar') || '🍿'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quietly ping backend server on mount to wake it up if idle
  useEffect(() => {
    pingServer().catch(() => { });
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmedName = hostName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a display name');
      return;
    }

    try {
      setIsLoading(true);
      sessionStorage.setItem('wp_username', trimmedName);
      sessionStorage.setItem('wp_avatar', avatar);
      const res = await createRoom(trimmedName, videoUrl.trim() || undefined);
      if (res.hostUserId) {
        sessionStorage.setItem('wp_user_id', res.hostUserId);
      }
      sessionStorage.setItem('wp_current_room', res.roomId);
      navigate(`/room/${res.roomId}`);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmedCode = joinCode.trim();
    const trimmedName = joinName.trim();

    if (!trimmedCode) {
      setErrorMessage('Please enter a room code or link');
      return;
    }
    if (!trimmedName) {
      setErrorMessage('Please enter your display name');
      return;
    }

    // Extract code if user pasted a full URL
    let targetCode = trimmedCode;
    try {
      if (trimmedCode.includes('/room/')) {
        const parts = trimmedCode.split('/room/');
        targetCode = parts[1].split('?')[0].split('/')[0];
      }
    } catch {
      targetCode = trimmedCode;
    }

    try {
      setIsLoading(true);
      const exists = await checkRoomExists(targetCode);
      if (!exists) {
        setErrorMessage('Room not found. Check code or create a new room.');
        return;
      }

      sessionStorage.removeItem('wp_user_id');
      sessionStorage.removeItem('wp_reconnect_token');
      sessionStorage.setItem('wp_username', trimmedName);
      sessionStorage.setItem('wp_avatar', avatar);
      sessionStorage.setItem('wp_current_room', targetCode);
      navigate(`/room/${targetCode}`);
    } catch (err) {
      setErrorMessage('Failed to verify room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-darkBg flex flex-col justify-between selection:bg-brand-pink/30 selection:text-white">
      {/* Background glow effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-brand-violet/20 via-brand-pink/10 to-transparent blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-10 h-10 rounded-theme bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center shadow-lg">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight gradient-text">
              WatchParty
            </h1>
          </div>
        </div>
      </header>

      {/* Main Hero & Forms */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col items-center">

        {/* Hero headline */}
        <div className="text-center max-w-2xl mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-brand-pink mb-4">
            <Sparkles className="w-3.5 h-3.5" /> High-fidelity Synchronized YouTube Watching
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-100 tracking-tight leading-tight mb-4">
            Watch Together in <span className="gradient-text">Real-Time</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Create instant cinematic rooms, invite friends, and watch YouTube videos
            perfectly in sync with role-based host controls, chat, and live reactions.
          </p>
        </div>

        {/* Tab Switcher & Glass Form Card */}
        <div className="glass-panel w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-black/40 rounded-theme border border-white/5 mb-6">
            <button
              onClick={() => {
                setActiveTab('create');
                setErrorMessage(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition ${activeTab === 'create'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Create New Room
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                setErrorMessage(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition ${activeTab === 'join'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Join by Code / Link
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-theme bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs leading-relaxed animate-fade-in">
              {errorMessage}
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <AvatarSelector
                selectedAvatar={avatar}
                onSelectAvatar={setAvatar}
                label="Host Profile Avatar or Photo"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Display Name <span className="text-brand-pink">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-4 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-pink transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Initial YouTube URL or ID <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-pink transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full gradient-btn py-3 rounded-theme font-semibold text-sm text-white shadow-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  'Creating Room...'
                ) : (
                  <>
                    Create WatchParty Room <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Room Code or Invite Link <span className="text-brand-pink">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. 7X8K2M9P or paste URL"
                  className="w-full px-4 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-pink transition"
                />
              </div>

              <AvatarSelector
                selectedAvatar={avatar}
                onSelectAvatar={setAvatar}
                label="Viewer Profile Avatar or Photo"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Display Name <span className="text-brand-pink">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="e.g. Sam"
                  className="w-full px-4 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-pink transition"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full gradient-btn py-3 rounded-theme font-semibold text-sm text-white shadow-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  'Connecting...'
                ) : (
                  <>
                    Join WatchParty Room <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Movie Genres Marquee strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8 mb-4 max-w-xl text-center">
          {['🎬 Movie Nights', '🍿 Binge Shows', '🚀 Anime & Sci-Fi', '🎵 Music Concerts', '🎮 Gaming Streams'].map((genre) => (
            <span
              key={genre}
              className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:border-brand-pink/40 hover:text-white transition cursor-default"
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Feature Highlights Grid - Cinematic Movie Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10 w-full">
          {/* Card 1: Synchronized Playback */}
          <div className="cinema-card p-6 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition duration-500" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                  <Film className="w-5 h-5 text-rose-400" />
                </div>
                <span className="movie-badge px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">
                  Zero Drift
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center gap-2">
                Cinematic Sync
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sub-second drift correction continuously realigns player timestamps for every viewer. Every scene, punchline, and climax happens together.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
              <Clapperboard className="w-3.5 h-3.5" /> Theater-Grade Precision
            </div>
          </div>

          {/* Card 2: Role-Based Control */}
          <div className="cinema-card p-6 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition duration-500" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  Director RBAC
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center gap-2">
                Director Controls
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The Host commands playback from the director's chair. Promote friends to Co-Directors, approve video change requests, and ban trolls instantly.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
              <Shield className="w-3.5 h-3.5" /> Zero-Trust Security
            </div>
          </div>

          {/* Card 3: Live Balcony & Reactions */}
          <div className="cinema-card p-6 flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition duration-500" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-pink-500/20 to-violet-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                  <Flame className="w-5 h-5 text-pink-400" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-500/10 border border-pink-500/30 text-pink-300">
                  Live Reactions
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center gap-2">
                Balcony Chat
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hype up the screening with floating animated emojis over the theater screen, popcorn reactions, and fast sanitized chat room.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-pink-400">
              <Heart className="w-3.5 h-3.5" /> Interactive Theater Room
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 text-center text-xs text-slate-500 border-t border-white/5">

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} WatchParty.
            All rights reserved.
          </p>
          <p>Made for movie lovers ❤️</p>
        </div>
      </footer>
    </div>
  );
};
