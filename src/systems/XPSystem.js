export class XPSystem {
  constructor() {
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 100;
  }

  getXpRequired(level) {
    // Level 1->2: 100, each next: × 1.2
    let req = 100;
    for (let i = 2; i < level; i++) {
      req = Math.round(req * 1.2);
    }
    return req;
  }

  addXP(amount, xpMult = 1) {
    this.xp += Math.floor(amount * xpMult);
    let levelsGained = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      levelsGained++;
      this.xpToNext = this.getXpRequired(this.level + 1);
    }
    return levelsGained;
  }

  getProgress() {
    return this.xp / this.xpToNext;
  }
}
