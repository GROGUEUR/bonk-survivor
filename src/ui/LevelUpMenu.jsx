import React from 'react';
import './LevelUpMenu.css';

const RARITY_LABELS = {
  common: 'COMMUN',
  rare: 'RARE',
  epic: 'ÉPIQUE',
  legendary: 'LÉGENDAIRE',
};

export default function LevelUpMenu({ choices, onChoose, level, isChest, playerLabel }) {
  if (!choices || choices.length === 0) return null;

  // Deduplicate choices by id
  const seen = new Set();
  const unique = choices.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return (
    <div className="levelup-overlay">
      <div className="levelup-content">
        <h2 className="levelup-title">{isChest ? 'COFFRE AU TRESOR' : `NIVEAU ${level} !`}</h2>
        {playerLabel && <p className="levelup-player-label">{playerLabel}</p>}
        <p className="levelup-subtitle">{isChest ? 'Amélioration bonus — rareté garantie' : 'Choisissez une amélioration'}</p>
        <div className="levelup-cards">
          {unique.slice(0, 3).map((choice, i) => (
            <button
              key={`${choice.id}-${i}`}
              className={`levelup-card rarity-${choice.rarity}`}
              onClick={() => onChoose(choice)}
            >
              <div className="card-icon">{choice.icon}</div>
              <div className="card-name">{choice.name}</div>
              <div className="card-desc">{choice.description}</div>
              <div className={`card-rarity rarity-text-${choice.rarity}`}>
                {RARITY_LABELS[choice.rarity] || choice.rarity}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
