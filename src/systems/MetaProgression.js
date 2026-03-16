const SAVE_KEY = 'bonkSurvivorMeta';

export const META_UPGRADES = [
  {
    id: 'hp',
    name: 'Vitalité',
    icon: '❤',
    desc: '+20 HP max par niveau',
    levels: 10,
    baseCost: 25,
    costMult: 1.35,
    apply: (stats) => ({ ...stats, hp: (stats.hp || 100) + 20 }),
  },
  {
    id: 'dmg',
    name: 'Force',
    icon: '⚔',
    desc: '+5% dégâts par niveau',
    levels: 8,
    baseCost: 45,
    costMult: 1.45,
    apply: (stats) => ({ ...stats, damageMult: ((stats.damageMult || 1) + 0.05) }),
  },
  {
    id: 'speed',
    name: 'Agilité',
    icon: '💨',
    desc: '+4% vitesse par niveau',
    levels: 6,
    baseCost: 65,
    costMult: 1.55,
    apply: (stats) => ({ ...stats, speed: (stats.speed || 3) * 1.04 }),
  },
  {
    id: 'xp',
    name: 'Sagesse',
    icon: '✦',
    desc: '+10% XP par niveau',
    levels: 6,
    baseCost: 35,
    costMult: 1.5,
    apply: (stats) => ({ ...stats, xpMult: ((stats.xpMult || 1) + 0.10) }),
  },
  {
    id: 'armor',
    name: 'Carapace',
    icon: '🛡',
    desc: '+1 armure par niveau',
    levels: 8,
    baseCost: 40,
    costMult: 1.55,
    apply: (stats) => ({ ...stats, armor: ((stats.armor || 0) + 1) }),
  },
  {
    id: 'crit',
    name: 'Précision',
    icon: '◎',
    desc: '+3% crit par niveau',
    levels: 5,
    baseCost: 70,
    costMult: 1.8,
    apply: (stats) => ({ ...stats, critChance: ((stats.critChance || 0.05) + 0.03) }),
  },
  {
    id: 'regen',
    name: 'Récupération',
    icon: '+',
    desc: '+0.3 regen/s par niveau',
    levels: 6,
    baseCost: 30,
    costMult: 1.5,
    apply: (stats) => ({ ...stats, regen: ((stats.regen || 0) + 0.3) }),
  },
  {
    id: 'dash',
    name: 'Élan',
    icon: '»',
    desc: '-0.4s cooldown dash par niveau',
    levels: 5,
    baseCost: 55,
    costMult: 1.7,
    apply: (stats) => ({ ...stats, dashCooldownBonus: ((stats.dashCooldownBonus || 0) + 400) }),
  },
];

// Weapon upgrades available in the weapon shop
export const WEAPON_TIERS = {
  orb:       { name: 'Orbe',         icon: '⊙', maxTier: 3, costs: [60,  150, 320] },
  shot:      { name: 'Tir direct',   icon: '→', maxTier: 3, costs: [50,  120, 260] },
  flame:     { name: 'Zone de feu',  icon: '🔥', maxTier: 3, costs: [70,  170, 360] },
  lightning: { name: 'Foudre',       icon: '⚡', maxTier: 3, costs: [80,  190, 400] },
  boomerang: { name: 'Boomerang',    icon: '↺', maxTier: 3, costs: [65,  160, 340] },
  nova:      { name: 'Nova',         icon: '✸', maxTier: 3, costs: [90,  210, 440] },
};

// What each tier buys (description)
export const TIER_DESCS = [
  'Niveau de départ +1',
  'Niveau de départ +2',
  'Niveau de départ +3 (MAX)',
];

export class MetaProgression {
  constructor() {
    this._load();
  }

