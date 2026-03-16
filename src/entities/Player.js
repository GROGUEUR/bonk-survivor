import { PLAYER, WORLD } from '../data/constants.js';
import { clamp } from '../utils/math.js';

export class Player {
  constructor(x, y, charData = null, playerIndex = 0) {
    this.x = x;
    this.y = y;
    this.charData = charData;
    this.playerIndex = playerIndex;

    const base = charData ? charData.stats : {};
    this.size        = (charData && charData.size)                    || PLAYER.SIZE;
    this.hp          = base.hp          !== undefined ? base.hp          : PLAYER.HP;
    this.maxHp       = base.hp          !== undefined ? base.hp          : PLAYER.HP;
    this.speed       = base.speed       !== undefined ? base.speed       : PLAYER.SPEED;
    this.xpRadius    = base.xpRadius    !== undefined ? base.xpRadius    : PLAYER.XP_RADIUS;
    this.armor       = base.armor       !== undefined ? base.armor       : PLAYER.ARMOR;
    this.regen       = PLAYER.REGEN;
    this.critChance  = base.critChance  !== undefined ? base.critChance  : PLAYER.CRIT_CHANCE;
    this.critMult    = base.critMult    !== undefined ? base.critMult    : PLAYER.CRIT_MULT;
    this.maxWeapons  = base.maxWeapons  !== undefined ? base.maxWeapons  : PLAYER.MAX_WEAPONS;
    this.damageMult  = base.damageMult  !== undefined ? base.damageMult  : 1;
    this.cooldownMult= base.cooldownMult !== undefined ? base.cooldownMult : 1;
    this.xpMult      = base.xpMult      !== undefined ? base.xpMult      : 1;
    this.noHeal      = charData?.noHeal || false;
    this.dodgeChance = charData?.dodgeChance || 0;

    this.weapons = [];
    this.alive = true;

    // Visual state
    this.iframeTimer = 0;
    this.flashTimer  = 0;
    this.trailPoints = [];
    this.scaleEffect = 1;
    this.scaleTimer  = 0;
    this.facing      = { dx: 1, dy: 0 };
    this.moving      = false;
    this.regenAccum  = 0;

    // Dash — per-character cooldown
    this.dashCooldown      = charData?.dashCooldown || 3000;
    this.dashCooldownTimer = 0;
    this.dashActive        = false;
    this.dashTimer         = 0;
    this.dashDuration      = charData?.id === 'speedster' ? 200 : 150;
    this.dashDir           = { dx: 1, dy: 0 };
    this.dashTrail         = [];

    // Level-up shockwave
    this.shockwaveActive    = false;
    this.shockwaveRadius    = 0;
    this.shockwaveMaxRadius = 120;
    this.shockwaveAlpha     = 0;

    // Passive state
    this.passiveState = {
      // Taunt (tank)
      tauntActive:    false,
      tauntTimer:     0,
      tauntCooldown:  0,
      tauntRadius:    300,
      // Fortress (backwards compat display)
      fortressActive: false,
      // Afterimage (speedster)
      afterimages:          [],
      afterimageSpawnTimer: 0,
      // Rage (glasscannon)
      rageStacks:      0,
      // Overclock (engineer)
      overclockTimer:       30000,
      overclockActiveTimer: 0,
      overclockActive:      false,
      overclockBaseMult:    base.cooldownMult !== undefined ? base.cooldownMult : 1,
      // Drain lifesteal (vampire)
      lifestealAccum: 0,
    };
  }

  hasWeapon(id) {
    return this.weapons.some(w => w.id === id);
  }

