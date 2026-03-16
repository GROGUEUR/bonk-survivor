import { WeaponBase } from './WeaponBase.js';
import { Projectile } from '../entities/Projectile.js';

export class BoomerangWeapon extends WeaponBase {
  constructor() {
    super('boomerang');
    this.timer = 0;
    this.activeBoomerangs = 0;
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
    const stats = this.stats;
    const fx = player.facing.dx || 1;
    const fy = player.facing.dy || 0;
    const len = Math.sqrt(fx * fx + fy * fy) || 1;
    const nx = fx / len;
    const ny = fy / len;

    for (let i = 0; i < stats.count; i++) {
      const spreadAngle = (i - (stats.count - 1) / 2) * 0.25;
      const angle = Math.atan2(ny, nx) + spreadAngle;
      const dmg = Math.floor(stats.damage * (player.damageMult || 1));
      if (player._projectileBuffer) {
        player._projectileBuffer.push(new Projectile({
          x: player.x, y: player.y,
          vx: Math.cos(angle) * 7,
          vy: Math.sin(angle) * 7,
          damage: dmg,
          size: stats.size,
          color: '#44ff88',
          owner: 'player',
          isBoomerang: true,
          maxRange: stats.range,
          shooter: player,
          piercing: true,
        }));
      }
    }
  }

  draw(ctx, player) {
    // Boomerangs are drawn as projectiles
  }
}
