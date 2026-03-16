import React, { useState } from 'react';
import { WEAPON_DATA } from '../data/weaponData.js';
import './WeaponSelectScreen.css';

const WEAPON_STATS = {
  orb:       { dmg: '10/hit', rate: 'Continu', portee: '60px rayon' },
  shot:      { dmg: '20/proj', rate: '1/sec', portee: 'Écran entier' },
  flame:     { dmg: '5/tick', rate: '3.3/sec', portee: '80px zone' },
  lightning: { dmg: '40/éclair', rate: '0.5/sec', portee: 'Ennemi proche' },
  boomerang: { dmg: '15×2', rate: '0.67/sec', portee: '200px allers' },
  nova:      { dmg: '50 AoE', rate: '0.2/sec', portee: '150px rayon' },
};

export default function WeaponSelectScreen({ character, onSelect, onBack, title, playerColor }) {
  const [selected, setSelected] = useState(null);

  const weapons = character.startWeapons.map(id => ({
    ...WEAPON_DATA[id],
    stats: WEAPON_STATS[id],
  }));

  return (
    <div className="weapon-select-screen">
      <div className="weapon-bg-grid" />
      <div className="weapon-select-content">
        <h2 className="weapon-select-title" style={playerColor ? { color: playerColor, textShadow: `0 0 16px ${playerColor}` } : {}}>
          {title || 'ARME DE DÉPART'}
        </h2>
        <p className="weapon-select-sub" style={{ color: character.color }}>
          {character.name} — Choisissez votre arme initiale
        </p>

        <div className="weapon-cards">
          {weapons.map((w, i) => (
            <div
              key={w.id}
              className={`weapon-card ${selected?.id === w.id ? 'selected' : ''}`}
              onClick={() => setSelected(w)}
            >
              <div className="weapon-icon">{w.icon}</div>
              <div className="weapon-name">{w.name}</div>
              <div className="weapon-desc">{w.description}</div>
              <div className="weapon-stats-grid">
                <div className="weapon-stat-item">
                  <span className="weapon-stat-label">Dégâts</span>
                  <span className="weapon-stat-value">{w.stats.dmg}</span>
                </div>
                <div className="weapon-stat-item">
                  <span className="weapon-stat-label">Cadence</span>
                  <span className="weapon-stat-value">{w.stats.rate}</span>
                </div>
                <div className="weapon-stat-item">
                  <span className="weapon-stat-label">Portée</span>
                  <span className="weapon-stat-value">{w.stats.portee}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="weapon-buttons">
          <button className="weapon-back-btn" onClick={onBack}>← RETOUR</button>
          {selected && (
            <button
              className="weapon-confirm-btn"
              onClick={() => onSelect(selected.id)}
            >
              {selected.icon} {selected.name} — LANCER →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
