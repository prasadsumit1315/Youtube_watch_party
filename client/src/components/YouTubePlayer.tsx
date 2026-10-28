import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext.js';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Tv,
  Send,
  Sparkles,
  Maximize,
  Minimize,
  FastForward,
  Rewind,
  Radio,
  Settings,
  Check,
  MonitorUp,
  StopCircle,
} from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiLoadedPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (apiLoadedPromise) return apiLoadedPromise;

  apiLoadedPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
  });

  return apiLoadedPromise;
}

export const YouTubePlayer: React.FC = () => {
  const {
    syncState,
    ownRole,
    play,
    pause,
    seek,
    changeVideo,
    requestAction,
    isScreenSharing,
    isLocalScreenShare,
    screenStream,
    startScreenShare,
    stopScreenShare,
  } = useRoom();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const isProgrammaticAction = useRef<boolean>(false);
  const lastStateChangeTime = useRef<number>(0);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');

  const canControl = ownRole === 'HOST' || ownRole === 'MODERATOR';

  // Attach screen share stream to video element
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isScreenSharing]);

  // 1. Initialize Player using host: https://www.youtube-nocookie.com per spec
  useEffect(() => {
    let isCancelled = false;

    loadYouTubeIframeApi().then(() => {
      if (isCancelled || !playerContainerRef.current) return;

      const playerElementId = 'watchparty-yt-player';
      let element = document.getElementById(playerElementId);
      if (!element) {
        element = document.createElement('div');
        element.id = playerElementId;
        playerContainerRef.current.appendChild(element);
      }

      playerRef.current = new window.YT.Player(playerElementId, {
        width: '100%',
        height: '100%',
        host: 'https://www.youtube-nocookie.com',
        videoId: syncState?.videoId || 'dQw4w9WgXcQ',
        playerVars: {
          autoplay: 1,
          controls: 0, // Clean screen: NO controls inside video screen area
          disablekb: 1,
          enablejsapi: 1,
          fs: 0, // No native controls on video
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3, // Disable annotations inside screen
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            setVideoDuration(event.target.getDuration() || 0);

            // Attempt to unmute and set full volume
            try {
              event.target.unMute();
              event.target.setVolume(100);
              setIsMuted(event.target.isMuted());
            } catch {
              // ignore
            }

            // Attempt to start video automatically; if mobile policy restricts sound, mute & play
            if (syncState?.playState === 'PLAYING') {
              try {
                event.target.playVideo();
                setTimeout(() => {
                  try {
                    const s = event.target.getPlayerState();
                    if (s !== window.YT.PlayerState.PLAYING && s !== window.YT.PlayerState.BUFFERING) {
                      event.target.mute();
                      event.target.playVideo();
                      setIsMuted(true);
                    }
                  } catch {
                    // ignore
                  }
                }, 400);
              } catch {
                try {
                  event.target.mute();
                  event.target.playVideo();
                  setIsMuted(true);
                } catch {
                  // ignore
                }
              }
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;

            // Track audio mute status
            try {
              if (playerRef.current?.isMuted) {
                setIsMuted(playerRef.current.isMuted());
              }
            } catch {
              // ignore
            }

            // Ignore if triggered programmatically
            if (isProgrammaticAction.current) {
              return;
            }

            const now = Date.now();
            if (now - lastStateChangeTime.current < 500) return; // Debounce
            lastStateChangeTime.current = now;

            const playerTime = playerRef.current?.getCurrentTime() || 0;
            if (state === window.YT.PlayerState.PLAYING) {
              if (canControl && syncState?.playState !== 'PLAYING') {
                play(playerTime);
              }
            } else if (state === window.YT.PlayerState.PAUSED) {
              if (canControl && syncState?.playState !== 'PAUSED') {
                pause(playerTime);
              }
            }
          },
        },
      });
    });

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      isCancelled = true;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 2. React to syncState changes from Server
  const currentVideoIdRef = useRef<string>('');
  const lastServerUpdatedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !syncState) return;

    const player = playerRef.current;

    // Load new video if changed
    if (syncState.videoId && syncState.videoId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = syncState.videoId;
      isProgrammaticAction.current = true;
      try {
        player.loadVideoById(syncState.videoId, syncState.currentTime || 0);
        setTimeout(() => {
          isProgrammaticAction.current = false;
        }, 1000);
        return;
      } catch {
        isProgrammaticAction.current = false;
      }
    }

    // Apply Play / Pause with duration bounds
    const dur = player.getDuration?.() || videoDuration || 0;
    const expectedTime =
      syncState.playState === 'PLAYING'
        ? syncState.currentTime + (Date.now() - syncState.updatedAt) / 1000
        : syncState.currentTime;

    const clampedExpected = dur > 0 ? Math.min(expectedTime, dur) : expectedTime;

    const isNewServerAction = syncState.updatedAt !== lastServerUpdatedAtRef.current;
    lastServerUpdatedAtRef.current = syncState.updatedAt;

    isProgrammaticAction.current = true;

    try {
      const playerCurrentTime = player.getCurrentTime?.() || 0;
      const isBuffering = player.getPlayerState?.() === 3;
      const isInitialStartup = playerCurrentTime < 4 && clampedExpected < 6;

      // On explicit server action (seek, play, pause, etc.), execute seek immediately if out of sync
      if (isNewServerAction) {
        if (Math.abs(playerCurrentTime - clampedExpected) > 0.8) {
          player.seekTo(clampedExpected, true);
          setCurrentPlayTime(clampedExpected);
        }
      } else if (!isBuffering && !isInitialStartup && Math.abs(playerCurrentTime - clampedExpected) > 3.0 && dur > 0 && clampedExpected < dur - 1) {
        player.seekTo(clampedExpected, true);
      }

      if (syncState.playState === 'PLAYING') {
        try {
          player.playVideo();
          setTimeout(() => {
            try {
              const s = player.getPlayerState?.();
              if (s !== 1 && s !== 3) {
                player.mute();
                player.playVideo();
                setIsMuted(true);
              }
            } catch {
              // ignore
            }
          }, 400);
        } catch {
          try {
            player.mute();
            player.playVideo();
            setIsMuted(true);
          } catch {
            // ignore
          }
        }
      } else {
        player.pauseVideo();
      }
    } finally {
      setTimeout(() => {
        isProgrammaticAction.current = false;
      }, 600);
    }
  }, [syncState, isPlayerReady, videoDuration]);

  // 3. Playback time updater & Drift Correction Loop (every 500ms)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !syncState) return;

    let tick = 0;
    const interval = setInterval(() => {
      if (!playerRef.current) return;

      try {
        const player = playerRef.current;
        const playerTime = player.getCurrentTime?.() || 0;
        const dur = player.getDuration?.() || 0;

        // Only update currentPlayTime if not in a user programmatic seek
        if (!isProgrammaticAction.current) {
          setCurrentPlayTime(playerTime);
        }
        if (dur > 0) setVideoDuration(dur);

        // Drift check every 2 seconds (every 4 ticks of 500ms)
        tick++;
        if (tick % 4 !== 0 || isProgrammaticAction.current) return;

        const isBuffering = player.getPlayerState?.() === 3;
        const s = player.getPlayerState?.();
        // If buffering or paused, do not force seek
        if (isBuffering || s === 2) return;

        // Expected playback timestamp clamped to valid duration
        const now = Date.now();
        const expectedTime =
          syncState.playState === 'PLAYING'
            ? syncState.currentTime + (now - syncState.updatedAt) / 1000
            : syncState.currentTime;

        const clampedExpected = dur > 0 ? Math.min(expectedTime, dur) : expectedTime;

        // In first 4 seconds, allow smooth initial buffering
        if (playerTime < 4 && clampedExpected < 6) return;

        // Smooth drift correction with 3s buffer to prevent looping restarts
        const drift = Math.abs(playerTime - clampedExpected);
        if (drift > 3.0 && dur > 0 && clampedExpected < dur - 1) {
          isProgrammaticAction.current = true;
          player.seekTo(clampedExpected, true);
          setTimeout(() => {
            isProgrammaticAction.current = false;
          }, 800);
        }
      } catch {
        // ignore
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlayerReady, syncState]);

  // Explicit Unmute action
  const handleUnmuteAudio = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        setVolume(100);
        setIsMuted(false);
      } catch {
        // ignore
      }
    }
  }, []);

  // Play/Pause toggle
  const handleTogglePlay = useCallback(() => {
    handleUnmuteAudio();
    if (!canControl) {
      setShowRequestModal(true);
      return;
    }
    const time = playerRef.current?.getCurrentTime?.() || 0;
    if (syncState?.playState === 'PLAYING') {
      pause(time);
    } else {
      play(time);
    }
  }, [canControl, syncState, play, pause, handleUnmuteAudio]);

  // Skip forward 10s
  const handleSkipForward = () => {
    handleUnmuteAudio();
    isProgrammaticAction.current = true;

    let current = currentPlayTime || 0;
    try {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const t = playerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) {
          current = t;
        }
      }
    } catch {
      // ignore
    }

    let dur = videoDuration || 0;
    try {
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        const d = playerRef.current.getDuration();
        if (typeof d === 'number' && !isNaN(d) && d > 0) {
          dur = d;
        }
      }
    } catch {
      // ignore
    }

    const target = dur > 0 ? Math.min(dur, current + 10) : current + 10;
    setCurrentPlayTime(target);

    try {
      playerRef.current?.seekTo?.(target, true);
    } catch {
      // ignore
    }

    if (canControl) {
      seek(target);
    } else {
      requestAction('SEEK', target);
    }

    setTimeout(() => {
      isProgrammaticAction.current = false;
    }, 1500);
  };

  // Skip backward 10s
  const handleSkipBackward = () => {
    handleUnmuteAudio();
    isProgrammaticAction.current = true;

    let current = currentPlayTime || 0;
    try {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const t = playerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) {
          current = t;
        }
      }
    } catch {
      // ignore
    }

    const target = Math.max(0, current - 10);
    setCurrentPlayTime(target);

    try {
      playerRef.current?.seekTo?.(target, true);
    } catch {
      // ignore
    }

    if (canControl) {
      seek(target);
    } else {
      requestAction('SEEK', target);
    }

    setTimeout(() => {
      isProgrammaticAction.current = false;
    }, 1500);
  };

  // Seek Scrubber
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentPlayTime(newTime);
    if (canControl) {
      try {
        playerRef.current?.seekTo?.(newTime, true);
      } catch {
        // ignore
      }
      seek(newTime);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerWrapperRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Sync back to room live time
  const handleSyncToLive = () => {
    if (!playerRef.current || !syncState) return;
    const now = Date.now();
    const expectedTime =
      syncState.playState === 'PLAYING'
        ? syncState.currentTime + (now - syncState.updatedAt) / 1000
        : syncState.currentTime;
    isProgrammaticAction.current = true;
    playerRef.current.seekTo(expectedTime, true);
    if (syncState.playState === 'PLAYING') {
      playerRef.current.playVideo();
    }
    setTimeout(() => {
      isProgrammaticAction.current = false;
    }, 500);
  };

  // Volume Change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current) {
      playerRef.current.setVolume(val);
      if (val === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  // Settings: Speed & Quality
  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playerRef.current) {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch {
        // ignore
      }
    }
    setShowSettingsMenu(false);
  };

  const handleSelectQuality = (quality: string) => {
    setCurrentQuality(quality);
    if (playerRef.current) {
      try {
        playerRef.current.setPlaybackQuality(quality);
      } catch {
        // ignore
      }
    }
    setShowSettingsMenu(false);
  };

  const formatQualityLabel = (q: string) => {
    switch (q) {
      case 'highres': return '4K / 2K';
      case 'hd1080': return '1080p HD';
      case 'hd720': return '720p HD';
      case 'large': return '480p';
      case 'medium': return '360p';
      case 'small': return '240p';
      case 'tiny': return '144p';
      case 'auto': return 'Auto';
      default: return q;
    }
  };

  // Change Video submit
  const handleChangeVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrlInput.trim()) return;
    if (canControl) {
      changeVideo(videoUrlInput.trim());
    } else {
      requestAction('CHANGE_VIDEO', undefined, videoUrlInput.trim());
    }
    setVideoUrlInput('');
    setShowChangeVideoModal(false);
  };

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const remainderSeconds = s % 60;
    return `${m}:${remainderSeconds < 10 ? '0' : ''}${remainderSeconds}`;
  };

  return (
    <div ref={playerWrapperRef} className="flex flex-col w-full h-full bg-brand-darkBg relative">
      {/* Cinematic Ambilight Backlight Glow */}
      <div className="absolute -inset-1 sm:-inset-3 rounded-3xl bg-gradient-to-r from-rose-600/15 via-purple-600/10 to-amber-600/15 blur-2xl opacity-60 pointer-events-none" />

      {/* 16:9 Video Canvas Container (Clean Screen: ZERO controls inside video area) */}
      <div
        onClick={handleTogglePlay}
        className="relative w-full aspect-video min-h-[220px] sm:min-h-[440px] bg-black rounded-theme overflow-hidden border border-brand-border/60 shadow-2xl flex items-center justify-center cursor-pointer select-none"
      >
        {/* Screen Share Live Viewport */}
        {isScreenSharing && screenStream ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-20 bg-black flex items-center justify-center"
          >
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted={isLocalScreenShare}
              className="w-full h-full object-contain"
            />
            {/* Live Indicator Overlay */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-xs font-bold shadow-lg backdrop-blur-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>LIVE SCREEN SHARE</span>
            </div>
            {isLocalScreenShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopScreenShare();
                }}
                className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg transition flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" /> Stop Sharing
              </button>
            )}
          </div>
        ) : (
          /* Normal YouTube container */
          <div ref={playerContainerRef} className="w-full h-full relative pointer-events-none" />
        )}

        {/* Empty state when no video and no screen share */}
        {!syncState?.videoId && !isScreenSharing && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-brand-darkBg/95 z-10 text-center p-6 cursor-default"
          >
            <Tv className="w-16 h-16 text-brand-purple mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-100 mb-2">No Video Selected</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-4">
              {canControl
                ? 'Paste any YouTube URL, video ID, or share your screen with the room.'
                : 'Waiting for Host or Moderator to select a YouTube video or start screen share.'}
            </p>
            {canControl && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChangeVideoModal(true)}
                  className="gradient-btn px-5 py-2.5 rounded-theme text-sm font-semibold text-white shadow-lg flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Load YouTube Video
                </button>
                <button
                  onClick={startScreenShare}
                  className="px-4 py-2.5 rounded-theme text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 flex items-center gap-2 transition"
                >
                  <MonitorUp className="w-4 h-4 text-brand-pink" /> Share Screen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Synchronized Controls Bar */}
      <div className="glass-card mt-3 p-3 sm:p-4 flex flex-col gap-2.5">
        {/* Scrubber timeline */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-300 w-12 text-right">
            {isScreenSharing ? 'LIVE' : formatTime(currentPlayTime)}
          </span>
          <input
            type="range"
            min={0}
            max={videoDuration || 100}
            step={0.5}
            value={isScreenSharing ? 100 : currentPlayTime}
            onChange={handleSeekChange}
            disabled={!canControl || isScreenSharing}
            className={`w-full h-2 bg-slate-800 rounded-lg appearance-none accent-brand-pink transition cursor-pointer ${
              !canControl || isScreenSharing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            aria-label="Video scrubber"
          />
          <span className="text-xs font-mono text-slate-400 w-12">
            {isScreenSharing ? 'LIVE' : formatTime(videoDuration)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          {/* Left: Playback & Skip Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play/Pause Button */}
            {!isScreenSharing && (
              <>
                <button
                  onClick={handleTogglePlay}
                  className={`p-2.5 rounded-xl text-white transition active:scale-95 flex items-center gap-1.5 shadow ${
                    canControl
                      ? 'gradient-btn'
                      : 'bg-brand-violet/20 hover:bg-brand-violet/30 text-brand-violet border border-brand-violet/30 text-xs px-3'
                  }`}
                  title={
                    canControl
                      ? syncState?.playState === 'PLAYING'
                        ? 'Pause'
                        : 'Play'
                      : 'Request Play/Pause'
                  }
                  aria-label={syncState?.playState === 'PLAYING' ? 'Pause' : 'Play'}
                >
                  {canControl ? (
                    syncState?.playState === 'PLAYING' ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Request Play</span>
                    </>
                  )}
                </button>

                {/* Skip Backward 10s */}
                <button
                  onClick={handleSkipBackward}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition flex items-center gap-1 text-xs"
                  title="Skip backward 10 seconds"
                  aria-label="Skip backward 10 seconds"
                >
                  <Rewind className="w-4 h-4" />
                  <span className="text-[10px] font-mono hidden sm:inline">-10s</span>
                </button>

                {/* Skip Forward 10s */}
                <button
                  onClick={handleSkipForward}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition flex items-center gap-1 text-xs"
                  title="Skip forward 10 seconds"
                  aria-label="Skip forward 10 seconds"
                >
                  <FastForward className="w-4 h-4" />
                  <span className="text-[10px] font-mono hidden sm:inline">+10s</span>
                </button>

                {/* Restart from beginning */}
                {canControl && (
                  <button
                    onClick={() => {
                      try {
                        playerRef.current?.seekTo?.(0, true);
                        setCurrentPlayTime(0);
                      } catch {
                        // ignore
                      }
                      seek(0);
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition"
                    title="Restart from beginning"
                    aria-label="Restart video"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {/* Sync to Live Button */}
                <button
                  onClick={handleSyncToLive}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-1 transition"
                  title="Re-synchronize with room"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">Live</span>
                </button>
              </>
            )}

            {isScreenSharing && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <span>Screen Share Broadcast Active</span>
              </div>
            )}

            {/* Volume controls */}
            <div className="flex items-center gap-1 ml-1 sm:ml-2">
              <button
                onClick={handleToggleMute}
                className="p-2 rounded-lg text-slate-300 hover:text-white transition"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none accent-slate-300 cursor-pointer"
                aria-label="Volume slider"
              />
              {isMuted && !!syncState?.videoId && !isScreenSharing && (
                <button
                  onClick={handleUnmuteAudio}
                  className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/40 text-xs font-semibold flex items-center gap-1 transition animate-pulse ml-1"
                  title="Unmute audio"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unmute</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Screen Share, Settings, Change Video & Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Screen Share Button (Host/Moderator only) */}
            {canControl && (
              <button
                onClick={isLocalScreenShare ? stopScreenShare : startScreenShare}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  isLocalScreenShare
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
                title={isLocalScreenShare ? 'Stop Sharing Screen' : 'Share Screen with Room'}
              >
                {isLocalScreenShare ? (
                  <>
                    <StopCircle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    <span>Stop Screen</span>
                  </>
                ) : (
                  <>
                    <MonitorUp className="w-3.5 h-3.5 text-brand-pink" />
                    <span>Share Screen</span>
                  </>
                )}
              </button>
            )}

            {/* Settings Menu (Speed & Quality) */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu((prev) => !prev)}
                className={`p-2.5 rounded-xl transition flex items-center justify-center ${
                  showSettingsMenu
                    ? 'bg-brand-pink text-white shadow-lg'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
                title="Settings (Speed & Quality)"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {showSettingsMenu && (
                <>
                  {/* Backdrop for mobile view */}
                  <div
                    className="fixed inset-0 z-30 sm:hidden bg-black/40 backdrop-blur-xs"
                    onClick={() => setShowSettingsMenu(false)}
                  />
                  <div className="fixed inset-x-4 bottom-24 max-w-xs mx-auto sm:max-w-none sm:mx-0 sm:absolute sm:inset-auto sm:right-0 sm:bottom-full sm:mb-2 sm:w-64 p-3.5 bg-brand-darkBg/95 backdrop-blur-xl border border-brand-border rounded-2xl shadow-2xl z-40 animate-fade-in flex flex-col gap-3">
                    {/* Playback Speed section */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Playback Speed
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => handleSelectSpeed(spd)}
                            className={`py-1 px-2 rounded-lg text-xs font-medium transition ${
                              playbackSpeed === spd
                                ? 'bg-brand-pink text-white font-bold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300'
                            }`}
                          >
                            {spd === 1 ? '1x Normal' : `${spd}x`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Video Quality section */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Video Quality
                      </div>
                      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                        {['auto', 'hd1080', 'hd720', 'large', 'medium', 'small'].map((q) => (
                          <button
                            key={q}
                            onClick={() => handleSelectQuality(q)}
                            className={`w-full py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-between transition ${
                              currentQuality === q
                                ? 'bg-brand-violet text-white font-semibold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300'
                            }`}
                          >
                            <span>{formatQualityLabel(q)}</span>
                            {currentQuality === q && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowChangeVideoModal(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Tv className="w-3.5 h-3.5 text-brand-pink" />
              <span>{canControl ? 'Change Video' : 'Suggest Video'}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Change Video Modal */}
      {showChangeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 border border-brand-border rounded-card shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">
              {canControl ? 'Change YouTube Video' : 'Suggest Video to Host'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste any YouTube URL (watch, youtu.be, shorts, embed) or raw 11-char ID.
            </p>
            <form onSubmit={handleChangeVideoSubmit} className="space-y-4">
              <input
                type="text"
                required
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2.5 bg-brand-darkSurface/90 border border-brand-border rounded-theme text-sm text-slate-100 focus:outline-none focus:border-brand-pink"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangeVideoModal(false)}
                  className="px-4 py-2 rounded-theme text-xs font-medium text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gradient-btn px-4 py-2 rounded-theme text-xs font-semibold text-white shadow"
                >
                  {canControl ? 'Load Video' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participant Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 border border-brand-border rounded-card shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">Request Action</h3>
            <p className="text-xs text-slate-400 mb-4">
              Send a playback request to the Host and Moderators.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => {
                  requestAction('PLAY');
                  setShowRequestModal(false);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-theme text-sm font-medium text-slate-200 flex items-center justify-center gap-2 transition"
              >
                <Play className="w-4 h-4 text-emerald-400 fill-current" /> Request Play
              </button>
              <button
                onClick={() => {
                  requestAction('PAUSE');
                  setShowRequestModal(false);
                }}
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-theme text-sm font-medium text-slate-200 flex items-center justify-center gap-2 transition"
              >
                <Pause className="w-4 h-4 text-amber-400 fill-current" /> Request Pause
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-1.5 rounded-theme text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
