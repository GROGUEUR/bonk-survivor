import { WeaponBase } from './WeaponBase.js';
import { distance } from '../utils/math.js';

export class LightningWeapon extends WeaponBase {
  constructor() {
    super('lightning');
    this.timer = 0;
    this.bolts = []; // Visual bolts {x1,y1,x2,y2,alpha}
  }

  update(dt, player) {
    const cooldown = this.getCooldown(player);
    this.timer += dt;
    if (this.timer >= cooldown) {
      this.timer -= cooldown;
      this._needsFire = true;
    }
    this.bolts = this.bolts
      .map(b => ({ ...b, alpha: b.alpha - dt * 0.008 }))
      .filter(b => b.alpha > 0);
  }

  fire(player, enemies, damageNumbers, audioSystem) {
    if (!this._needsFire) return;
    this._needsFire = false;

    const stats = this.stats;
    // Find closest enemies
    const alive = enemies.filter(e => e.alive);
    alive.sort((a, b) =>
      distance(player.x, player.y, a.x, a.y) - distance(player.x, player.y, b.x, b.y)
    );
    const targets = alive.slice(0, stats.targets);

    targets.forEach(enemy => {
      const isCrit = Math.random() < player.critChance;
      let dmg = stats.damage * (player.damageMult || 1);
      if (isCrit) dmg = Math.floor(dmg * player.critMult);
      else dmg = Math.floor(dmg);
      enemy.takeDamage(dmg);
      if (damageNumbers) damageNumbers.add(enemy.x, enemy.y - 20, dmg, isCrit);
      if (audioSystem) audioSystem.playLightning();
      this.bolts.push({ x1: player.x, y1: player.y, x2: enemy.x, y2: enemy.y, alpha: 1 });
    });
  }

  draw(ctx, player) {
    this.bolts.forEach(bolt => {
      ctx.save();
      ctx.globalAlpha = bolt.alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#aaddff';

      // Jagged lightning line
      ctx.beginPath();
      ctx.moveTo(bolt.x1, bolt.y1);
      const segments = 6;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const mx = bolt.x1 + (bolt.x2 - bolt.x1) * t + (Math.random() - 0.5) * 20;
        const my = bolt.y1 + (bolt.y2 - bolt.y1) * t + (Math.random() - 0.5) * 20;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(bolt.x2, bolt.y2);
      ctx.stroke();
      ctx.restore();
    });
  }
}
