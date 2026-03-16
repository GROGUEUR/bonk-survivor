import React, { useEffect, useState } from 'react';
import './TitleScreen.css';

export default function TitleScreen({ onPlay, onCoop, onShop, onWeaponShop, onNetworkCreate, onNetworkJoin, bestScore, essence, gold }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 600);
    return () => clearInterval(t);
  }, []);

  function formatTime(s) {
    if (!s) return '--:--';
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return (
    <div className="title-screen">
      <div className="title-bg-grid" />
      <div className="title-content">
        <h1 className="title-main">BONK</h1>
        <h1 className="title-sub">SURVIVOR</h1>
        <p className="title-tagline">Survivez aussi longtemps que possible.</p>

        <div className="title-btn-group">
          <button
            className={`title-play-btn ${pulse ? 'pulse' : ''}`}
            onClick={onPlay}
          >
            ▶ SOLO
          </button>
          <button className="title-coop-btn" onClick={onCoop}>
            ⚔ CO-OP (2 joueurs)
          </button>
        </div>

        <div className="title-net-group">
          <button className="title-net-btn" onClick={onNetworkCreate}>
            ⊞ CRÉER SALON
          </button>
          <button className="title-net-btn" onClick={onNetworkJoin}>
            ⊟ REJOINDRE
          </button>
        </div>

        <div className="title-shop-row">
          <button className="title-shop-btn" onClick={onShop}>
            ◈ AMÉLIORATIONS
            {essence > 0 && <span className="title-essence-badge">{essence} ess.</span>}
          </button>
          <button className="title-wshop-btn" onClick={onWeaponShop}>
            ⬡ ARSENAL
            {gold > 0 && <span className="title-gold-badge">{gold} or</span>}
          </button>
        </div>

        {bestScore > 0 && (
          <div className="title-best">
            Meilleur : {formatTime(bestScore)}
          </div>
        )}

        <div className="title-controls">
          <div className="controls-title">CONTRÔLES</div>
          <div className="controls-grid">
            <span>P1: ZQSD / WASD</span><span>Déplacer</span>
            <span>P1: ESPACE</span><span>Dash</span>
            <span>P2: IJKL</span><span>Déplacer (co-op)</span>
            <span>P2: ENTRÉE</span><span>Dash (co-op)</span>
            <span>ÉCHAP</span><span>Pause</span>
            <span>Armes</span><span>Automatiques</span>
          </div>
        </div>
      </div>
    </div>
  );
}
