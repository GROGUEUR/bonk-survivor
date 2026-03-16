import { normalize, distance } from '../utils/math.js';
import { Projectile } from './Projectile.js';

export class Enemy {
  constructor(x, y, typeDef, scaledStats) {
    this.x = x;
    this.y = y;
    this.typeDef = typeDef;
    this.maxHp = scaledStats.hp;
    this.hp = scaledStats.hp;
    this.damage = scaledStats.damage;
    this.speed = scaledStats.speed ?? typeDef.speed;
    this.size = typeDef.size;
    this.color = typeDef.color;
    this.shape = typeDef.shape;
    this.behavior = typeDef.behavior;
    this.shootRange = typeDef.shootRange || 0;
    this.shootCooldown = typeDef.shootCooldown || 0;
    this.shootTimer = Math.random() * this.shootCooldown;
    this.alive = true;
    this.flashTimer = 0;
    this.xpDrops = typeDef.xpDrops;

    // Explode behavior
    this.explodeRange = typeDef.explodeRange || 0;
    this.explodeRadius = typeDef.explodeRadius || 0;
    this.exploded = false;

    this.animAngle = Math.random() * Math.PI * 2;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 100;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt, player, projectilesOut) {
    this.animAngle += dt * 0.003;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const { x: nx, y: ny } = normalize(dx, dy);

    if (this.behavior === 'chase') {
      this.x += nx * this.speed;
      this.y += ny * this.speed;
    } else if (this.behavior === 'ranged') {
      if (dist > this.shootRange) {
        this.x += nx * this.speed;
        this.y += ny * this.speed;
      } else if (dist < this.shootRange * 0.7) {
        this.x -= nx * this.speed * 0.5;
        this.y -= ny * this.speed * 0.5;
      }
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && dist < this.shootRange + 50) {
        this.shootTimer = this.shootCooldown;
        const speed = 4;
        projectilesOut.push(new Projectile({
          x: this.x, y: this.y,
          vx: nx * speed, vy: ny * speed,
          damage: this.damage,
          size: 6, color: '#cc44ff',
          owner: 'enemy',
        }));
      }
    } else if (this.behavior === 'explode') {
      this.x += nx * this.speed;
      this.y += ny * this.speed;
    }
  }

  checkExplode(player) {
    if (this.behavior !== 'explode' || this.exploded) return null;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.explodeRange) {
      this.exploded = true;
      this.alive = false;
      return { x: this.x, y: this.y, radius: this.explodeRadius, damage: this.damage };
    }
    return null;
  }

  draw(ctx) {
    const isFlashing = this.flashTimer > 0;
    const color = isFlashing ? '#ffffff' : this.color;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.shape === 'rect') {
      ctx.fillStyle = color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else if (this.shape === 'circle') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      // Pulsing ring for bomb
      if (this.behavior === 'explode') {
        ctx.globalAlpha = 0.5 + Math.sin(this.animAngle * 5) * 0.3;
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (this.shape === 'triangle') {
      ctx.fillStyle = color;
      const s = this.size / 2;
      const angle = Math.atan2(0, 0); // always toward player handled in draw offset
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s, -s * 0.7);
      ctx.lineTo(-s, s * 0.7);
      ctx.closePath();
      ctx.fill();
    } else if (this.shape === 'diamond') {
      ctx.fillStyle = color;
      const s = this.size / 2;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      // Magic aura
      ctx.globalAlpha = 0.3 + Math.sin(this.animAngle * 3) * 0.2;
      ctx.strokeStyle = '#cc88ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Elite glow aura
    if (this.isElite && !this.flashTimer) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.animAngle * 4) * 0.15;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = this.size;
      ctx.fillStyle = '#440000';
      ctx.fillRect(this.x - barW / 2, this.y - this.size / 2 - 8, barW, 3);
      ctx.fillStyle = this.isElite ? '#ff8800' : '#ff4444';
      ctx.fillRect(this.x - barW / 2, this.y - this.size / 2 - 8, barW * (this.hp / this.maxHp), 3);
    }
  }
}
