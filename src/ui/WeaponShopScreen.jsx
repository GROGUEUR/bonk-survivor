import React, { useState } from 'react';
import { WEAPON_TIERS, TIER_DESCS } from '../systems/MetaProgression.js';
import './WeaponShopScreen.css';

const WEAPON_IDS = ['orb', 'shot', 'flame', 'lightning', 'boomerang', 'nova'];

export default function WeaponShopScreen({ meta, onClose }) {
  const [, forceUpdate] = useState(0);

  function handleBuy(wid) {
    if (meta.purchaseWeaponTier(wid)) {
      forceUpdate(n => n + 1);
    }
  }

  return (
    <div className="wshop-screen">
      <div className="wshop-bg-grid" />
      <div className="wshop-content">
        <h2 className="wshop-title">ARSENAL</h2>

        <div className="wshop-currencies">
          <div className="wshop-currency">
            <span className="wshop-curr-icon gold-icon">⬡</span>
            <span className="wshop-curr-amount">{meta.gold}</span>
            <span className="wshop-curr-label">OR</span>
          </div>
          <div className="wshop-currency">
            <span className="wshop-curr-icon ess-icon">◈</span>
            <span className="wshop-curr-amount">{meta.essence}</span>
            <span className="wshop-curr-label">ESSENCE</span>
          </div>
        </div>

        <p className="wshop-hint">
          L'or est gagné à chaque partie. Améliorez vos armes pour commencer plus fort.
        </p>

        <div className="wshop-grid">
          {WEAPON_IDS.map(wid => {
            const def      = WEAPON_TIERS[wid];
            const tier     = meta.getWeaponTier(wid);
            const maxed    = tier >= def.maxTier;
            const cost     = meta.getWeaponUpgradeCost(wid);
            const canBuy   = !maxed && meta.canAffordWeapon(wid);

            return (
              <div key={wid} className={`wshop-card ${maxed ? 'wshop-card-maxed' : ''}`}>
                <div className="wshop-card-icon">{def.icon}</div>
                <div className="wshop-card-name">{def.name}</div>

                <div className="wshop-tier-row">
                  {Array.from({ length: def.maxTier }).map((_, i) => (
                    <span key={i} className={`wshop-pip ${i < tier ? 'pip-gold' : 'pip-empty'}`} />
                  ))}
                </div>

                <div className="wshop-card-desc">
                  {tier > 0 ? TIER_DESCS[tier - 1] : 'Niveau de départ de base'}
                </div>

                {maxed ? (
                  <div className="wshop-maxed-label">MAX</div>
                ) : (
                  <div className="wshop-next-info">
                    <span className="wshop-next-tier">{TIER_DESCS[tier]}</span>
                    <button
                      className={`wshop-buy-btn ${canBuy ? 'wshop-buy-active' : 'wshop-buy-disabled'}`}
                      onClick={() => handleBuy(wid)}
                      disabled={!canBuy}
                    >
                      <span className="gold-icon-small">⬡</span> {cost}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="wshop-close-btn" onClick={onClose}>
          ← RETOUR
        </button>
      </div>
    </div>
  );
}
