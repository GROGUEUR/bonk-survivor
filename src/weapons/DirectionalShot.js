import { WeaponBase } from './WeaponBase.js';
import { Projectile } from '../entities/Projectile.js';

export class DirectionalShot extends WeaponBase {
  constructor() {
    super('shot');
    this.timer = 0;
  }

  update(dt, player) {
    const cooldown = this.getCooldown(player);
    this.timer += dt;
    if (this.timer >= cooldown) {
      this.timer -= cooldown;
      this._fire(player);
    }
  }

  _fire(player) {
    const fx = player.facing.dx || 1;
    const fy = player.facing.dy || 0;
    const len = Math.sqrt(fx * fx + fy * fy) || 1;
    const nx = fx / len;
    const ny = fy / len;
    const stats = this.stats;
    const count = stats.count;
    const spread = stats.spread || 0;

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const angle = Math.atan2(ny, nx) + offset;
      const dmg = Math.floor(stats.damage * (player.damageMult || 1));
      if (player._projectileBuffer) {
        player._projectileBuffer.push(new Projectile({
          x: player.x, y: player.y,
          vx: Math.cos(angle) * stats.speed,
          vy: Math.sin(angle) * stats.speed,
          damage: dmg,
          size: stats.size,
          color: '#ff4444',
          owner: 'player',
          piercing: true,
        }));
      }
    }
  }

  draw(ctx, player) {
    // Projectiles drawn separately
  }
}
