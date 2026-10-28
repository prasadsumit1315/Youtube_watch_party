import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Ban, Home, Film, Clapperboard } from 'lucide-react';

export const ConnectingScreen: React.FC<{ isWaking?: boolean }> = ({ isWaking = false }) => (
  <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4 relative overflow-hidden">
    {/* Ambient Cinema Lighting / Projector beam */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-rose-500/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-36 bg-brand-pink/20 blur-2xl rounded-full pointer-events-none animate-cinema-beam" />

    <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center relative z-10 border border-white/10 shadow-2xl cinema-card">
      {/* Movie badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 mb-5 tracking-wide">
        <Film className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        <span>WatchParty Cinema</span>
      </div>

      {/* Movie Film Reel Visual */}
      <div className="relative mb-6">
        {/* Soft rotating outer glow ring */}
        <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-brand-violet/30 via-rose-500/20 to-amber-500/30 blur-md animate-pulse" />

        {/* Vintage Film Reel Container */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border-2 border-rose-500/40 shadow-inner flex items-center justify-center">
          {/* Rotating reel spokes & circular cutouts */}
          <svg
            className="absolute inset-0 w-full h-full animate-[spin_5s_linear_infinite]"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer reel ring track */}
            <circle cx="50" cy="50" r="42" stroke="rgba(244,63,94,0.4)" strokeWidth="3" strokeDasharray="6 4" />
            {/* 6 Film reel cutouts */}
            <circle cx="50" cy="22" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            <circle cx="50" cy="78" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            <circle cx="26" cy="36" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            <circle cx="74" cy="36" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            <circle cx="26" cy="64" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            <circle cx="74" cy="64" r="7" fill="rgba(9,10,15,0.9)" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" />
            {/* Center reel hub rim */}
            <circle cx="50" cy="50" r="16" fill="rgba(15,17,28,0.8)" stroke="rgba(251,146,60,0.5)" strokeWidth="2" />
          </svg>

          {/* Center cinema clapper icon */}
          <div className="relative z-10 w-9 h-9 rounded-full bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Clapperboard className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Projector light beam radiating downwards */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-gradient-to-b from-rose-400/30 to-transparent blur-sm pointer-events-none" />
      </div>

      {/* Screen Title */}
      <h2 className="text-xl font-bold text-slate-100 tracking-wide mb-1">
        {isWaking ? 'Waking Up Room Server...' : 'Connecting to WatchParty...'}
      </h2>

      {/* ONLY show server waking hint if waking; NO down message for normal connecting! */}
      {isWaking && (
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-3 leading-relaxed">
          Cloud instance is spinning up. This usually takes 15–30 seconds...
        </p>
      )}

      {/* 35mm Filmstrip Rolling Loader */}
      <div className="mt-5 w-60 bg-black/60 border border-white/10 rounded-lg p-2 shadow-inner">
        {/* Top film perforations */}
        <div className="flex justify-between items-center px-1 mb-1.5 opacity-60">
          {[...Array(9)].map((_, i) => (
            <div key={`perf-top-${i}`} className="w-2.5 h-1.5 rounded-[2px] bg-slate-300/40" />
          ))}
        </div>

        {/* Film track with rolling frames */}
        <div className="relative h-6 bg-slate-950 rounded overflow-hidden flex items-center border border-white/5">
          <div className="flex items-center gap-2 animate-film-roll w-[200%]">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="min-w-[40px] h-4 rounded-sm bg-gradient-to-r from-rose-500/20 via-purple-500/20 to-pink-500/20 border border-rose-400/30 flex items-center justify-center flex-shrink-0"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400/70" />
              </div>
            ))}
          </div>
          {/* Glowing laser scanline across the film */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-400/20 to-transparent animate-pulse pointer-events-none" />
        </div>

        {/* Bottom film perforations */}
        <div className="flex justify-between items-center px-1 mt-1.5 opacity-60">
          {[...Array(9)].map((_, i) => (
            <div key={`perf-bottom-${i}`} className="w-2.5 h-1.5 rounded-[2px] bg-slate-300/40" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const NotFoundScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Room Not Found</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          The requested room does not exist, has expired after inactivity, or was closed.
        </p>
        <button
          onClick={() => navigate('/')}
          className="gradient-btn px-6 py-2.5 rounded-theme text-sm font-semibold text-white shadow-lg flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Back to Home
        </button>
      </div>
    </div>
  );
};

export const RemovedScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
          <Ban className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Removed from Room</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          You have been removed and banned from this WatchParty room by the Host.
        </p>
        <button
          onClick={() => navigate('/')}
          className="gradient-btn px-6 py-2.5 rounded-theme text-sm font-semibold text-white shadow-lg flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Return to Home
        </button>
      </div>
    </div>
  );
};

export const DisconnectedScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Disconnected from Room</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
          You have been disconnected from the session. Returning to the home page...
        </p>
        <button
          onClick={() => navigate('/')}
          className="gradient-btn px-6 py-2.5 rounded-theme text-sm font-semibold text-white shadow-lg flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Return to Home Now
        </button>
      </div>
    </div>
  );
};
