import React from 'react';
import './PauseMenu.css';

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function PauseMenu({ stats, onResume, onQuit }) {
  if (!stats) return null;
  const { hp, maxHp, elapsed, kills, level, weapons, charData } = stats;

  return (
    <div className="pause-overlay">
      <div className="pause-content">
        <h1 className="pause-title">PAUSE</h1>

        <div className="pause-stats">
          <div className="pause-stat-row">
            <span>⏱ Temps</span>
            <span>{formatTime(elapsed)}</span>
          </div>
          <div className="pause-stat-row">
            <span>💀 Kills</span>
            <span>{kills}</span>
          </div>
          <div className="pause-stat-row">
            <span>⬆ Niveau</span>
            <span>{level}</span>
          </div>
          <div className="pause-stat-row">
            <span>❤ HP</span>
            <span>{hp} / {maxHp}</span>
          </div>
          {charData && (
            <div className="pause-stat-row">
              <span>🎭 Personnage</span>
              <span style={{ color: charData.color }}>{charData.name}</span>
            </div>
          )}
        </div>

        {weapons?.length > 0 && (
          <div className="pause-weapons">
            {weapons.map((w, i) => (
              <span key={i} className="pause-weapon-chip">{w.icon} Niv.{w.level + 1}</span>
            ))}
          </div>
        )}

        <div className="pause-buttons">
          <button className="pause-resume-btn" onClick={onResume}>▶ REPRENDRE</button>
          <button className="pause-quit-btn"   onClick={onQuit}>✕ QUITTER</button>
        </div>

        <p className="pause-hint">Appuie sur ÉCHAP pour reprendre</p>
      </div>
    </div>
  );
}
