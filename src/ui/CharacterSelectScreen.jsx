import React, { useRef, useEffect, useState } from 'react';
import { CHARACTER_LIST } from '../data/characters.js';
import './CharacterSelectScreen.css';

function CharacterPreview({ char }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 80, 80);
    const cx = 40, cy = 42;
    const s  = char.size * 1.3;
    const h  = s / 2;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = char.color;
    ctx.fillStyle   = char.color;

    if (char.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - h); ctx.lineTo(cx + h, cy);
      ctx.lineTo(cx, cy + h); ctx.lineTo(cx - h, cy);
      ctx.closePath(); ctx.fill();

    } else if (char.shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx + h, cy);
      ctx.lineTo(cx - h, cy - h * 0.75);
      ctx.lineTo(cx - h, cy + h * 0.75);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx + h * 0.25, cy, 3, 0, Math.PI * 2); ctx.fill();

    } else if (char.shape === 'circle' || char.shape === 'clover') {
      ctx.beginPath(); ctx.arc(cx, cy, h, 0, Math.PI * 2); ctx.fill();
      if (char.shape === 'clover') {
        ctx.fillStyle = '#115511'; ctx.shadowBlur = 0;
        const lo = h * 0.28, lr = h * 0.22;
        [[0,-lo],[lo,0],[0,lo],[-lo,0]].forEach(([lx,ly]) => {
          ctx.beginPath(); ctx.arc(cx+lx, cy+ly, lr, 0, Math.PI*2); ctx.fill();
        });
      }
      if (char.id === 'vampire') {
        ctx.fillStyle = '#ff2222'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(cx - h*0.35, cy - h*0.15, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + h*0.35, cy - h*0.15, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        [[-h*0.2, h*0.2],[h*0.2, h*0.2]].forEach(([fx,fy]) => {
          ctx.beginPath(); ctx.moveTo(cx+fx-3,cy+fy); ctx.lineTo(cx+fx,cy+fy+6); ctx.lineTo(cx+fx+3,cy+fy); ctx.closePath(); ctx.fill();
        });
      }

    } else if (char.shape === 'gear') {
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? h : h * 0.72;
        ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#333'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(cx, cy, h*0.38, 0, Math.PI*2); ctx.fill();

    } else {
      // rect (tank)
      ctx.fillRect(cx - h, cy - h, s, s);
      ctx.strokeStyle = '#6b4c20'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
      ctx.strokeRect(cx - h + 3, cy - h + 3, s - 6, s - 6);
    }
  }, [char]);

  return <canvas ref={ref} width={80} height={80} style={{ imageRendering: 'pixelated' }} />;
}

function StatBar({ label, value, color }) {
  return (
    <div className="char-stat-row">
      <span className="char-stat-label">{label}</span>
      <div className="char-stat-bar-bg">
        <div className="char-stat-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CharacterSelectScreen({ onSelect, title, playerColor }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="char-select-screen">
      <div className="char-bg-grid" />
      <div className="char-select-content">
        <h2 className="char-select-title" style={playerColor ? { color: playerColor, textShadow: `0 0 20px ${playerColor}` } : {}}>
          {title || 'CHOISISSEZ VOTRE PERSONNAGE'}
        </h2>

        <div className="char-grid">
          {CHARACTER_LIST.map(char => (
            <div
              key={char.id}
              className={`char-card ${selected?.id === char.id ? 'selected' : ''}`}
              style={{ '--char-color': char.color }}
              onClick={() => setSelected(char)}
            >
              <div className="char-sprite-wrap">
                <CharacterPreview char={char} />
              </div>
              <div className="char-name">{char.name}</div>
              <div className="char-title">{char.title}</div>
              <div className="char-stats">
                <StatBar label="HP"    value={char.statBars.hp}     color="#44ff44" />
                <StatBar label="VIT"   value={char.statBars.speed}  color="#ffdd00" />
                <StatBar label="DMG"   value={char.statBars.damage} color="#ff6644" />
                <StatBar label="LUCK"  value={char.statBars.luck}   color="#44ffaa" />
              </div>
              <div className="char-passive-wrap">
                <span className="char-passive-name">{char.passive.name}</span>
                <p className="char-passive-desc">{char.passive.description}</p>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <button
            className="char-select-btn"
            onClick={() => onSelect(selected)}
          >
            {selected.name} — SUIVANT →
          </button>
        )}
      </div>
    </div>
  );
}
