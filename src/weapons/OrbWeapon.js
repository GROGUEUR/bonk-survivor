import { WeaponBase } from './WeaponBase.js';

export class OrbWeapon extends WeaponBase {
  constructor() {
    super('orb');
    this.angle = 0;
  }

  update(dt, player) {
    this.angle += this.stats.rotSpeed * (dt / 1000);
  }

  getOrbPositions(player) {
    const positions = [];
    const count = this.stats.count;
    for (let i = 0; i < count; i++) {
      const a = this.angle + (Math.PI * 2 / count) * i;
      positions.push({
        x: player.x + Math.cos(a) * this.stats.radius,
        y: player.y + Math.sin(a) * this.stats.radius,
      });
    }
    return positions;
  }

  checkHits(player, enemies, damageNumbers, audioSystem) {
    const positions = this.getOrbPositions(player);
    const hitThisFrame = new Set();

    positions.forEach(pos => {
      enemies.forEach(enemy => {
        if (!enemy.alive) return;
        const dx = enemy.x - pos.x;
        const dy = enemy.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitDist = enemy.size / 2 + this.stats.size;
        if (dist < hitDist && !hitThisFrame.has(enemy)) {
          hitThisFrame.add(enemy);
          const isCrit = Math.random() < player.critChance;
          let dmg = this.stats.damage * (player.damageMult || 1);
          if (isCrit) dmg = Math.floor(dmg * player.critMult);
          else dmg = Math.floor(dmg);
          enemy.takeDamage(dmg);
          if (damageNumbers) damageNumbers.add(enemy.x, enemy.y - 20, dmg, isCrit);
          if (audioSystem) audioSystem.playHit();
        }
      });
    });
  }

  draw(ctx, player) {
    const positions = this.getOrbPositions(player);
    positions.forEach(pos => {
      ctx.save();
      ctx.fillStyle = '#ffdd00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffaa00';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, this.stats.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
