import { normalize } from '../utils/math.js';
import { Projectile } from './Projectile.js';
import { Enemy } from './Enemy.js';
import { ENEMY_TYPES } from '../data/enemyTypes.js';

export class MiniBoss {
  constructor(x, y, minute, playerCount = 1) {
    this.x = x;
    this.y = y;
    this.size = 48;
    const playerMult = 1 + (playerCount - 1) * 0.5;
    this.maxHp = Math.ceil(500 * Math.max(1, minute) * playerMult);
    this.hp = this.maxHp;
    this.damage = 30;
    this.speed = 1.2;
    this.alive = true;
    this.isBoss = true;
    this.name = 'Mini-Boss';
    this.xpDrops = [{ value: 50, count: 5 }];
    this.flashTimer = 0;
    this.animAngle = 0;
    this.spawnTimer = 10000;
    this.spawnCooldown = 10000;
    this.shape = 'rect';
    this.color = '#cc2222';
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 80;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt, player, enemiesOut) {
    this.animAngle += dt * 0.002;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const { x: nx, y: ny } = normalize(dx, dy);
    this.x += nx * this.speed;
    this.y += ny * this.speed;

    // Spawn minions
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnCooldown;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const spawnX = this.x + Math.cos(angle) * 80;
        const spawnY = this.y + Math.sin(angle) * 80;
        enemiesOut.push(new Enemy(spawnX, spawnY, ENEMY_TYPES.goblin, {
          hp: ENEMY_TYPES.goblin.hp, damage: ENEMY_TYPES.goblin.damage
        }));
      }
    }
  }

  draw(ctx) {
    const isFlashing = this.flashTimer > 0;

    // Pulsing aura
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.25 + Math.sin(this.animAngle * 4) * 0.15;
    ctx.fillStyle = '#ff2200';
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.8 + Math.sin(this.animAngle * 5) * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = isFlashing ? '#ffffff' : '#cc2222';
    const half = this.size / 2;
    ctx.fillRect(-half, -half, this.size, this.size);

    // Border
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 3;
    ctx.strokeRect(-half, -half, this.size, this.size);
    ctx.restore();

    // HP bar
    const barW = 60;
    ctx.fillStyle = '#440000';
    ctx.fillRect(this.x - barW / 2, this.y - half - 12, barW, 5);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(this.x - barW / 2, this.y - half - 12, barW * (this.hp / this.maxHp), 5);
  }
}

export class MajorBoss {
  constructor(x, y, bossNumber, playerCount = 1) {
    this.x = x;
    this.y = y;
    this.size = 64;
    const playerMult = 1 + (playerCount - 1) * 0.5;
    this.maxHp = Math.ceil(5000 * bossNumber * playerMult);
    this.hp = this.maxHp;
    this.damage = 50;
    this.speed = 1.5;
    this.alive = true;
    this.isBoss = true;
    this.isMajorBoss = true;
    this.name = `Boss Légendaire ${bossNumber}`;
    this.xpDrops = [{ value: 200, count: 10 }];
    this.flashTimer = 0;
    this.animAngle = 0;
    this.shape = 'rect';
    this.color = '#880000';

    // Charge attack
    this.chargeTimer = 5000;
    this.chargeCooldown = 5000;
    this.isCharging = false;
    this.chargeVx = 0;
    this.chargeVy = 0;
    this.chargeDuration = 0;

    // Minion spawn
    this.spawnTimer = 10000;
    this.spawnCooldown = 10000;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 80;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt, player, enemiesOut) {
    this.animAngle += dt * 0.001;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (this.isCharging) {
      this.x += this.chargeVx;
      this.y += this.chargeVy;
      this.chargeDuration -= dt;
      if (this.chargeDuration <= 0) this.isCharging = false;
    } else {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const { x: nx, y: ny } = normalize(dx, dy);
      this.x += nx * this.speed;
      this.y += ny * this.speed;

      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.chargeTimer = this.chargeCooldown;
        this.isCharging = true;
        this.chargeVx = nx * 8;
        this.chargeVy = ny * 8;
        this.chargeDuration = 800;
      }
    }

    // Spawn ring of enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnCooldown;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        const spawnX = this.x + Math.cos(angle) * 100;
        const spawnY = this.y + Math.sin(angle) * 100;
        enemiesOut.push(new Enemy(spawnX, spawnY, ENEMY_TYPES.goblin, {
          hp: ENEMY_TYPES.goblin.hp * 2, damage: ENEMY_TYPES.goblin.damage
        }));
      }
    }
  }

  draw(ctx) {
    const isFlashing = this.flashTimer > 0;
    const half = this.size / 2;

    // Animated golden border glow
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.15 + Math.sin(this.animAngle * 3) * 0.1;
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(-half - 10, -half - 10, this.size + 20, this.size + 20);
    ctx.restore();

    // Body
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = isFlashing ? '#ffffff' : '#880000';
    ctx.fillRect(-half, -half, this.size, this.size);

    // Golden border
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 4;
    ctx.strokeRect(-half, -half, this.size, this.size);

    // Eye indicator
    if (this.isCharging) {
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // HP bar
    const barW = 80;
    ctx.fillStyle = '#440000';
    ctx.fillRect(this.x - barW / 2, this.y - half - 14, barW, 6);
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(this.x - barW / 2, this.y - half - 14, barW * (this.hp / this.maxHp), 6);
  }
}
