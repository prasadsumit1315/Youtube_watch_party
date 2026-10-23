import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext.js';
import { YouTubePlayer } from '../components/YouTubePlayer.js';
import { ParticipantsTab } from '../components/ParticipantsTab.js';
import { ChatTab } from '../components/ChatTab.js';
import { RequestsTab } from '../components/RequestsTab.js';
import { ReactionsOverlay } from '../components/ReactionsOverlay.js';
import {
  ConnectingScreen,
  NotFoundScreen,
  RemovedScreen,
} from '../components/StatusScreens.js';
import {
  Tv,
  Users,
  MessageSquare,
  Clock,
  Copy,
  Check,
  LogOut,
  Crown,
  Shield,
  Eye,
  X,
  Share2,
} from 'lucide-react';

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    connectionStatus,
    syncState,
    ownRole,
    participants,
    requests,
    toastMessage,
    joinRoom,
    leaveRoom,
    clearToast,
  } = useRoom();

  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'requests'>('chat');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [promptUsername, setPromptUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');

  // 1. Join room on mount
  useEffect(() => {
    if (!id) return;

    const savedUsername = sessionStorage.getItem('wp_username');
    if (savedUsername) {
      joinRoom(id, savedUsername);
    } else {
      setPromptUsername(true);
    }

    return () => {
      // Don't leave immediately on fast unmount/remount
    };
  }, [id, joinRoom]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUsername.trim() || !id) return;
    sessionStorage.setItem('wp_username', tempUsername.trim());
    joinRoom(id, tempUsername.trim());
    setPromptUsername(false);
  };

  // Copies ONLY the room code
  const handleCopyRoomCode = () => {
    const code = syncState?.roomCode || id || '';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Shares or copies the full invite URL
  const handleShareLink = async () => {
    const inviteUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WatchParty Cinema - Watch Together',
          text: `Join my WatchParty screening! Room code: ${syncState?.roomCode || id}`,
          url: inviteUrl,
        });
        return;
      } catch {
        // Fall back to clipboard if user cancels or share is dismissed
      }
    }
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  // Render status screens
  if (connectionStatus === 'notFound') {
    return <NotFoundScreen />;
  }

  if (connectionStatus === 'removed') {
    return <RemovedScreen />;
  }

  if (connectionStatus === 'wakingServer') {
    return <ConnectingScreen isWaking />;
  }

  if (connectionStatus === 'connecting' && !syncState) {
    return <ConnectingScreen />;
  }

  // Username modal if joiner arrived directly via invite link without a saved username
  if (promptUsername) {
    return (
      <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4">
        <div className="glass-panel max-w-sm w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center mx-auto mb-4">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Join WatchParty</h2>
          <p className="text-xs text-slate-400 mb-4">
            Enter a display name to enter the synchronized room.
          </p>
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <input
              type="text"
              required
              maxLength={24}
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="Your Name (e.g. Robin)"
              className="w-full px-4 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-sm text-slate-100 focus:outline-none focus:border-brand-pink"
              autoFocus
            />
            <button
              type="submit"
              className="w-full gradient-btn py-2.5 rounded-theme font-semibold text-xs text-white shadow-lg"
            >
              Enter Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  const getRoleBadge = () => {
    switch (ownRole) {
      case 'HOST':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Crown className="w-3.5 h-3.5" /> Host
          </span>
        );
      case 'MODERATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/30">
            <Shield className="w-3.5 h-3.5" /> Moderator
          </span>
        );
      case 'PARTICIPANT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Eye className="w-3.5 h-3.5" /> Participant
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-darkBg flex flex-col text-slate-100">
      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 glass-panel border border-brand-border text-xs text-slate-200 shadow-2xl animate-fade-in">
          <span>{toastMessage}</span>
          <button
            onClick={clearToast}
            className="text-slate-400 hover:text-white p-0.5"
            aria-label="Dismiss toast"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-brand-darkSurface/60 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center shadow">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight gradient-text hidden sm:inline">
              WatchParty
            </span>
          </div>

          <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Room Code Chip - Copies ONLY Code */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Code:
            </span>
            <span className="font-mono text-xs font-bold text-amber-300">
              {syncState?.roomCode || id}
            </span>
            <button
              onClick={handleCopyRoomCode}
              className="ml-1 p-1 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition flex items-center gap-1"
              title="Copy Room Code Only"
              aria-label="Copy Room Code Only"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-semibold hidden md:inline">Copied!</span>
                </>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Dedicated Share Link Button */}
          <button
            onClick={handleShareLink}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition"
            title="Share or Copy Room Link"
            aria-label="Share or Copy Room Link"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share Link</span>
              </>
            )}
          </button>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {getRoleBadge()}

          <button
            onClick={handleLeave}
            className="px-3 py-1.5 rounded-theme bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
            title="Leave Room"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {/* Main Room Layout */}
      <main className="flex-1 flex flex-col lg:flex-row p-2.5 sm:p-4 gap-4 max-w-[1700px] w-full mx-auto overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Player & Reactions (approx 70%) */}
        <section className="flex-1 flex flex-col relative min-w-0">
          <div className="relative flex-1 flex flex-col">
            <YouTubePlayer />
            <ReactionsOverlay />
          </div>
        </section>

        {/* Right Column: Sidebar with Tabs (approx 30% / 380px) */}
        <aside className="w-full lg:w-96 flex flex-col glass-panel p-4 h-[580px] lg:h-[calc(100vh-6rem)]">
          {/* Sidebar Tab Header */}
          <div className="grid grid-cols-3 p-1 bg-black/40 rounded-theme border border-white/5 mb-3">
            <button
              onClick={() => setActiveTab('participants')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === 'participants'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users ({participants.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition relative ${
                activeTab === 'requests'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Requests</span>
              {requests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-pink text-[10px] font-bold text-white flex items-center justify-center">
                  {requests.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'participants' && <ParticipantsTab />}
            {activeTab === 'chat' && <ChatTab />}
            {activeTab === 'requests' && <RequestsTab />}
          </div>
        </aside>
      </main>
    </div>
  );
};
