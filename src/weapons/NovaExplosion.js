import { WeaponBase } from './WeaponBase.js';

export class NovaExplosion extends WeaponBase {
  constructor() {
    super('nova');
    this.timer = 0;
    this.rings = []; // { radius, maxRadius, alpha }
  }

  update(dt, player) {
    const cooldown = this.getCooldown(player);
    this.timer += dt;
    if (this.timer >= cooldown) {
      this.timer -= cooldown;
      this._needsFire = true;
    }
    this.rings = this.rings
      .map(r => ({
        ...r,
        radius: r.radius + dt * 0.3,
        alpha: r.alpha - dt * 0.002,
      }))
      .filter(r => r.alpha > 0);
  }

  fire(player, enemies, damageNumbers, audioSystem) {
    if (!this._needsFire) return;
    this._needsFire = false;

    const stats = this.stats;
    for (let e = 0; e < stats.count; e++) {
      const delay = e * 150;
      setTimeout(() => {
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
        if (audioSystem) audioSystem.playExplosion();
      }, delay);

      this.rings.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: stats.radius,
        alpha: 0.8,
      });
    }
  }

  draw(ctx, player) {
    this.rings.forEach(ring => {
      ctx.save();
      ctx.globalAlpha = ring.alpha;
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff8800';
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = ring.alpha * 0.2;
      ctx.fillStyle = '#ff4400';
      ctx.fill();
      ctx.restore();
    });
  }
}
