export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  SHOP = 'SHOP'
}

export enum PlayerState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  CLIMBING = 'CLIMBING',
  HIDING_TREE = 'HIDING_TREE', // Hiding behind fronds at top
  HIDING_BUSH = 'HIDING_BUSH', // Hiding in bush on ground
  HARVESTING = 'HARVESTING',
  JUMPING = 'JUMPING',
  INJURED = 'INJURED'
}

export enum GuardState {
  PATROLLING = 'PATROLLING',
  SCANNING = 'SCANNING', // Stops and looks around
  ALERT = 'ALERT', // Saw something, investigating
  CHASING = 'CHASING'
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Tree extends Entity {
  id: number;
  hasFruit: boolean;
  fruitValue: number; // 1-3 bunches
}

export interface Bush extends Entity {
  id: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