  takeDamage(amount) {
    if (this.iframeTimer > 0 || this.dashActive) return 0;
    // Dodge chance (Speedster)
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) return 0;
    const reduced = Math.max(1, amount - this.armor);
    this.hp -= reduced;
    this.iframeTimer = PLAYER.IFRAMES;
    this.flashTimer  = 300;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
    return reduced;
  }

  heal(amount) {
    if (this.noHeal && amount > 0) return;
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  // Bypasses noHeal (for vampire drain, pickups)
  vampireHeal(amount) {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  // Called when damage is DEALT by this player's weapons (for lifesteal)
  onDamageDealt(amount) {
    if (this.charData?.passive?.id !== 'drain') return;
    this.passiveState.lifestealAccum += amount * 0.015; // 1.5% lifesteal
    if (this.passiveState.lifestealAccum >= 1) {
      const healed = Math.floor(this.passiveState.lifestealAccum);
      this.vampireHeal(healed);
      this.passiveState.lifestealAccum -= healed;
    }
  }

  // Called when an enemy is killed
  onKill(isCritKill = false) {
    if (!this.charData) return;
    const passiveId = this.charData.passive?.id;
    if (passiveId === 'rage') {
      this.passiveState.rageStacks++;
      this.damageMult += 0.01; // +1% per stack (was 0.5%)
    } else if (passiveId === 'drain') {
      this.vampireHeal(isCritKill ? 10 : 4); // improved from 5/2
    } else if (passiveId === 'luck') {
      // 3% chance to spawn a heart (handled in Game.js via return value)
    }
  }

  // Returns true if lucky passive should spawn a heart on this kill
  luckyHeartRoll() {
    return this.charData?.passive?.id === 'luck' && Math.random() < 0.03;
  }

  update(dt, input) {
    const { dx, dy } = input.getMovement();
    this.moving = dx !== 0 || dy !== 0;

    // Dash trigger
    if (!this.dashActive && this.dashCooldownTimer <= 0 && input.consumeJustPressedDash()) {
      const dirX = this.moving ? dx : this.facing.dx;
      const dirY = this.moving ? dy : this.facing.dy;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      this.dashDir = { dx: dirX / len, dy: dirY / len };
      this.dashActive       = true;
      this.dashTimer        = this.dashDuration;
      this.dashCooldownTimer= this.dashCooldown;
      this.iframeTimer      = this.dashDuration + 80;
    }
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

    let moveX = dx, moveY = dy, speedMult = 1;

    if (this.dashActive) {
      this.dashTimer -= dt;
      speedMult = 4;
      moveX = this.dashDir.dx;
      moveY = this.dashDir.dy;
      this.dashTrail.unshift({ x: this.x, y: this.y, alpha: 0.8 });
      if (this.dashTrail.length > 14) this.dashTrail.pop();
      if (this.dashTimer <= 0) {
        this.dashActive = false;
        this.dashTimer  = 0;
      }
    } else {
      if (this.moving) {
        this.facing.dx = dx;
        this.facing.dy = dy;
        this.trailPoints.unshift({ x: this.x, y: this.y, alpha: 0.5 });
        if (this.trailPoints.length > 8) this.trailPoints.pop();
      }
    }

    this.x = clamp(this.x + moveX * this.speed * speedMult, this.size, WORLD.WIDTH  - this.size);
    this.y = clamp(this.y + moveY * this.speed * speedMult, this.size, WORLD.HEIGHT - this.size);

    this.trailPoints = this.trailPoints.map(p => ({ ...p, alpha: p.alpha - 0.07 })).filter(p => p.alpha > 0);
    this.dashTrail   = this.dashTrail  .map(p => ({ ...p, alpha: p.alpha - 0.06 })).filter(p => p.alpha > 0);

    if (this.iframeTimer > 0) this.iframeTimer -= dt;
    if (this.flashTimer  > 0) this.flashTimer  -= dt;

    if (!this.noHeal && this.regen > 0) {
      this.regenAccum += this.regen * (dt / 1000);
      if (this.regenAccum >= 1) {
        this.hp = clamp(this.hp + Math.floor(this.regenAccum), 0, this.maxHp);
        this.regenAccum -= Math.floor(this.regenAccum);
      }
    }

    if (this.scaleTimer > 0) {
      this.scaleTimer -= dt;
      const t = 1 - this.scaleTimer / 300;
      this.scaleEffect = t < 0.5 ? 1 + t : 1 + (1 - t);
    } else {
      this.scaleEffect = 1;
    }

    if (this.shockwaveActive) {
      this.shockwaveRadius += dt * 0.5;
      this.shockwaveAlpha  -= dt * 0.003;
      if (this.shockwaveRadius >= this.shockwaveMaxRadius || this.shockwaveAlpha <= 0) {
        this.shockwaveActive = false;
      }
    }

    this.weapons.forEach(w => w.update(dt, this));
    this._updatePassive(dt);
  }

  _updatePassive(dt) {
    if (!this.charData) return;
    const passiveId = this.charData.passive?.id;
    const ps = this.passiveState;

    if (passiveId === 'taunt') {
      if (ps.tauntCooldown > 0) ps.tauntCooldown -= dt;
      if (ps.tauntActive) {
        ps.tauntTimer -= dt;
        if (ps.tauntTimer <= 0) {
          ps.tauntActive = false;
          // fortressActive used for display compat
          ps.fortressActive = false;
        }
      } else if (ps.tauntCooldown <= 0) {
        ps.tauntActive    = true;
        ps.tauntTimer     = 5000;
        ps.tauntCooldown  = 8000;
        ps.fortressActive = true; // reuse for HUD display
      }
    }

    if (passiveId === 'afterimage') {
      if (this.moving) {
        ps.afterimageSpawnTimer -= dt;
        if (ps.afterimageSpawnTimer <= 0) {
          ps.afterimageSpawnTimer = 250; // was 500 — faster afterimages
          ps.afterimages.push({ x: this.x, y: this.y, timer: 800, maxTimer: 800 });
        }
      }
      ps.afterimages = ps.afterimages.map(a => ({ ...a, timer: a.timer - dt })).filter(a => a.timer > 0);
    }

    if (passiveId === 'overclock') {
      if (ps.overclockActive) {
        ps.overclockActiveTimer -= dt;
        if (ps.overclockActiveTimer <= 0) {
          ps.overclockActive = false;
          this.cooldownMult  = ps.overclockBaseMult;
        }
      } else {
        ps.overclockTimer -= dt;
        if (ps.overclockTimer <= 0) {
          ps.overclockTimer       = 30000; // was 45s, now 30s
          ps.overclockActive      = true;
          ps.overclockActiveTimer = 7000;  // was 5s, now 7s
          ps.overclockBaseMult    = this.cooldownMult;
          this.cooldownMult       = this.cooldownMult / 3; // 3x speed (was 2x)
        }
      }
    }
  }

  triggerLevelUpEffect() {
    this.scaleTimer      = 300;
    this.shockwaveActive = true;
    this.shockwaveRadius = 10;
    this.shockwaveAlpha  = 0.9;
  }

  draw(ctx) {
    const isFlashing = this.flashTimer > 0 && Math.floor(this.flashTimer / 60) % 2 === 0;
    const charId = this.charData?.id || 'default';
    const color  = this.charData?.color || '#4488ff';
    const half   = this.size / 2;

    // Dash afterimage trail
    this.dashTrail.forEach((p, i) => {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.55;
      ctx.fillStyle = '#88ccff';
      const s = Math.max(3, (this.size * 0.7) * (1 - i / this.dashTrail.length));
      ctx.beginPath();
      ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Normal movement trail
    if (!this.dashActive) {
      this.trailPoints.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.4;
        ctx.fillStyle = color;
        const s = (this.size / 2) * (1 - i / this.trailPoints.length);
        ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
        ctx.restore();
      });
    }

    // XP collection radius
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#88aaff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.xpRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Afterimage shadows (Zynn)
    this.passiveState.afterimages.forEach(a => {
      ctx.save();
      ctx.globalAlpha = (a.timer / a.maxTimer) * 0.4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Taunt aura (Gorik) — large pulsing orange ring
    if (this.passiveState.tauntActive) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(Date.now() * 0.008) * 0.1;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth   = 4;
      ctx.shadowBlur  = 16;
      ctx.shadowColor = '#ff6600';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.passiveState.tauntRadius / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ff6600';
      ctx.fill();
      ctx.restore();
    }

    // Overclock aura (Cogsworth)
    if (this.passiveState.overclockActive) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.2;
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = '#44aaff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Level-up shockwave
    if (this.shockwaveActive) {
      ctx.save();
      ctx.globalAlpha = this.shockwaveAlpha * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = '#88ffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Body
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scaleEffect, this.scaleEffect);
    this._drawBody(ctx, isFlashing, color, charId);
    ctx.restore();

    // Player index badge in co-op
    if (this.playerIndex > 0) {
      ctx.save();
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('P2', this.x, this.y - half - 14);
      ctx.restore();
    }

    // HP bar
    const barW = 32, barH = 4;
    const hpColor = this.hp / this.maxHp < 0.3 ? '#ff4444' : '#44ff44';
    ctx.fillStyle = '#440000';
    ctx.fillRect(this.x - barW / 2, this.y - half - 10, barW, barH);
    ctx.fillStyle = hpColor;
    ctx.fillRect(this.x - barW / 2, this.y - half - 10, barW * (this.hp / this.maxHp), barH);
  }

  _drawBody(ctx, isFlashing, color, charId) {
    const bodyColor = isFlashing ? '#ffffff' : color;
    const half = this.size / 2;

    if (charId === 'speedster') {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half, 0);
      ctx.lineTo(0, half);
      ctx.lineTo(-half, 0);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -half * 0.8);
        ctx.lineTo(half * 0.4, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
      }

    } else if (charId === 'glasscannon') {
      const angle = Math.atan2(this.facing.dy, this.facing.dx);
      ctx.rotate(angle);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(half, 0);
      ctx.lineTo(-half, -half * 0.7);
      ctx.lineTo(-half, half * 0.7);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) {
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(half * 0.2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (charId === 'vampire') {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, half, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) {
        ctx.fillStyle = '#ff2222';
        ctx.beginPath(); ctx.arc(-half * 0.35, -half * 0.15, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( half * 0.35, -half * 0.15, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        [[-half * 0.2, half * 0.2], [half * 0.2, half * 0.2]].forEach(([fx, fy]) => {
          ctx.beginPath();
          ctx.moveTo(fx - 3, fy);
          ctx.lineTo(fx,     fy + 6);
          ctx.lineTo(fx + 3, fy);
          ctx.closePath();
          ctx.fill();
        });
      }

    } else if (charId === 'engineer') {
      ctx.fillStyle = bodyColor;
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? half : half * 0.72;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isFlashing ? '#ffffff' : '#444';
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.38, 0, Math.PI * 2);
      ctx.fill();

    } else if (charId === 'lucky') {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, half, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) {
        const lr = half * 0.28, lo = half * 0.2;
        ctx.fillStyle = '#115511';
        [[0, -lo], [lo, 0], [0, lo], [-lo, 0]].forEach(([lx, ly]) => {
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fill();
        });
      }

    } else if (charId === 'tank') {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-half, -half, this.size, this.size);
      if (!isFlashing) {
        ctx.strokeStyle = '#6b4c20';
        ctx.lineWidth = 2;
        ctx.strokeRect(-half + 3, -half + 3, this.size - 6, this.size - 6);
        ctx.beginPath();
        ctx.moveTo(-half, 0); ctx.lineTo(half, 0);
        ctx.moveTo(0, -half); ctx.lineTo(0, half);
        ctx.stroke();
        // Shield icon
        ctx.fillStyle = '#ffaa44';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

    } else {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-half, -half, this.size, this.size);
      const fx = this.facing.dx, fy = this.facing.dy;
      const len = Math.sqrt(fx * fx + fy * fy) || 1;
      const nx = fx / len, ny = fy / len;
      ctx.fillStyle = isFlashing ? '#aaaaff' : '#88ccff';
      ctx.beginPath();
      ctx.moveTo(nx * half, ny * half);
      ctx.lineTo(nx * (half + 6) - ny * 4, ny * (half + 6) + nx * 4);
      ctx.lineTo(nx * (half + 6) + ny * 4, ny * (half + 6) - nx * 4);
      ctx.closePath();
      ctx.fill();
    }
  }
}
