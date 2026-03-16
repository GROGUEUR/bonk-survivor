import React, { useState } from 'react';
import { META_UPGRADES } from '../systems/MetaProgression.js';
import './UpgradeShopScreen.css';

export default function UpgradeShopScreen({ meta, onClose }) {
  const [, forceUpdate] = useState(0);

  function handleBuy(id) {
    if (meta.purchase(id)) {
      forceUpdate(n => n + 1);
    }
  }

  return (
    <div className="shop-screen">
      <div className="shop-bg-grid" />
      <div className="shop-content">
        <h2 className="shop-title">AMÉLIORATIONS PERMANENTES</h2>
        <div className="shop-essence">
          <span className="essence-icon">◈</span>
          <span className="essence-amount">{meta.essence}</span>
          <span className="essence-label"> ESSENCE</span>
        </div>
        <p className="shop-hint">L'essence est gagnée à chaque partie (kills, boss, durée).</p>

        <div className="shop-grid">
          {META_UPGRADES.map(def => {
            const lvl     = meta.getLevel(def.id);
            const maxed   = lvl >= def.levels;
            const cost    = maxed ? null : meta.getCost(def.id);
            const canBuy  = !maxed && meta.canAfford(def.id);

            return (
              <div key={def.id} className={`shop-card ${maxed ? 'shop-card-maxed' : ''}`}>
                <div className="shop-card-icon">{def.icon}</div>
                <div className="shop-card-name">{def.name}</div>
                <div className="shop-card-desc">{def.desc}</div>
                <div className="shop-card-level">
                  {Array.from({ length: def.levels }).map((_, i) => (
                    <span key={i} className={`shop-pip ${i < lvl ? 'pip-filled' : 'pip-empty'}`} />
                  ))}
                </div>
                {maxed ? (
                  <div className="shop-card-maxed-label">MAX</div>
                ) : (
                  <button
                    className={`shop-buy-btn ${canBuy ? 'shop-buy-active' : 'shop-buy-disabled'}`}
                    onClick={() => handleBuy(def.id)}
                    disabled={!canBuy}
                  >
                    <span className="essence-icon-small">◈</span> {cost}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button className="shop-close-btn" onClick={onClose}>
          ← RETOUR
        </button>
      </div>
    </div>
  );
}
