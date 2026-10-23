import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Ban, Server, Home } from 'lucide-react';

export const ConnectingScreen: React.FC<{ isWaking?: boolean }> = ({ isWaking = false }) => (
  <div className="min-h-screen bg-brand-darkBg flex items-center justify-center p-4">
    <div className="glass-panel max-w-md w-full p-8 text-center flex flex-col items-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full bg-brand-violet/20 flex items-center justify-center animate-ping absolute inset-0" />
        <div className="w-16 h-16 rounded-full bg-brand-violet/30 flex items-center justify-center relative z-10">
          <Server className="w-8 h-8 text-brand-pink" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">
        {isWaking ? 'Waking Up Room Server...' : 'Connecting to WatchParty...'}
      </h2>
      <p className="text-sm text-slate-400 max-w-sm mb-4 leading-relaxed">
        {isWaking
          ? 'Render instances may spin down after inactivity. Server is starting up, this will take about 15-30 seconds.'
          : 'Synchronizing real-time video state and participants...'}
      </p>
      <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-violet to-brand-pink animate-pulse w-3/4 rounded-full" />
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
