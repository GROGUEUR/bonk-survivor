import React from 'react';
import './GameOverScreen.css';

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function GameOverScreen({ stats, onReplay, onReplaySameChar, onMenu, essenceEarned, isCoop }) {
  if (!stats) return null;
  const { elapsed, kills, level, totalDamage, weapons, bossKills, maxCombo, charData, startWeapon, players } = stats;

  return (
    <div className="gameover-screen">
      <div className="gameover-content">
        <h1 className="gameover-title">GAME OVER</h1>

        {charData && (
          <div className="gameover-char-row" style={{ '--char-color': charData.color }}>
            <span className="gameover-char-name">{charData.name}</span>
            <span className="gameover-char-title">{charData.title}</span>
          </div>
        )}

        <div className="gameover-stats">
          <div className="stat-row"><span className="stat-label">⏱ Temps survécu</span><span className="stat-value">{formatTime(elapsed)}</span></div>
          <div className="stat-row"><span className="stat-label">💀 Ennemis tués</span><span className="stat-value">{kills}</span></div>
          <div className="stat-row"><span className="stat-label">⬆ Niveau atteint</span><span className="stat-value">{level}</span></div>
          <div className="stat-row"><span className="stat-label">🗡 Dégâts totaux</span><span className="stat-value">{totalDamage.toLocaleString()}</span></div>
          {bossKills > 0 && (
            <div className="stat-row"><span className="stat-label">👑 Boss tués</span><span className="stat-value">{bossKills}</span></div>
          )}
          {maxCombo > 1 && (
            <div className="stat-row"><span className="stat-label">🔥 Combo max</span><span className="stat-value">x{maxCombo}</span></div>
          )}
          {startWeapon && (
            <div className="stat-row"><span className="stat-label">Arme départ</span><span className="stat-value">{startWeapon}</span></div>
          )}
          {essenceEarned?.grade && (
            <div className="stat-row">
              <span className="stat-label">Performance</span>
              <span className="stat-value" style={{ color: essenceEarned.grade >= 2.5 ? '#ff44ff' : essenceEarned.grade >= 2 ? '#ffdd00' : essenceEarned.grade >= 1.5 ? '#44ffaa' : essenceEarned.grade >= 1.2 ? '#88ccff' : '#aaa' }}>
                {essenceEarned.grade >= 2.5 ? 'S+' : essenceEarned.grade >= 2 ? 'S' : essenceEarned.grade >= 1.5 ? 'A' : essenceEarned.grade >= 1.2 ? 'B' : 'C'}
              </span>
            </div>
          )}
          {essenceEarned?.essence > 0 && (
            <div className="stat-row">
              <span className="stat-label">◈ Essence gagnée</span>
              <span className="stat-value" style={{ color: '#88aaff' }}>+{essenceEarned.essence}</span>
            </div>
          )}
          {essenceEarned?.gold > 0 && (
            <div className="stat-row">
              <span className="stat-label">⬡ Or gagné</span>
              <span className="stat-value" style={{ color: '#ffcc44' }}>+{essenceEarned.gold}</span>
            </div>
          )}
        </div>

        {weapons?.length > 0 && (
          <div className="gameover-weapons">
            <div className="gameover-weapons-title">Armes utilisées</div>
            <div className="gameover-weapons-list">
              {weapons.map((w, i) => <span key={i} className="gameover-weapon-tag">{w}</span>)}
            </div>
          </div>
        )}

        <div className="gameover-buttons">
          {charData && (
            <button className="gameover-same-btn" onClick={onReplaySameChar}>
              ↺ MÊME PERSO
            </button>
          )}
          <button className="gameover-replay-btn" onClick={onReplay}>
            ↺ REJOUER
          </button>
          <button className="gameover-menu-btn" onClick={onMenu}>
            ⌂ MENU
          </button>
        </div>
      </div>
    </div>
  );
}
