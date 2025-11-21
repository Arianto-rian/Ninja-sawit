import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GameState, 
  PlayerState, 
  GuardState, 
  Tree, 
  Bush, 
  Particle 
} from '../types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  PLAYER_SPEED, 
  PLAYER_CLIMB_SPEED,
  GRAVITY,
  FRICTION,
  JUMP_FORCE,
  GUARD_SPEED,
  GUARD_CHASE_SPEED,
  FLASHLIGHT_LENGTH,
  FLASHLIGHT_ANGLE_WIDTH,
  SUSPICION_GAIN,
  SUSPICION_DECAY,
  MAX_SUSPICION,
  TREE_WIDTH,
  TREE_HEIGHT,
  INJURY_DURATION
} from '../constants';
import HarvestMiniGame from './HarvestMiniGame';

// Lucide icons for UI
import { Eye, Heart, Coins, Skull } from 'lucide-react';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onScoreUpdate: (score: number, coins: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI State sync
  const [suspicion, setSuspicion] = useState(0);
  const [showHarvestGame, setShowHarvestGame] = useState(false);
  const [harvestTargetTreeId, setHarvestTargetTreeId] = useState<number | null>(null);
  const [playerHealth, setPlayerHealth] = useState(3);
  const [isInjured, setIsInjured] = useState(false);

  // --- MUTABLE GAME STATE (Refs for performance) ---
  const stateRef = useRef({
    lastTime: 0,
    score: 0,
    coins: 0,
    level: 1,
    cameraX: 0,
    
    player: {
      x: 100,
      y: GAME_HEIGHT - 100,
      vx: 0,
      vy: 0,
      width: 30,
      height: 50,
      state: PlayerState.IDLE,
      facingRight: true,
      climbingTreeId: null as number | null,
      injuryTimer: 0,
    },
    
    guard: {
      x: 600,
      y: GAME_HEIGHT - 90, // Ground level
      width: 40,
      height: 60,
      state: GuardState.PATROLLING,
      facingRight: false,
      scanTimer: 0,
      patrolStart: 300,
      patrolEnd: 700,
      viewAngle: Math.PI, // 180 deg (facing left)
    },

    trees: [] as Tree[],
    bushes: [] as Bush[],
    particles: [] as Particle[],
    
    keys: {
      left: false,
      right: false,
      up: false,
      down: false,
      action: false, // Hide/Harvest
      jump: false,
    }
  });

  // --- INITIALIZATION ---
  const initLevel = useCallback(() => {
    const s = stateRef.current;
    s.score = 0;
    s.coins = 0;
    s.player.x = 50;
    s.player.y = GAME_HEIGHT - 60;
    s.player.vx = 0;
    s.player.vy = 0;
    s.player.state = PlayerState.IDLE;
    setPlayerHealth(3);
    setSuspicion(0);
    setIsInjured(false);

    // Generate Trees
    s.trees = [];
    for (let i = 0; i < 5; i++) {
      s.trees.push({
        id: i,
        x: 200 + i * 250,
        y: GAME_HEIGHT - 60, // Base y
        width: TREE_WIDTH,
        height: TREE_HEIGHT,
        hasFruit: true,
        fruitValue: Math.floor(Math.random() * 3) + 1,
      });
    }

    // Generate Bushes
    s.bushes = [];
    for (let i = 0; i < 4; i++) {
      s.bushes.push({
        id: i,
        x: 320 + i * 300,
        y: GAME_HEIGHT - 50,
        width: 80,
        height: 50,
      });
    }

    s.guard.x = 600;
    s.guard.facingRight = false;
    s.guard.state = GuardState.PATROLLING;
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initLevel();
    }
  }, [gameState, initLevel]);


  // --- INPUT HANDLING ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') k.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') k.down = true;
      if (e.code === 'Space') k.jump = true;
      if (e.code === 'ShiftLeft' || e.code === 'KeyE') k.action = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') k.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') k.down = false;
      if (e.code === 'Space') k.jump = false;
      if (e.code === 'ShiftLeft' || e.code === 'KeyE') k.action = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Helper for particles (hoisted for use in handlers)
  const createParticles = useCallback((x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      stateRef.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30 + Math.random() * 20,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }, []);

  // --- MAIN GAME LOOP ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let animationFrameId: number;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    const loop = (timestamp: number) => {
      const s = stateRef.current;
      const dt = timestamp - s.lastTime;
      s.lastTime = timestamp;

      // 1. UPDATE LOGIC
      updatePlayer();
      updateGuard();
      checkCollisions();
      updateParticles();

      // 2. RENDER
      draw(ctx);

      animationFrameId = requestAnimationFrame(loop);
    };

    const updatePlayer = () => {
      const s = stateRef.current;
      const p = s.player;
      
      // Status Effects
      if (p.state === PlayerState.INJURED) {
        if (Date.now() > p.injuryTimer) {
          p.state = PlayerState.IDLE;
          setIsInjured(false);
        }
      }
      
      const speedMult = p.state === PlayerState.INJURED ? 0.5 : 1.0;

      // Horizontal Movement (Ground)
      if (p.state !== PlayerState.CLIMBING && p.state !== PlayerState.HARVESTING) {
        if (s.keys.left) {
          p.vx = -PLAYER_SPEED * speedMult;
          p.facingRight = false;
        } else if (s.keys.right) {
          p.vx = PLAYER_SPEED * speedMult;
          p.facingRight = true;
        } else {
          p.vx *= FRICTION;
        }
        
        // Apply Gravity
        p.vy += GRAVITY;

        // Jump
        if (s.keys.jump && Math.abs(p.vy) < 0.1 && p.y + p.height >= GAME_HEIGHT - 10) {
          p.vy = JUMP_FORCE * speedMult;
          p.state = PlayerState.JUMPING;
          createParticles(p.x + p.width/2, p.y + p.height, 5, '#8b4513'); // Dust
        }

        // Update Position
        p.x += p.vx;
        p.y += p.vy;

        // Ground Collision
        if (p.y + p.height > GAME_HEIGHT - 10) {
          p.y = GAME_HEIGHT - 10 - p.height;
          p.vy = 0;
          if (p.state === PlayerState.JUMPING) p.state = PlayerState.IDLE;
        }

        // Boundary
        if (p.x < 0) p.x = 0;
        if (p.x > GAME_WIDTH - p.width) p.x = GAME_WIDTH - p.width;
      }

      // Climbing Logic
      if (s.keys.up && p.climbingTreeId === null) {
        // Check if near a tree to climb
        const tree = s.trees.find(t => Math.abs((t.x + t.width/2) - (p.x + p.width/2)) < 30);
        if (tree) {
          p.climbingTreeId = tree.id;
          p.state = PlayerState.CLIMBING;
          p.x = tree.x + (tree.width - p.width)/2; // Snap to center
          p.vx = 0;
        }
      }

      if (p.state === PlayerState.CLIMBING && p.climbingTreeId !== null) {
        p.vy = 0;
        if (s.keys.up) p.y -= PLAYER_CLIMB_SPEED;
        if (s.keys.down) p.y += PLAYER_CLIMB_SPEED;

        const tree = s.trees.find(t => t.id === p.climbingTreeId);
        if (tree) {
           // Top of tree limit
           if (p.y < tree.y - tree.height + 40) {
             p.y = tree.y - tree.height + 40;
           }
           // Bottom of tree (dismount)
           if (p.y > GAME_HEIGHT - 10 - p.height) {
             p.state = PlayerState.IDLE;
             p.climbingTreeId = null;
           }
        }

        // Emergency Jump (Down + Jump)
        if (s.keys.down && s.keys.jump) {
           p.state = PlayerState.INJURED;
           setIsInjured(true);
           p.climbingTreeId = null;
           p.vy = 5; // Drop fast
           p.injuryTimer = Date.now() + INJURY_DURATION;
           createParticles(p.x, p.y, 10, '#ff0000'); // Pain particles
        }

        // Hiding/Harvesting at top
        if (tree && p.y <= tree.y - tree.height + 60) {
           if (s.keys.action && !showHarvestGame && tree.hasFruit) {
              // Start Harvest
              p.state = PlayerState.HARVESTING;
              setHarvestTargetTreeId(tree.id);
              setShowHarvestGame(true);
           } else if (s.keys.action && !tree.hasFruit) {
             // Just Hide
             p.state = PlayerState.HIDING_TREE;
           } else if (!showHarvestGame) {
             p.state = PlayerState.CLIMBING;
           }
        }
      }

      // Bush Hiding
      if (p.state !== PlayerState.CLIMBING && !s.keys.left && !s.keys.right && s.keys.down) {
        const bush = s.bushes.find(b => 
           p.x + p.width > b.x && 
           p.x < b.x + b.width && 
           Math.abs((p.y + p.height) - (b.y + b.height)) < 20
        );
        if (bush) {
          p.state = PlayerState.HIDING_BUSH;
        }
      } else if (p.state === PlayerState.HIDING_BUSH && (s.keys.left || s.keys.right || s.keys.up || !s.keys.down)) {
         p.state = PlayerState.IDLE;
      }
    };

    const updateGuard = () => {
      const s = stateRef.current;
      const g = s.guard;

      // View Angle Logic
      const targetAngle = g.facingRight ? 0 : Math.PI;
      // Smooth angle transition could go here, but instant snap is fine for now
      g.viewAngle = targetAngle;

      switch (g.state) {
        case GuardState.PATROLLING:
          if (g.facingRight) {
            g.x += GUARD_SPEED;
            if (g.x >= g.patrolEnd) {
              g.state = GuardState.SCANNING;
              g.scanTimer = 120; // 2 seconds approx
            }
          } else {
            g.x -= GUARD_SPEED;
            if (g.x <= g.patrolStart) {
              g.state = GuardState.SCANNING;
              g.scanTimer = 120;
            }
          }
          break;
        
        case GuardState.SCANNING:
          g.scanTimer--;
          // Look left/right randomly logic
          if (g.scanTimer % 60 === 0) {
             g.facingRight = !g.facingRight;
          }
          if (g.scanTimer <= 0) {
            g.state = GuardState.PATROLLING;
            // Flip direction to resume patrol
            g.facingRight = g.x <= g.patrolStart;
          }
          break;

        case GuardState.CHASING:
          const dx = s.player.x - g.x;
          g.facingRight = dx > 0;
          
          // Move towards player
          if (Math.abs(dx) > 10) {
             g.x += Math.sign(dx) * GUARD_CHASE_SPEED;
          }

          // Catch Player
          if (
             Math.abs(dx) < 30 && 
             Math.abs(s.player.y - g.y) < 50 &&
             s.player.state !== PlayerState.CLIMBING // Can't catch if high up
          ) {
             // Caught logic
             handlePlayerCaught();
          }

          // Give up chase if player hides effectively
          if (suspicion < 10) {
             g.state = GuardState.SCANNING;
             g.scanTimer = 60;
          }
          break;
      }
    };

    const checkCollisions = () => {
       const s = stateRef.current;
       const p = s.player;
       const g = s.guard;

       // Flashlight Detection Logic
       // A simplified triangle check
       
       // 1. Calculate Guard Flashlight Polygon
       const fAngle = g.facingRight ? 0 : Math.PI;
       const fX = g.x + g.width / 2;
       const fY = g.y + 15; // Eye level
       
       // Check if player center is in range and angle
       const pCx = p.x + p.width/2;
       const pCy = p.y + p.height/2;
       
       const dist = Math.hypot(pCx - fX, pCy - fY);
       const angleToPlayer = Math.atan2(pCy - fY, pCx - fX);
       
       let angleDiff = angleToPlayer - fAngle;
       // Normalize angle
       while (angleDiff <= -Math.PI) angleDiff += Math.PI*2;
       while (angleDiff > Math.PI) angleDiff -= Math.PI*2;

       let isVisible = false;

       if (dist < FLASHLIGHT_LENGTH && Math.abs(angleDiff) < FLASHLIGHT_ANGLE_WIDTH / 2) {
          // In Flashlight Cone
          isVisible = true;

          // Stealth Modifiers
          if (p.state === PlayerState.HIDING_TREE) isVisible = false;
          if (p.state === PlayerState.HIDING_BUSH) isVisible = false; // Fully hidden in bush
          
          // Tree trunk blocking?
          // Check if a tree is between guard and player
          if (p.state === PlayerState.CLIMBING) {
             // If guard is left and player climbing, and player on right side of tree? 
             // Simplified: If climbing and high enough, reduced visibility
             if (p.y < g.y - 100) isVisible = false; 
             else if (dist > 150) isVisible = false; // Harder to see up tree
          }
       }

       // Update Suspicion
       if (isVisible) {
         setSuspicion(prev => {
           const next = Math.min(prev + SUSPICION_GAIN, MAX_SUSPICION);
           if (next >= MAX_SUSPICION && s.guard.state !== GuardState.CHASING) {
             s.guard.state = GuardState.CHASING;
           }
           return next;
         });
       } else {
         setSuspicion(prev => Math.max(prev - SUSPICION_DECAY, 0));
       }
    };
    
    const handlePlayerCaught = () => {
       setPlayerHealth(prev => {
         const next = prev - 1;
         if (next <= 0) {
           setGameState(GameState.GAME_OVER);
         } else {
           // Respawn / Reset positions slightly
           stateRef.current.player.x = 50;
           stateRef.current.guard.x = 600;
           stateRef.current.guard.state = GuardState.PATROLLING;
           setSuspicion(0);
           createParticles(stateRef.current.player.x, stateRef.current.player.y, 20, '#ffffff');
         }
         return next;
       });
    };

    const updateParticles = () => {
      const s = stateRef.current;
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) s.particles.splice(i, 1);
      }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      const s = stateRef.current;
      
      // CLEAR
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // SKY / BACKGROUND
      const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      grad.addColorStop(0, '#020617'); // Darker Slate
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // MOON
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(700, 80, 40, 0, Math.PI * 2);
      ctx.fill();
      // Moon Glow
      ctx.fillStyle = 'rgba(254, 243, 199, 0.1)';
      ctx.beginPath();
      ctx.arc(700, 80, 80, 0, Math.PI * 2);
      ctx.fill();

      // GROUND
      ctx.fillStyle = '#064e3b'; // Emerald 900
      ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

      // TREES
      s.trees.forEach(t => {
        // Trunk
        ctx.fillStyle = '#3f2e18'; // Dark brown
        ctx.fillRect(t.x, t.y - t.height, t.width, t.height);
        
        // Texture
        ctx.fillStyle = '#281c0d';
        for(let i=0; i<t.height; i+=40) {
           ctx.fillRect(t.x, t.y - i, t.width, 4);
        }

        // Leaves (Fronds) at top
        ctx.fillStyle = '#166534'; // Green 800
        ctx.beginPath();
        ctx.moveTo(t.x + t.width/2, t.y - t.height + 20);
        ctx.lineTo(t.x - 60, t.y - t.height - 20);
        ctx.lineTo(t.x + t.width + 60, t.y - t.height - 20);
        ctx.fill();
        
        // Fruits
        if (t.hasFruit) {
          ctx.fillStyle = '#dc2626'; // Red
          ctx.beginPath();
          ctx.arc(t.x + 10, t.y - t.height + 30, 8, 0, Math.PI*2);
          ctx.arc(t.x + 30, t.y - t.height + 30, 8, 0, Math.PI*2);
          ctx.arc(t.x + 20, t.y - t.height + 45, 8, 0, Math.PI*2);
          ctx.fill();
        }
      });

      // BUSHES (Back layer)
      s.bushes.forEach(b => {
         ctx.fillStyle = '#14532d'; // Green 900
         ctx.beginPath();
         ctx.ellipse(b.x + b.width/2, b.y + b.height/2, b.width/2, b.height/2, 0, 0, Math.PI*2);
         ctx.fill();
      });

      // GUARD
      const g = s.guard;
      
      // Guard Flashlight
      ctx.save();
      ctx.translate(g.x + g.width/2, g.y + 15);
      ctx.rotate(g.facingRight ? 0 : Math.PI);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, FLASHLIGHT_LENGTH, -FLASHLIGHT_ANGLE_WIDTH/2, FLASHLIGHT_ANGLE_WIDTH/2);
      ctx.lineTo(0, 0);
      
      // Flashlight gradient
      const fGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, FLASHLIGHT_LENGTH);
      fGrad.addColorStop(0, 'rgba(255, 255, 200, 0.7)');
      fGrad.addColorStop(1, 'rgba(255, 255, 200, 0.0)');
      ctx.fillStyle = fGrad;
      ctx.fill();
      ctx.restore();

      // Guard Body
      ctx.fillStyle = '#1e293b'; // Slate 800 (Uniform)
      ctx.fillRect(g.x, g.y, g.width, g.height);
      // Guard Eye/Hat
      ctx.fillStyle = '#000';
      ctx.fillRect(g.x, g.y, g.width, 10);
      // Alert Icon
      if (g.state === GuardState.CHASING || g.state === GuardState.ALERT) {
         ctx.fillStyle = 'red';
         ctx.font = '20px Arial';
         ctx.fillText('!', g.x + 15, g.y - 10);
      } else if (g.state === GuardState.SCANNING) {
         ctx.fillStyle = 'yellow';
         ctx.font = '20px Arial';
         ctx.fillText('?', g.x + 15, g.y - 10);
      }

      // PLAYER (NINJA)
      const p = s.player;
      if (p.state !== PlayerState.HIDING_BUSH && p.state !== PlayerState.HIDING_TREE) {
        ctx.fillStyle = '#000000'; // Ninja Black
        
        // Simple Ninja Shape
        ctx.fillRect(p.x, p.y, p.width, p.height);
        
        // Headband/Eyes
        ctx.fillStyle = '#ef4444'; // Red Band
        if (p.facingRight) {
           ctx.fillRect(p.x + 20, p.y + 10, 10, 4);
        } else {
           ctx.fillRect(p.x, p.y + 10, 10, 4);
        }
        
        // Scarf trail logic could go here for effect
      } else {
        // Shadow if hiding
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(p.x + p.width/2, p.y + p.height, 15, 5, 0, 0, Math.PI*2);
        ctx.fill();
      }

      // PARTICLES
      s.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life / 50;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // FIREFLIES (Ambient)
      if (Math.random() < 0.05) {
        createParticles(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 1, '#fbbf24');
      }

      // NIGHT OVERLAY (Vignette)
      const vGrad = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, 200, GAME_WIDTH/2, GAME_HEIGHT/2, 600);
      vGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
      vGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = vGrad;
      ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, suspicion, isInjured, createParticles]); // Re-bind if critical UI states change

  
  // --- HANDLERS ---

  const handleHarvestSuccess = (multiplier: number) => {
    setShowHarvestGame(false);
    const s = stateRef.current;
    const tree = s.trees.find(t => t.id === harvestTargetTreeId);
    if (tree && tree.hasFruit) {
      tree.hasFruit = false;
      const points = 100 * multiplier;
      const coins = 10 * multiplier;
      s.score += points;
      s.coins += coins;
      onScoreUpdate(s.score, s.coins);
      
      // FX
      createParticles(tree.x + TREE_WIDTH/2, tree.y - TREE_HEIGHT + 40, 15, '#dc2626');
    }
    s.player.state = PlayerState.CLIMBING;
    setHarvestTargetTreeId(null);
  };

  const handleHarvestFail = () => {
    setShowHarvestGame(false);
    const s = stateRef.current;
    
    // Noise made!
    s.guard.state = GuardState.ALERT;
    setSuspicion(prev => Math.min(prev + 50, 100));
    
    s.player.state = PlayerState.CLIMBING;
    setHarvestTargetTreeId(null);
  };

  const handleTouchAction = (action: 'left'|'right'|'up'|'down'|'jump'|'action', active: boolean) => {
    const k = stateRef.current.keys;
    if (action === 'left') k.left = active;
    if (action === 'right') k.right = active;
    if (action === 'up') k.up = active;
    if (action === 'down') k.down = active;
    if (action === 'jump') k.jump = active;
    if (action === 'action') k.action = active;
  };

  return (
    <div className="relative w-full max-w-[800px] aspect-[4/3] mx-auto overflow-hidden shadow-2xl border-4 border-slate-800 rounded-lg bg-black">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="w-full h-full block"
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 flex gap-4 text-white font-mono text-lg z-10">
         <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700">
           <Heart className={`w-5 h-5 ${isInjured ? 'text-red-500 animate-pulse' : 'text-red-600'}`} fill="currentColor" />
           <span>{playerHealth}</span>
         </div>
         <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-700">
           <Coins className="w-5 h-5 text-yellow-500" />
           <span>{stateRef.current.coins}</span>
         </div>
      </div>

      {/* Suspicion Meter */}
      <div className="absolute top-4 right-4 w-48">
         <div className="flex justify-between text-xs text-white mb-1 font-bold uppercase">
           <span>Suspicion</span>
           <Eye className={`w-4 h-4 ${suspicion > 80 ? 'text-red-500 animate-flash' : 'text-slate-400'}`} />
         </div>
         <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-600">
           <div 
             className={`h-full transition-all duration-300 ${suspicion > 80 ? 'bg-red-600' : suspicion > 40 ? 'bg-yellow-500' : 'bg-blue-500'}`} 
             style={{ width: `${suspicion}%` }}
           />
         </div>
      </div>

      {/* Mini Game Overlay */}
      {showHarvestGame && (
        <HarvestMiniGame 
          onSuccess={handleHarvestSuccess}
          onFail={handleHarvestFail}
          difficulty={1 + (suspicion/100)} // Harder if suspected
        />
      )}

      {/* Mobile Controls Overlay */}
      <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <div />
        <button 
           className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white active:bg-slate-500"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('up', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('up', false); }}
        >▲</button>
        <div />
        <button 
           className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white active:bg-slate-500"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('left', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('left', false); }}
        >◀</button>
        <button 
           className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white active:bg-slate-500"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('down', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('down', false); }}
        >▼</button>
        <button 
           className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-white active:bg-slate-500"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('right', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('right', false); }}
        >▶</button>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-4 opacity-60 hover:opacity-100 transition-opacity">
        <button 
           className="w-16 h-16 bg-red-900/80 rounded-full flex items-center justify-center text-white border-2 border-red-500 active:bg-red-700"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('action', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('action', false); }}
        >
          <Skull size={24} />
        </button>
        <button 
           className="w-16 h-16 bg-blue-900/80 rounded-full flex items-center justify-center text-white border-2 border-blue-500 active:bg-blue-700"
           onTouchStart={(e) => { e.preventDefault(); handleTouchAction('jump', true); }}
           onTouchEnd={(e) => { e.preventDefault(); handleTouchAction('jump', false); }}
        >
          JUMP
        </button>
      </div>
      
      {/* Instructions Overlay (Briefly visible or helpful text) */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-slate-400 text-xs pointer-events-none select-none text-center">
        <p>Arrows to Move/Climb • Space to Jump • Shift/E to Hide/Harvest</p>
      </div>
    </div>
  );
};

export default GameCanvas;