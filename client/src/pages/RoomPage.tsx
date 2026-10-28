import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext.js';
import { YouTubePlayer } from '../components/YouTubePlayer.js';
import { ParticipantsTab } from '../components/ParticipantsTab.js';
import { ChatTab } from '../components/ChatTab.js';
import { RequestsTab } from '../components/RequestsTab.js';
import { ReactionsOverlay } from '../components/ReactionsOverlay.js';
import { AvatarSelector } from '../components/AvatarSelector.js';
import {
  ConnectingScreen,
  NotFoundScreen,
  RemovedScreen,
  DisconnectedScreen,
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
    chatMessages,
    toastMessage,
    joinRoom,
    leaveRoom,
    clearToast,
  } = useRoom();

  const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'requests'>('chat');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const prevChatCountRef = React.useRef<number>(chatMessages.length);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [promptUsername, setPromptUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempAvatar, setTempAvatar] = useState<string>(() => sessionStorage.getItem('wp_avatar') || '🍿');

  // Track unread chat messages when user is not on the chat tab
  useEffect(() => {
    if (activeTab === 'chat') {
      setUnreadChatCount(0);
      prevChatCountRef.current = chatMessages.length;
    } else {
      const diff = chatMessages.length - prevChatCountRef.current;
      if (diff > 0) {
        setUnreadChatCount((prev) => prev + diff);
      }
      prevChatCountRef.current = chatMessages.length;
    }
  }, [chatMessages, activeTab]);

  // Only redirect if explicitly removed/banned by host
  useEffect(() => {
    if (connectionStatus === 'removed') {
      const timer = setTimeout(() => {
        navigate('/');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, navigate]);

  // 1. Join room on mount
  useEffect(() => {
    if (!id) return;

    const currentRoom = sessionStorage.getItem('wp_current_room');
    if (currentRoom && currentRoom !== id) {
      sessionStorage.removeItem('wp_user_id');
      sessionStorage.removeItem('wp_reconnect_token');
    }
    sessionStorage.setItem('wp_current_room', id);

    const savedUsername = sessionStorage.getItem('wp_username');
    const savedAvatar = sessionStorage.getItem('wp_avatar') || undefined;
    if (savedUsername) {
      joinRoom(id, savedUsername, savedAvatar);
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
    sessionStorage.removeItem('wp_user_id');
    sessionStorage.removeItem('wp_reconnect_token');
    sessionStorage.setItem('wp_username', tempUsername.trim());
    sessionStorage.setItem('wp_avatar', tempAvatar);
    joinRoom(id, tempUsername.trim(), tempAvatar);
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

  if (connectionStatus === 'disconnected' && !syncState) {
    return <DisconnectedScreen />;
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
            <AvatarSelector
              selectedAvatar={tempAvatar}
              onSelectAvatar={setTempAvatar}
              label="Choose Profile Photo"
            />
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Eye className="w-3.5 h-3.5" /> Viewer
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-darkBg text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-brand-border/60 px-4 sm:px-6 flex items-center justify-between bg-brand-darkBg/95 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center shadow">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base gradient-text hidden sm:inline">
              WatchParty
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Room Code Badge */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Room:
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

          {/* Watchers Profile Photos Facepile */}
          {participants.length > 0 && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10"
              title="Watchers currently in room"
            >
              <div className="flex items-center -space-x-2">
                {participants.slice(0, 5).map((p) => (
                  <div
                    key={p.userId}
                    title={`${p.username} (${p.role})`}
                    className="w-7 h-7 rounded-full border-2 border-brand-darkBg bg-brand-darkSurface overflow-hidden flex items-center justify-center text-xs shadow shrink-0"
                  >
                    {p.avatar ? (
                      p.avatar.startsWith('data:image/') ? (
                        <img src={p.avatar} alt={p.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm select-none">{p.avatar}</span>
                      )
                    ) : (
                      <span className="font-bold text-[9px] text-white bg-gradient-to-tr from-brand-violet to-brand-pink w-full h-full flex items-center justify-center">
                        {p.username.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-[11px] font-semibold text-slate-300 ml-1">
                {participants.length} watching
              </span>
            </div>
          )}
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-brand-darkSurface flex items-center justify-center text-sm shadow">
              {sessionStorage.getItem('wp_avatar')?.startsWith('data:image/') ? (
                <img src={sessionStorage.getItem('wp_avatar')!} alt="You" className="w-full h-full object-cover" />
              ) : (
                <span>{sessionStorage.getItem('wp_avatar') || '🍿'}</span>
              )}
            </div>
            {getRoleBadge()}
          </div>

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

      {/* Reconnecting banner if temporary network drop occurs */}
      {connectionStatus === 'disconnected' && syncState && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500/95 text-slate-900 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-ping" />
          <span>Reconnecting to WatchParty... Keeping your session active</span>
        </div>
      )}

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
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition relative ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {unreadChatCount > 0 && activeTab !== 'chat' && (
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
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
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center font-bold">
                  {requests.length}
                </span>
              )}
            </button>
          </div>

          {/* Sidebar Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'participants' && <ParticipantsTab />}
            {activeTab === 'chat' && <ChatTab />}
            {activeTab === 'requests' && <RequestsTab />}
          </div>
        </aside>
      </main>

      {/* Ephemeral Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 glass-card px-4 py-3 rounded-theme border border-brand-pink/30 shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
          <div className="w-2 h-2 rounded-full bg-brand-pink animate-pulse" />
          <span className="text-xs text-slate-200 font-medium">{toastMessage}</span>
          <button
            onClick={clearToast}
            className="text-slate-400 hover:text-white ml-2 transition"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
