import React, { useRef } from 'react';
import { Camera, Sparkles, Check } from 'lucide-react';

export const PRESET_AVATARS = [
  '🍿', '🎬', '🕶️', '👑', '🚀', '🤖', 
  '🐱', '🦊', '🎧', '🎮', '⚡', '🍕'
];

interface AvatarSelectorProps {
  selectedAvatar: string;
  onSelectAvatar: (avatar: string) => void;
  label?: string;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  onSelectAvatar,
  label = 'Choose Avatar or Photo',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCustomImage = selectedAvatar.startsWith('data:image/');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 96x96 on canvas for ultra lightweight base64
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw square cropped & centered
        const size = Math.min(img.width, img.height);
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 96, 96);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        onSelectAvatar(compressedDataUrl);
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-normal">
          <Sparkles className="w-3 h-3 text-brand-pink" /> Profile Photo
        </span>
      </div>

      <div className="flex items-center gap-3 p-2.5 bg-brand-darkSurface/90 border border-white/10 rounded-theme">
        {/* Active Avatar Display */}
        <div className="relative group shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-pink shadow-md bg-gradient-to-tr from-brand-violet/40 to-brand-pink/40 flex items-center justify-center text-2xl select-none">
            {isCustomImage ? (
              <img
                src={selectedAvatar}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{selectedAvatar}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
            title="Upload custom photo"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets & Upload Button */}
        <div className="flex-1 overflow-x-auto py-1 scrollbar-none flex items-center gap-1.5">
          {PRESET_AVATARS.map((emoji) => {
            const isSelected = selectedAvatar === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelectAvatar(emoji)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 transition relative ${
                  isSelected
                    ? 'bg-brand-pink/30 border-2 border-brand-pink scale-110 shadow-sm'
                    : 'bg-white/5 hover:bg-white/15 border border-white/5 hover:scale-105'
                }`}
              >
                <span>{emoji}</span>
                {isSelected && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-pink rounded-full flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" />
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 transition ${
              isCustomImage
                ? 'bg-brand-violet text-white shadow'
                : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-brand-pink" />
            <span>{isCustomImage ? 'Change Photo' : 'Upload Photo'}</span>
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
};

