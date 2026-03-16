import { SPAWN, WORLD } from '../data/constants.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';
import { Enemy } from './Enemy.js';
import { MiniBoss, MajorBoss } from './Boss.js';
import { randomRange } from '../utils/math.js';

export class EnemySpawner {
  constructor() {
    this.spawnTimer = 0;
    this.miniBossTimer = 0;
    this.majorBossTimer = 0;
    this.majorBossCount = 0;
  }

  getSpawnRate(elapsed) {
    const minutes = elapsed / 60;
    return Math.min(SPAWN.BASE_RATE + SPAWN.RATE_PER_MIN * minutes, SPAWN.MAX_RATE);
  }

  getScaledStats(type, elapsed, playerCount = 1, elite = false) {
    const minutes    = elapsed / 60;
    const hpMult     = Math.pow(SPAWN.HP_EXP_BASE, minutes) * (1 + (playerCount - 1) * 0.5);
    const dmgMult    = 1 + SPAWN.DMG_SCALE_PER_MIN * minutes;
    const speedMult  = 1 + SPAWN.SPEED_SCALE_PER_MIN * minutes;
    const eliteMult  = elite ? 3.5 : 1;
    return {
      hp:     Math.ceil(type.hp * hpMult * eliteMult),
      damage: Math.ceil(type.damage * dmgMult * (elite ? 1.5 : 1)),
      speed:  type.speed * speedMult * (elite ? 1.25 : 1),
      elite,
    };
  }

  getAvailableTypes(elapsed) {
    const minutes = elapsed / 60;
    return Object.values(ENEMY_TYPES).filter(t => t.minMinute <= minutes);
  }

  pickEnemyType(elapsed) {
    const minutes = elapsed / 60;
    const available = this.getAvailableTypes(elapsed);

    // Weighting: prefer goblin early, diversify later
    const weights = available.map(t => {
      if (t.name === 'Goblin') return Math.max(5, 20 - minutes * 2);
      if (t.name === 'Loup') return minutes >= 2 ? 8 : 0;
      if (t.name === 'Golem') return minutes >= 4 ? 5 : 0;
      if (t.name === 'Mage') return minutes >= 6 ? 6 : 0;
      if (t.name === 'Bombe') return minutes >= 8 ? 5 + minutes : 0;
      return 3;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < available.length; i++) {
      r -= weights[i];
      if (r <= 0) return available[i];
    }
    return available[0];
  }

  spawnEnemy(playerX, playerY) {
    // Spawn at edge of screen (off screen + margin)
    const margin = 80;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = randomRange(0, WORLD.WIDTH); y = -margin + playerY - 400; }
    else if (side === 1) { x = randomRange(0, WORLD.WIDTH); y = margin + playerY + 400; }
    else if (side === 2) { x = -margin + playerX - 600; y = randomRange(0, WORLD.HEIGHT); }
    else { x = margin + playerX + 600; y = randomRange(0, WORLD.HEIGHT); }

    x = Math.max(50, Math.min(WORLD.WIDTH - 50, x));
    y = Math.max(50, Math.min(WORLD.HEIGHT - 50, y));
    return { x, y };
  }

  update(dt, elapsed, playerX, playerY, enemies, playerCount = 1) {
    const spawnRate = this.getSpawnRate(elapsed);
    const interval = 1000 / spawnRate;
    const minutes   = elapsed / 60;

    // Elite chance: starts at min 4, grows to 25% by min 15
    const eliteChance = minutes >= 4 ? Math.min(0.25, (minutes - 4) * 0.02) : 0;

    this.spawnTimer += dt;
    while (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      const type  = this.pickEnemyType(elapsed);
      const elite = Math.random() < eliteChance;
      const scaled = this.getScaledStats(type, elapsed, playerCount, elite);
      const pos   = this.spawnEnemy(playerX, playerY);
      const enemy = new Enemy(pos.x, pos.y, type, scaled);
      if (elite) {
        enemy.speed    = scaled.speed;
        enemy.isElite  = true;
        // Visual: brighter, larger
        enemy.size     = Math.ceil(type.size * 1.4);
        enemy.color    = '#ff8800';
      }
      enemies.push(enemy);
    }

    // Mini boss
    this.miniBossTimer += dt;
    let spawnedMiniBoss = null;
    if (this.miniBossTimer >= 60000) {
      this.miniBossTimer -= 60000;
      const pos = this.spawnEnemy(playerX, playerY);
      const minute = Math.floor(elapsed / 60) + 1;
      spawnedMiniBoss = new MiniBoss(pos.x, pos.y, minute, playerCount);
    }

    // Major boss
    let spawnedMajorBoss = null;
    this.majorBossTimer += dt;
    if (this.majorBossTimer >= 300000) {
      this.majorBossTimer -= 300000;
      this.majorBossCount++;
      const pos = this.spawnEnemy(playerX, playerY);
      spawnedMajorBoss = new MajorBoss(pos.x, pos.y, this.majorBossCount, playerCount);
    }

    // Warning: 3s before boss spawns
    const miniBossWarning  = this.miniBossTimer  >= 57000 && spawnedMiniBoss  === null;
    const majorBossWarning = this.majorBossTimer >= 297000 && spawnedMajorBoss === null;

    return { miniBoss: spawnedMiniBoss, majorBoss: spawnedMajorBoss, miniBossWarning, majorBossWarning };
  }
}
