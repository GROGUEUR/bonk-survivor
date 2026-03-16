import React from 'react';
import './HUD.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function PlayerPanel({ p, label }) {
  if (!p) return null;
  const hpPct  = (p.hp / p.maxHp) * 100;
  const xpPct  = (p.xp / p.xpToNext) * 100;
  const dashRdy = !p.dashCooldownPct || p.dashCooldownPct <= 0.01;
  const hpColor = p.hp / p.maxHp < 0.3 ? '#ff4444' : '#44ff44';
  return (
    <div className="hud-player-panel">
      {label && <div className="hud-player-label" style={{ color: p.charData?.color || '#4488ff' }}>{label}</div>}
      <div className="hud-bar-row">
        <span className="hud-label">HP</span>
        <div className="hud-bar-bg" style={{ width: 180 }}>
          <div className="hud-bar-fill" style={{ width: `${hpPct}%`, background: `linear-gradient(90deg, #662222, ${hpColor})` }} />
        </div>
        <span className="hud-value">{p.hp}/{p.maxHp}</span>
      </div>
      <div className="hud-bar-row">
        <span className="hud-label">XP</span>
        <div className="hud-bar-bg" style={{ width: 180 }}>
          <div className="hud-bar-fill xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
        <span className="hud-value">Niv.{p.level}</span>
      </div>
      {p.passiveInfo?.rageStacks > 0 && (
        <div className="hud-passive-info rage">Rage: +{(p.passiveInfo.rageStacks * 1).toFixed(0)}%</div>
      )}
      {p.passiveInfo?.overclockActive && (
        <div className="hud-passive-info overclock">OVERCLOCK x3</div>
      )}
      {p.passiveInfo?.tauntActive && (
        <div className="hud-passive-info fortress">PROVOCATION ACTIVE</div>
      )}
      <div className="hud-dash-row">
        <span className="hud-dash-label">DASH</span>
        <div className={`hud-dash-bar-bg ${dashRdy ? 'dash-ready' : ''}`} style={{ width: 80 }}>
          <div className="hud-dash-bar-fill"
            style={{ width: p.dashActive ? '100%' : `${(1 - (p.dashCooldownPct || 0)) * 100}%` }} />
        </div>
        {dashRdy && <span className="hud-dash-ready">PRÊT</span>}
      </div>
    </div>
  );
}

export default function HUD({ stats, onToggleMute }) {
  if (!stats) return null;

  const { elapsed, kills, weapons, muted, waveNumber, nextMiniBossIn,
          isCoop, players } = stats;

  const bossBarW = Math.max(0, Math.min(100, (nextMiniBossIn / 60) * 100));

  // In solo, players array has 1 element = same as stats top-level
  const p1 = players?.[0] || stats;
  const p2 = isCoop && players?.[1];

  const p1Weapons = p1.weapons || weapons || [];
  const maxSlots  = (p1.charData?.stats?.maxWeapons) || 6;

  return (
    <div className="hud">
      {/* Top-left: players stats */}
      <div className="hud-topleft">
        <PlayerPanel p={p1} label={isCoop ? `P1 — ${p1.charData?.name || ''}` : null} />
        {p2 && <PlayerPanel p={p2} label={`P2 — ${p2.charData?.name || ''}`} />}
      </div>

      {/* Top-right: timer, kills, wave, mute */}
      <div className="hud-topright">
        <div className="hud-timer">{formatTime(elapsed)}</div>
        <div className="hud-kills">Kills: {kills}</div>
        <div className="hud-wave">Vague {waveNumber}</div>
        <div className="hud-boss-bar-row">
          <span className="hud-boss-label">Boss</span>
          <div className="hud-boss-bar-bg">
            <div className="hud-boss-bar-fill" style={{ width: `${bossBarW}%` }} />
          </div>
        </div>
        <button className="hud-mute-btn" onClick={onToggleMute} style={{ pointerEvents: 'all' }}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Bottom: P1 weapon slots */}
      <div className="hud-bottom-area">
        {isCoop && <div className="hud-coop-controls">P1: ZQSD+ESPACE  |  P2: IJKL+ENTRÉE</div>}
        <div className="hud-bottombar">
          {Array.from({ length: maxSlots }).map((_, i) => {
            const w = p1Weapons[i];
            return (
              <div key={i} className={`hud-slot ${w ? 'hud-slot-active' : ''}`}>
                {w ? (
                  <>
                    <span className="hud-slot-icon">{w.icon}</span>
                    <span className="hud-slot-level">Niv.{w.level + 1}</span>
                  </>
                ) : (
                  <span className="hud-slot-empty">·</span>
                )}
              </div>
            );
          })}
        </div>

        {/* P2 weapon slots in co-op */}
        {p2 && (
          <div className="hud-bottombar hud-bottombar-p2">
            {Array.from({ length: 6 }).map((_, i) => {
              const w = p2.weapons?.[i];
              return (
                <div key={i} className={`hud-slot hud-slot-p2 ${w ? 'hud-slot-active' : ''}`}>
                  {w ? (
                    <>
                      <span className="hud-slot-icon">{w.icon}</span>
                      <span className="hud-slot-level">Niv.{w.level + 1}</span>
                    </>
                  ) : (
                    <span className="hud-slot-empty">·</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
