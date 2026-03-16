export const WORLD = {
  WIDTH: 3000,
  HEIGHT: 3000,
};

export const PLAYER = {
  SIZE: 24,
  HP: 100,
  SPEED: 3,
  XP_RADIUS: 50,
  ARMOR: 0,
  REGEN: 0,
  CRIT_CHANCE: 0.05,
  CRIT_MULT: 2,
  MAX_WEAPONS: 6,
  IFRAMES: 300,
};

export const DASH = {
  COOLDOWN: 3000,
  DURATION: 150,
  SPEED_MULT: 4,
};

export const COMBO = {
  RESET_DELAY: 2000,
};

export const PICKUP = {
  HEART_CHANCE: 0.018,       // was 0.05 — reduced to avoid lag spikes
  MAGNET_CHANCE: 0.006,      // was 0.02
  CHEST_SPAWN_INTERVAL: 80,  // seconds, was 60
  HEART_HEAL: 25,
};

export const CAMERA = {
  LERP: 0.1,
};

export const COLORS = {
  BG: '#1a1a2e',
  GRID: '#22223a',
  PLAYER: '#4488ff',
  PLAYER_TRAIL: '#2244aa',
  HP_BAR_BG: '#440000',
  HP_BAR: '#44ff44',
  XP_BAR_BG: '#222244',
  XP_BAR: '#4444ff',
  DAMAGE_NORMAL: '#ffffff',
  DAMAGE_CRIT: '#ffff00',
  XP_TEXT: '#44ff88',
};

export const RARITY_COLORS = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00',
};

export const BOSS = {
  MINI_INTERVAL: 60,
  MAJOR_INTERVAL: 300,
};

export const SPAWN = {
  BASE_RATE: 1,
  RATE_PER_MIN: 0.5,
  MAX_RATE: 15,
  HP_SCALE_PER_MIN: 0.10,
  DMG_SCALE_PER_MIN: 0.05,
};
