import { WeaponBase } from './WeaponBase.js';

export class FlameZone extends WeaponBase {
  constructor() {
    super('flame');
    this.tickTimer = 0;
  }

  update(dt, player) {
    this.tickTimer += dt;
  }

  tick(player, enemies, damageNumbers, audioSystem) {
    const stats = this.stats;
    if (this.tickTimer >= stats.tickRate) {
      this.tickTimer -= stats.tickRate;
      enemies.forEach(enemy => {
        if (!enemy.alive) return;
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < stats.radius + enemy.size / 2) {
          const isCrit = Math.random() < player.critChance;
          let dmg = stats.damage * (player.damageMult || 1);
          if (isCrit) dmg = Math.floor(dmg * player.critMult);
          else dmg = Math.floor(dmg);
          enemy.takeDamage(dmg);
          if (damageNumbers) damageNumbers.add(enemy.x, enemy.y - 20, dmg, isCrit);
        }
      });
      return true;
    }
    return false;
  }

  draw(ctx, player) {
    const stats = this.stats;
    const t = this.tickTimer / stats.tickRate;
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.005) * 0.05;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(player.x, player.y, stats.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Tick progress ring
    ctx.globalAlpha = 0.4 * t;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, stats.radius * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }
}