  _load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      const data  = saved ? JSON.parse(saved) : {};
      this.essence     = data.essence     || 0;
      this.gold        = data.gold        || 0;
      this.upgrades    = data.upgrades    || {};
      this.weaponTiers = data.weaponTiers || {};
    } catch {
      this.essence     = 0;
      this.gold        = 0;
      this.upgrades    = {};
      this.weaponTiers = {};
    }
  }

  _save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      essence:     this.essence,
      gold:        this.gold,
      upgrades:    this.upgrades,
      weaponTiers: this.weaponTiers,
    }));
  }

  // ── Essence (stat upgrades) ──────────────────────────────────────────

  getLevel(id)   { return this.upgrades[id] || 0; }
  getDef(id)     { return META_UPGRADES.find(u => u.id === id); }

  getCost(id) {
    const def = this.getDef(id);
    const lvl = this.getLevel(id);
    return Math.floor(def.baseCost * Math.pow(def.costMult, lvl));
  }

  canAfford(id) {
    const def = this.getDef(id);
    const lvl = this.getLevel(id);
    return def && lvl < def.levels && this.essence >= this.getCost(id);
  }

  purchase(id) {
    if (!this.canAfford(id)) return false;
    this.essence -= this.getCost(id);
    this.upgrades[id] = (this.upgrades[id] || 0) + 1;
    this._save();
    return true;
  }

  // ── Gold (weapon tiers) ──────────────────────────────────────────────

  getWeaponTier(wid)  { return this.weaponTiers[wid] || 0; }

  getWeaponUpgradeCost(wid) {
    const def  = WEAPON_TIERS[wid];
    const tier = this.getWeaponTier(wid);
    if (!def || tier >= def.maxTier) return null;
    return def.costs[tier];
  }

  canAffordWeapon(wid) {
    const cost = this.getWeaponUpgradeCost(wid);
    return cost !== null && this.gold >= cost;
  }

  purchaseWeaponTier(wid) {
    if (!this.canAffordWeapon(wid)) return false;
    const cost = this.getWeaponUpgradeCost(wid);
    this.gold -= cost;
    this.weaponTiers[wid] = (this.weaponTiers[wid] || 0) + 1;
    this._save();
    return true;
  }

  // ── Apply to charData ────────────────────────────────────────────────

  applyToCharData(charData) {
    if (!charData) return charData;
    let stats = { ...charData.stats };
    for (const def of META_UPGRADES) {
      const lvl = this.getLevel(def.id);
      for (let i = 0; i < lvl; i++) {
        stats = def.apply(stats, charData);
      }
    }
    const dashBonus = stats.dashCooldownBonus || 0;
    delete stats.dashCooldownBonus;
    return {
      ...charData,
      stats,
      dashCooldown: Math.max(500, (charData.dashCooldown || 3000) - dashBonus),
    };
  }

  // ── Earn from run ────────────────────────────────────────────────────

  earnFromRun({ kills = 0, bossKills = 0, elapsed = 0, level = 1, playerCount = 1 }) {
    const minutes = Math.max(elapsed / 60, 0.5);
    const kpm     = kills / minutes; // kills per minute

    // Base essence
    const baseEssence = Math.floor(kills * 0.6) + bossKills * 25 + Math.floor(elapsed / 12) + level * 4;

    // Performance grade multiplier
    let grade = 1.0;
    if (kpm >= 20 && bossKills >= 2 && elapsed >= 240) {
      grade = 2.5; // S+
    } else if (kpm >= 14 && bossKills >= 1 && elapsed >= 180) {
      grade = 2.0; // S
    } else if (kpm >= 9 && elapsed >= 120) {
      grade = 1.5; // A
    } else if (kpm >= 5 && elapsed >= 60) {
      grade = 1.2; // B
    }

    const earnedEssence = Math.floor(baseEssence * grade);

    // Gold: independent currency from runs
    const baseGold = Math.floor(kills * 0.25) + bossKills * 12 + Math.floor(elapsed / 25) + level * 2;
    const earnedGold = Math.floor(baseGold * (0.8 + (grade - 1) * 0.4));

    // Co-op bonus: slight extra for playing with others
    const coopBonus = 1 + (playerCount - 1) * 0.15;

    this.essence += Math.floor(earnedEssence * coopBonus);
    this.gold    += Math.floor(earnedGold    * coopBonus);
    this._save();

    return { essence: Math.floor(earnedEssence * coopBonus), gold: Math.floor(earnedGold * coopBonus), grade };
  }
}
