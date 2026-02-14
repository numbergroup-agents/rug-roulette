'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SlotCard } from '@/components/SlotCard';
import { SLOTS, Slot, GameState, ENTRY_FEE_SOL } from '@/lib/game';

export default function Home() {
  const { connected } = useWallet();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [slots, setSlots] = useState<Slot[]>(SLOTS);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [rugOrder, setRugOrder] = useState<number[]>([]);
  const [currentRugIndex, setCurrentRugIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);

  const startGame = useCallback(() => {
    if (selectedSlot === null) return;
    
    setGameState('running');
    setCountdown(5);
    
    const survivorId = Math.floor(Math.random() * 6);
    const toRug = slots
      .filter(s => s.id !== survivorId)
      .map(s => s.id)
      .sort(() => Math.random() - 0.5);
    
    setRugOrder(toRug);
  }, [selectedSlot, slots]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && gameState === 'running') {
      setGameState('rugging');
    }
  }, [countdown, gameState]);

  useEffect(() => {
    if (gameState !== 'rugging') return;
    if (currentRugIndex >= rugOrder.length) {
      setGameState('finished');
      return;
    }

    const timer = setTimeout(() => {
      const idToRug = rugOrder[currentRugIndex];
      setSlots(prev => prev.map(s => 
        s.id === idToRug ? { ...s, status: 'rugged' } : s
      ));
      setCurrentRugIndex(currentRugIndex + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [gameState, currentRugIndex, rugOrder]);

  useEffect(() => {
    if (gameState === 'finished') {
      setSlots(prev => prev.map(s => 
        s.status === 'active' ? { ...s, status: 'survivor' } : s
      ));
    }
  }, [gameState]);

  const resetGame = () => {
    setGameState('waiting');
    setSlots(SLOTS.map(s => ({ ...s, status: 'active' })));
    setSelectedSlot(null);
    setCountdown(null);
    setRugOrder([]);
    setCurrentRugIndex(0);
  };

  const playerWon = gameState === 'finished' && 
    slots.find(s => s.id === selectedSlot)?.status === 'survivor';

  return (
    <main className="bg-casino min-h-screen px-4 py-8 md:p-12 relative">
      <div className="mx-auto max-w-5xl">
        
        {/* Header */}
        <header className="mb-12 flex items-start justify-between">
          <div className="text-center flex-1">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-3">
              <span className="gradient-text">RUG ROULETTE</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl">
              6 Slots · 5 Rugs · 1 Survivor
            </p>
          </div>
          <div className="absolute right-4 top-8 md:right-12 md:top-12">
            <WalletMultiButton />
          </div>
        </header>

        {/* Players Display */}
        <div className="pot-display rounded-2xl p-6 mb-10 text-center">
          <p className="text-yellow-500/70 text-sm uppercase tracking-widest mb-1">Players</p>
          <p className="text-4xl md:text-5xl font-black text-yellow-400 text-glow">
            {playerCount}/6
          </p>
        </div>

        {/* Game Status */}
        {!connected && (
          <div className="glass rounded-2xl p-8 mb-10 text-center">
            <p className="text-xl text-gray-300">Connect wallet to play</p>
            <p className="text-gray-500 mt-2">Entry: {ENTRY_FEE_SOL} SOL per round</p>
          </div>
        )}

        {connected && gameState === 'waiting' && (
          <div className="glass rounded-2xl p-8 mb-10 text-center">
            {selectedSlot !== null ? (
              <>
                <p className="text-gray-400 mb-2">Your pick</p>
                <p className="text-3xl mb-6">
                  <span className="text-4xl mr-2">{slots[selectedSlot].emoji}</span>
                  <span className="font-bold text-white">{slots[selectedSlot].name}</span>
                </p>
                <button onClick={startGame} className="btn-glow">
                  🎰 Spin for {ENTRY_FEE_SOL} SOL
                </button>
              </>
            ) : (
              <p className="text-xl text-gray-300">Pick a slot below</p>
            )}
          </div>
        )}

        {gameState === 'running' && countdown !== null && (
          <div className="glass rounded-2xl p-10 mb-10 text-center">
            <p className="text-orange-400 text-xl mb-4">Rugging in...</p>
            <p className="countdown text-8xl font-black text-orange-500 text-glow">
              {countdown}
            </p>
          </div>
        )}

        {gameState === 'rugging' && (
          <div className="glass rounded-2xl p-8 mb-10 text-center border-red-500/30">
            <p className="text-red-400 text-2xl animate-pulse">
              🪤 Rugging in progress...
            </p>
            <p className="text-gray-500 mt-2">
              {5 - currentRugIndex} slots remaining
            </p>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center mb-10">
            <button onClick={resetGame} className="btn-glow btn-glow-green">
              🔄 Play Again
            </button>
          </div>
        )}

        {/* Slots Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-12">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isSelected={selectedSlot === slot.id}
              onSelect={() => {
                if (gameState === 'waiting' && connected) {
                  setSelectedSlot(slot.id);
                }
              }}
              disabled={gameState !== 'waiting' || !connected}
            />
          ))}
        </div>

        {/* Results */}
        {gameState === 'finished' && (
          <div className={`rounded-3xl p-10 text-center ${playerWon ? 'result-winner' : 'result-loser'}`}>
            <p className="text-6xl mb-4">{playerWon ? '🎉' : '💀'}</p>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              {playerWon ? 'YOU SURVIVED!' : 'RUGGED'}
            </h2>
            <p className="text-xl text-gray-300">
              {playerWon
                ? 'You beat the odds!'
                : `Lost ${ENTRY_FEE_SOL} SOL. Try again?`}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
