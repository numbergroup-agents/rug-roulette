'use client';

import { FC } from 'react';
import { Slot } from '@/lib/game';

interface Props {
  slot: Slot;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

const slotColors: Record<string, { bg: string; glow: string }> = {
  Red: { bg: 'from-red-500 to-red-700', glow: 'rgba(239, 68, 68, 0.4)' },
  Blue: { bg: 'from-blue-500 to-blue-700', glow: 'rgba(59, 130, 246, 0.4)' },
  Green: { bg: 'from-emerald-500 to-emerald-700', glow: 'rgba(16, 185, 129, 0.4)' },
  Yellow: { bg: 'from-yellow-400 to-amber-600', glow: 'rgba(250, 204, 21, 0.4)' },
  Purple: { bg: 'from-purple-500 to-purple-700', glow: 'rgba(168, 85, 247, 0.4)' },
  Orange: { bg: 'from-orange-500 to-orange-700', glow: 'rgba(249, 115, 22, 0.4)' },
};

export const SlotCard: FC<Props> = ({ slot, isSelected, onSelect, disabled }) => {
  const colors = slotColors[slot.name] || { bg: 'from-gray-500 to-gray-700', glow: 'rgba(100,100,100,0.4)' };
  
  const statusClass = slot.status === 'rugged' 
    ? 'rugged' 
    : slot.status === 'survivor' 
    ? 'survivor' 
    : '';
  
  const selectedClass = isSelected && slot.status === 'active' ? 'selected' : '';

  return (
    <button
      onClick={onSelect}
      disabled={disabled || slot.status !== 'active'}
      className={`slot-card ${statusClass} ${selectedClass} ${disabled ? 'cursor-not-allowed' : ''}`}
      style={{
        boxShadow: isSelected && slot.status === 'active' 
          ? `0 0 40px ${colors.glow}, 0 20px 40px rgba(0,0,0,0.3)` 
          : undefined
      }}
    >
      {/* Gradient orb background */}
      <div 
        className={`absolute inset-4 rounded-2xl bg-gradient-to-br ${colors.bg} opacity-20 blur-xl`}
        style={{ transform: 'translateZ(-10px)' }}
      />
      
      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
        {/* Emoji */}
        <div 
          className="text-6xl md:text-7xl mb-3 transition-transform duration-300"
          style={{ 
            filter: slot.status === 'active' ? 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' : 'none',
            transform: isSelected ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {slot.emoji}
        </div>
        
        {/* Name */}
        <p className="text-lg md:text-xl font-bold text-white/90">{slot.name}</p>
        <p className="text-xs text-white/40 mt-1">Slot {slot.id + 1}</p>
      </div>

      {/* Selection ring */}
      {isSelected && slot.status === 'active' && (
        <div className="absolute inset-0 rounded-3xl border-2 border-white/60 pointer-events-none" />
      )}

      {/* YOUR BET badge */}
      {isSelected && slot.status === 'active' && (
        <div className="absolute -top-2 -right-2 z-30">
          <div className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            YOUR BET
          </div>
        </div>
      )}

      {/* Rugged overlay */}
      {slot.status === 'rugged' && (
        <div className="rug-overlay rounded-3xl">
          <span className="text-5xl mb-2">🪤</span>
          <span className="text-2xl font-black text-white tracking-wider">RUGGED</span>
        </div>
      )}

      {/* Survivor badge */}
      {slot.status === 'survivor' && (
        <div className="absolute -top-3 -right-3 z-30">
          <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce">
            ✨ SURVIVOR
          </div>
        </div>
      )}
    </button>
  );
};
