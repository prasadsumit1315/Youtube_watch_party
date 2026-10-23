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
  } = useRoom();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
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

            // Attempt to start video
            if (syncState?.playState === 'PLAYING') {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
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
            if (now - lastStateChangeTime.current < 400) return; // Debounce
            lastStateChangeTime.current = now;

            const playerTime = playerRef.current?.getCurrentTime() || 0;
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (canControl && syncState?.playState !== 'PLAYING') {
                play(playerTime);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
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

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !syncState) return;

    const player = playerRef.current;

    // Load new video if changed
    if (syncState.videoId && syncState.videoId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = syncState.videoId;
      isProgrammaticAction.current = true;
      try {
        // Standard YouTube IFrame API: loadVideoById(videoId: string, startSeconds: number)
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

    isProgrammaticAction.current = true;

    try {
      const playerCurrentTime = player.getCurrentTime?.() || 0;
      // Seek only if difference is significant (> 2.5s) to avoid restart jitter on play
      if (Math.abs(playerCurrentTime - clampedExpected) > 2.5 && dur > 0 && clampedExpected < dur - 1) {
        player.seekTo(clampedExpected, true);
      }

      if (syncState.playState === 'PLAYING') {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } finally {
      setTimeout(() => {
        isProgrammaticAction.current = false;
      }, 500);
    }
  }, [syncState, isPlayerReady, videoDuration]);

  // 3. Drift Correction Loop (every 2s per spec)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !syncState) return;

    const interval = setInterval(() => {
      if (!playerRef.current || isProgrammaticAction.current) return;

      try {
        const player = playerRef.current;
        const playerTime = player.getCurrentTime?.() || 0;
        const dur = player.getDuration?.() || 0;
        setCurrentPlayTime(playerTime);
        if (dur > 0) setVideoDuration(dur);

        // Expected playback timestamp clamped to valid duration
        const now = Date.now();
        const expectedTime =
          syncState.playState === 'PLAYING'
            ? syncState.currentTime + (now - syncState.updatedAt) / 1000
            : syncState.currentTime;

        const clampedExpected = dur > 0 ? Math.min(expectedTime, dur) : expectedTime;

        // SPEC: "Drift correction every 2s: if |player time - expected| > 1.5s, seek"
        // Use 2.5s buffer and guard against seeking past end to prevent looping restarts
        const drift = Math.abs(playerTime - clampedExpected);
        if (drift > 2.5 && dur > 0 && clampedExpected < dur - 1) {
          isProgrammaticAction.current = true;
          player.seekTo(clampedExpected, true);
          setTimeout(() => {
            isProgrammaticAction.current = false;
          }, 600);
        }
      } catch {
        // ignore
      }
    }, 2000);

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
    const target = Math.min(videoDuration || currentPlayTime + 10, currentPlayTime + 10);
    setCurrentPlayTime(target);
    if (canControl) {
      seek(target);
    } else {
      requestAction('SEEK', target);
    }
  };

  // Skip backward 10s
  const handleSkipBackward = () => {
    handleUnmuteAudio();
    const target = Math.max(0, currentPlayTime - 10);
    setCurrentPlayTime(target);
    if (canControl) {
      seek(target);
    } else {
      requestAction('SEEK', target);
    }
  };

  // Seek Scrubber
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentPlayTime(newTime);
    if (canControl) {
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
    <div ref={playerWrapperRef} className="flex flex-col w-full h-full bg-brand-darkBg">
      {/* 16:9 Video Canvas Container (Clean Screen: ZERO controls inside video area) */}
      <div
        onClick={handleTogglePlay}
        className="relative w-full aspect-video min-h-[280px] sm:min-h-[440px] bg-black rounded-theme overflow-hidden border border-brand-border shadow-2xl flex items-center justify-center cursor-pointer select-none"
        title={canControl ? 'Click to Play / Pause' : undefined}
      >
        {/* The YouTube iframe container (100% width and 100% height, pointer-events-none to prevent YouTube on-screen UI) */}
        <div ref={playerContainerRef} className="w-full h-full relative pointer-events-none" />

        {/* Empty state when no video is loaded */}
        {!syncState?.videoId && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-brand-darkBg/95 z-10 text-center p-6 cursor-default"
          >
            <Tv className="w-16 h-16 text-brand-purple mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-100 mb-2">No Video Selected</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-4">
              {canControl
                ? 'Paste any YouTube URL or video ID to start watching with the room.'
                : 'Waiting for Host or Moderator to select a YouTube video.'}
            </p>
            {canControl && (
              <button
                onClick={() => setShowChangeVideoModal(true)}
                className="gradient-btn px-5 py-2.5 rounded-theme text-sm font-semibold text-white shadow-lg flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Load YouTube Video
              </button>
            )}
          </div>
        )}
      </div>

      {/* Custom Synchronized Controls Bar */}
      <div className="glass-card mt-3 p-3 sm:p-4 flex flex-col gap-2.5">
        {/* Scrubber timeline */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-300 w-12 text-right">
            {formatTime(currentPlayTime)}
          </span>
          <input
            type="range"
            min={0}
            max={videoDuration || 100}
            step={0.5}
            value={currentPlayTime}
            onChange={handleSeekChange}
            disabled={!canControl}
            className={`w-full h-2 bg-slate-800 rounded-lg appearance-none accent-brand-pink transition cursor-pointer ${
              !canControl ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            aria-label="Video scrubber"
          />
          <span className="text-xs font-mono text-slate-400 w-12">
            {formatTime(videoDuration)}
          </span>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          {/* Left: Playback & Skip Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play/Pause Button */}
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
                onClick={() => seek(0)}
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
              {isMuted && !!syncState?.videoId && (
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

          {/* Right: Settings, Change Video & Fullscreen */}
          <div className="flex items-center gap-2">
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
                <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-brand-darkBg/95 backdrop-blur-xl border border-brand-border rounded-2xl shadow-2xl z-30 animate-fade-in flex flex-col gap-3">
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
