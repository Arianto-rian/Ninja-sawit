import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';
import { Moon, Play, RefreshCw, ShoppingBag } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);

  const handleStart = () => {
    setScore(0);
    setCoins(0);
    setGameState(GameState.PLAYING);
  };

  const handleScoreUpdate = (newScore: number, newCoins: number) => {
    setScore(newScore);
    setCoins(newCoins);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-4xl">
        
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Moon className="text-yellow-200 w-8 h-8" fill="currentColor" />
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 tracking-tighter">
            NINJA SAWIT
          </h1>
        </div>

        {/* Game Container */}
        <div className="relative">
          <GameCanvas 
            gameState={gameState} 
            setGameState={setGameState}
            onScoreUpdate={handleScoreUpdate}
          />

          {/* MENU SCREEN */}
          {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20 backdrop-blur-sm rounded-lg">
              <h2 className="text-5xl font-bold mb-2 text-emerald-500">STEALTH HARVEST</h2>
              <p className="text-slate-400 mb-8 max-w-md text-center">
                Infiltrate the plantation. Climb trees. Harvest fruits. <br/> Avoid the guard's flashlight at all costs.
              </p>
              
              <button 
                onClick={handleStart}
                className="group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-3"
              >
                <Play className="fill-current group-hover:scale-110 transition-transform" />
                START MISSION
              </button>
              
              <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <kbd className="bg-slate-800 px-2 py-1 rounded border border-slate-700">WASD</kbd> 
                  <span>Move</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="bg-slate-800 px-2 py-1 rounded border border-slate-700">SHIFT</kbd> 
                  <span>Action/Hide</span>
                </div>
              </div>
            </div>
          )}

          {/* GAME OVER SCREEN */}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-white z-20 backdrop-blur-sm rounded-lg border-4 border-red-600">
              <h2 className="text-6xl font-black mb-4 text-red-500 tracking-widest">CAUGHT!</h2>
              
              <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 mb-8 text-center w-64">
                <p className="text-slate-400 text-sm uppercase tracking-wider mb-1">Total Score</p>
                <p className="text-4xl font-mono text-white mb-4">{score}</p>
                
                <div className="flex justify-between text-yellow-400 border-t border-slate-700 pt-2">
                  <span>Coins Earned</span>
                  <span>{coins}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={handleStart}
                  className="px-6 py-3 bg-white text-red-900 font-bold rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={20} />
                  RETRY
                </button>
                <button className="px-6 py-3 bg-slate-800 text-white font-bold rounded hover:bg-slate-700 transition-colors flex items-center gap-2 opacity-50 cursor-not-allowed">
                  <ShoppingBag size={20} />
                  SHOP (Coming Soon)
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-center text-slate-600 text-sm">
          Pro Tip: Hiding behind tree fronds makes you invisible to flashlights.
        </div>
      </div>
    </div>
  );
};

export default App;
