import React, { useEffect, useRef, useState, useCallback } from 'react';

interface HarvestMiniGameProps {
  onSuccess: (quality: number) => void;
  onFail: () => void;
  difficulty: number; // 1 to 3 speed multiplier
}

const HarvestMiniGame: React.FC<HarvestMiniGameProps> = ({ onSuccess, onFail, difficulty }) => {
  const [cursorPos, setCursorPos] = useState(0);
  const [direction, setDirection] = useState(1);
  const [active, setActive] = useState(true);
  
  const requestRef = useRef<number>(0);
  const barWidth = 200;
  const targetStart = 70; // Percent
  const targetEnd = 90; // Percent
  
  const update = useCallback(() => {
    if (!active) return;

    setCursorPos((prev) => {
      let next = prev + (1.5 * difficulty * direction);
      if (next >= 100) {
        setDirection(-1);
        next = 100;
      } else if (next <= 0) {
        setDirection(1);
        next = 0;
      }
      return next;
    });
    requestRef.current = requestAnimationFrame(update);
  }, [active, direction, difficulty]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  const handleTap = () => {
    if (!active) return;
    setActive(false);
    cancelAnimationFrame(requestRef.current);

    if (cursorPos >= targetStart && cursorPos <= targetEnd) {
      // Perfect hit
      onSuccess(2); // Double yield
    } else if (cursorPos >= targetStart - 10 && cursorPos <= targetEnd + 10) {
      // Okay hit
      onSuccess(1); // Normal yield
    } else {
      // Miss
      onFail();
    }
  };

  return (
    <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 p-4 rounded-lg border-2 border-yellow-600 shadow-xl z-50 flex flex-col items-center gap-2 w-64">
      <h3 className="text-yellow-400 font-bold text-sm tracking-widest">HARVEST NOW!</h3>
      <div className="relative w-full h-6 bg-gray-700 rounded-full overflow-hidden border border-gray-500">
        {/* Success Zone */}
        <div 
          className="absolute h-full bg-green-500 opacity-80" 
          style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
        />
        {/* Cursor */}
        <div 
          className="absolute top-0 h-full w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
          style={{ left: `${cursorPos}%` }}
        />
      </div>
      <button 
        onClick={handleTap}
        className="mt-2 w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 px-4 rounded shadow-lg transition-colors"
      >
        CUT!
      </button>
      <p className="text-xs text-gray-400">Tap when in green</p>
    </div>
  );
};

export default HarvestMiniGame;
