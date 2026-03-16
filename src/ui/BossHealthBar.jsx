import React from 'react';
import './BossHealthBar.css';

export default function BossHealthBar({ stats }) {
  if (!stats || !stats.bossName || stats.bossHp === null) return null;
  const pct = (stats.bossHp / stats.bossMaxHp) * 100;

  return (
    <div className="boss-bar-wrap">
      <div className="boss-bar-name">{stats.bossName}</div>
      <div className="boss-bar-bg">
        <div className="boss-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="boss-bar-hp">{Math.ceil(stats.bossHp)} / {stats.bossMaxHp}</div>
    </div>
  );
}
