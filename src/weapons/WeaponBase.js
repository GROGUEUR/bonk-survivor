import { WEAPON_DATA } from '../data/weaponData.js';

export class WeaponBase {
  constructor(id) {
    this.id = id;
    this.level = 0;
    this.cooldownTimer = 0;
    this.data = WEAPON_DATA[id];
  }

  get stats() {
    return this.data.levels[this.level];
  }

  levelUp() {
    if (this.level < this.data.levels.length - 1) {
      this.level++;
    }
  }

  getCooldown(player) {
    const base = this.stats.cooldown || 0;
    return base * (player.cooldownMult || 1);
  }

  update(dt, player) {
    // Override in subclasses
  }

  draw(ctx, player) {
    // Override in subclasses
  }
}
