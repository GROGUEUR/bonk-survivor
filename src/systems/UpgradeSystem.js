import { getUpgradeChoices } from '../data/upgradePool.js';

export class UpgradeSystem {
  constructor() {
    this.pendingLevels = 0;
  }

  queueLevelUp(count = 1) {
    this.pendingLevels += count;
  }

  hasPending() {
    return this.pendingLevels > 0;
  }

  getChoices(player, count = 3, minRarity = null) {
    return getUpgradeChoices(player, count, minRarity);
  }

  applyChoice(choice, player, game) {
    choice.apply(player, game);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
  }
}
