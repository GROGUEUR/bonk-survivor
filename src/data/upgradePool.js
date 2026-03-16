import { WEAPON_DATA } from './weaponData.js';

export function getUpgradeChoices(player, count = 3, minRarity = null) {
  const pool = buildPool(player);
  const shuffled = pool.sort(() => Math.random() - 0.5);
  if (minRarity) {
    const ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };
    const filtered = shuffled.filter(c => ORDER[c.rarity] >= ORDER[minRarity]);
    return (filtered.length >= count ? filtered : shuffled).slice(0, count);
  }
  return shuffled.slice(0, count);
}

function buildPool(player) {
  const pool = [];

  // Passive upgrades
  const passives = [
    {
      id: 'hp_up', name: '+20 HP Max', icon: '❤️', description: '+20 HP maximum et soin',
      rarity: 'common',
      apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.hp + 20, p.maxHp); },
    },
    {
      id: 'speed_up', name: '+Vitesse', icon: '🏃', description: '+10% vitesse de déplacement',
      rarity: 'common',
      apply: (p) => { p.speed *= 1.1; },
    },
    {
      id: 'xp_magnet', name: 'Aimant XP', icon: '🧲', description: '+30% rayon de collecte XP',
      rarity: 'common',
      apply: (p) => { p.xpRadius *= 1.3; },
    },
    {
      id: 'armor_up', name: '+Armure', icon: '🛡️', description: '+2 armure (réduit les dégâts)',
      rarity: 'rare',
      apply: (p) => { p.armor += 2; },
    },
    {
      id: 'regen_up', name: 'Régénération', icon: '💚', description: '+0.5 HP/sec',
      rarity: 'rare',
      apply: (p) => { p.regen += 0.5; },
    },
    {
      id: 'crit_chance', name: '+Crit Chance', icon: '⚡', description: '+5% chance critique',
      rarity: 'rare',
      apply: (p) => { p.critChance = Math.min(p.critChance + 0.05, 0.8); },
    },
    {
      id: 'crit_dmg', name: '+Crit Dégâts', icon: '💥', description: '+25% dégâts critiques',
      rarity: 'rare',
      apply: (p) => { p.critMult += 0.25; },
    },
    {
      id: 'dmg_up', name: '+Dégâts', icon: '📈', description: '+10% dégâts globaux',
      rarity: 'rare',
      apply: (p) => { p.damageMult = (p.damageMult || 1) * 1.1; },
    },
    {
      id: 'cooldown_down', name: '-Cooldown', icon: '🕐', description: '-8% cooldown des armes',
      rarity: 'rare',
      apply: (p) => { p.cooldownMult = (p.cooldownMult || 1) * 0.92; },
    },
    {
      id: 'xp_bonus', name: '+XP', icon: '✨', description: '+15% XP gagnée',
      rarity: 'common',
      apply: (p) => { p.xpMult = (p.xpMult || 1) * 1.15; },
    },
    {
      id: 'legendary_dmg', name: 'PUISSANCE', icon: '🌟', description: 'Tous dégâts x1.5',
      rarity: 'legendary',
      apply: (p) => { p.damageMult = (p.damageMult || 1) * 1.5; },
    },
    {
      id: 'legendary_xp', name: 'DOUBLE XP', icon: '💫', description: 'Double XP permanente',
      rarity: 'legendary',
      apply: (p) => { p.xpMult = (p.xpMult || 1) * 2; },
    },
  ];

  // Vampire (Nosfera) can't use standard HP heals
  const filteredPassives = player.noHeal
    ? passives.filter(u => u.id !== 'hp_up' && u.id !== 'regen_up')
    : passives;

  filteredPassives.forEach(u => pool.push({ ...u, type: 'passive' }));

  // New weapon upgrades
  const weaponIds = ['orb', 'shot', 'flame', 'lightning', 'boomerang', 'nova'];
  weaponIds.forEach(wid => {
    if (!player.hasWeapon(wid) && player.weapons.length < player.maxWeapons) {
      const data = WEAPON_DATA[wid];
      pool.push({
        id: `new_${wid}`,
        name: data.name,
        icon: data.icon,
        description: `Nouvelle arme: ${data.description}`,
        rarity: 'epic',
        type: 'new_weapon',
        weaponId: wid,
        apply: (p, game) => { game._addWeaponForPlayer(p, wid); },
      });
    }
  });

  // Weapon level upgrades
  player.weapons.forEach(weapon => {
    const data = WEAPON_DATA[weapon.id];
    if (weapon.level < data.levels.length - 1) {
      const nextLevel = weapon.level + 1;
      pool.push({
        id: `upgrade_${weapon.id}`,
        name: `${data.name} Niv.${nextLevel + 1}`,
        icon: data.icon,
        description: `Améliore ${data.name}`,
        rarity: nextLevel >= 3 ? 'epic' : (nextLevel >= 2 ? 'rare' : 'common'),
        type: 'weapon_upgrade',
        weaponId: weapon.id,
        currentLevel: weapon.level,
        apply: (p, _game) => { const w = p.weapons.find(x => x.id === weapon.id); if (w) w.levelUp(); },
      });
    }
  });

  // Fortuna (lucky) boosts higher rarities
  const isLucky = player.charData?.passive?.id === 'luck';

  // Weight by rarity
  const weighted = [];
  pool.forEach(item => {
    let weight = item.rarity === 'legendary' ? 1
      : item.rarity === 'epic' ? 4
      : item.rarity === 'rare' ? 10
      : 20;
    if (isLucky) {
      if (item.rarity === 'legendary') weight = 3;
      else if (item.rarity === 'epic') weight = 8;
      else if (item.rarity === 'rare') weight = 14;
    }
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  return weighted;
}
