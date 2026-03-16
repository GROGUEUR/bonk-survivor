export class Projectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx || 0;
    this.vy = config.vy || 0;
    this.damage = config.damage;
    this.size = config.size || 6;
    this.color = config.color || '#ff4444';
    this.owner = config.owner || 'player'; // 'player' | 'enemy'
    this.alive = true;
    this.maxRange = config.maxRange || Infinity;
    this.traveled = 0;
    this.piercing = config.piercing || false;
    this.hitEnemies = new Set();

    // Boomerang specific
    this.isBoomerang = config.isBoomerang || false;
    this.returning = false;
    this.maxRangeBoomerang = config.maxRange || 200;
    this.shooter = config.shooter || null; // player ref for boomerang return

    this.flashTimer = 0;
  }

  update(dt, player) {
    if (this.isBoomerang && this.shooter) {
      if (!this.returning && this.traveled >= this.maxRangeBoomerang) {
        this.returning = true;
      }
      if (this.returning) {
        const dx = this.shooter.x - this.x;
        const dy = this.shooter.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
          this.alive = false;
          return;
        }
        const speed = 8;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.traveled += Math.sqrt(this.vx * this.vx + this.vy * this.vy);

    if (!this.isBoomerang && this.traveled > this.maxRange) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    if (this.isBoomerang) {
      // Draw as triangle
      ctx.translate(this.x, this.y);
      const angle = Math.atan2(this.vy, this.vx);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(this.size, 0);
      ctx.lineTo(-this.size, -this.size * 0.6);
      ctx.lineTo(-this.size, this.size * 0.6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
