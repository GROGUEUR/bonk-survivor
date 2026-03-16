/**
 * ObjectiveSystem — manages in-run objectives.
 *
 * Objective types:
 *   boss_kill_timed  — kill the current boss before timeLimit expires
 *   kill_streak      — kill N enemies without taking damage
 *   survive          — survive until elapsed >= target seconds
 *
 * On failure of a boss_kill_timed objective, game over is triggered
 * (the Game reads this.hasFatalFailure()).
 */
export class ObjectiveSystem {
  constructor() {
    this.active    = null;   // current active objective
    this.completed = [];
    this.failed    = [];
    this._currentElapsed = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────

  startBossObjective(bossName, elapsed) {
    // Only one active objective at a time
    if (this.active) return;
    this.active = {
      id:           'boss_timer',
      type:         'boss_kill_timed',
      title:        `Tuer ${bossName}`,
      desc:         'en 90 secondes',
      timeLimit:    90,
      startElapsed: elapsed,
      fatal:        true,    // game over on failure
      done:         false,
      failed:       false,
    };
  }

  startKillStreak(target, elapsed) {
    if (this.active) return;
    this.active = {
      id:           'kill_streak',
      type:         'kill_streak',
      title:        `${target} kills sans dégâts`,
      desc:         `Récompense : amélioration rare`,
      timeLimit:    null,
      target,
      progress:     0,
      startElapsed: elapsed,
      fatal:        false,
      done:         false,
      failed:       false,
    };
  }

  onBossKill() {
    if (this.active?.type === 'boss_kill_timed' && !this.active.done) {
      this.active.done = true;
      this.completed.push(this.active);
      const obj = this.active;
      this.active = null;
      return { reward: 'extra_upgrade', rarity: 'rare', obj };
    }
    return null;
  }

  onKill() {
    if (this.active?.type === 'kill_streak' && !this.active.done) {
      this.active.progress++;
      if (this.active.progress >= this.active.target) {
        this.active.done = true;
        this.completed.push(this.active);
        const obj = this.active;
        this.active = null;
        return { reward: 'extra_upgrade', rarity: 'epic', obj };
      }
    }
    return null;
  }

  onPlayerHit() {
    if (this.active?.type === 'kill_streak') {
      this.active.failed = true;
      this.failed.push(this.active);
      this.active = null;
    }
  }

  update(elapsed) {
    this._currentElapsed = elapsed;
    if (!this.active || this.active.done || this.active.failed) return null;
    if (this.active.timeLimit) {
      const remaining = this.active.timeLimit - (elapsed - this.active.startElapsed);
      if (remaining <= 0) {
        this.active.failed = true;
        this.failed.push(this.active);
        const obj = this.active;
        this.active = null;
        return { failed: obj };
      }
    }
    return null;
  }

  hasFatalFailure() {
    return this.failed.some(o => o.fatal);
  }

  // Returns remaining seconds for active timed obj, or null
  getTimeRemaining() {
    if (!this.active?.timeLimit) return null;
    return Math.max(0, this.active.timeLimit - (this._currentElapsed - this.active.startElapsed));
  }

  drawGoldRush(ctx, screenW, screenH, timer) {
    const boxW = 180, boxH = 40;
    const x = screenW / 2 - boxW / 2;
    const y = 60;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(60,40,0,0.85)';
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, boxW, boxH, 6) : ctx.rect(x, y, boxW, boxH);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#ffcc44';
    ctx.textAlign = 'center';
    ctx.fillText(`⬡ GOLD RUSH! XP x3  ${Math.ceil(timer)}s`, screenW / 2, y + 26);
    ctx.restore();
  }

  draw(ctx, screenW, screenH) {
    if (!this.active) return;
    const obj = this.active;
    const remaining = this.getTimeRemaining();

    // Position: bottom-right, above the minimap+weapon bar area
    const boxW = 210, boxH = 58;
    const x = screenW - boxW - 16;
    const y = screenH - boxH - 170; // above minimap (150px) + weapon bar (~80px)

    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle   = 'rgba(0,0,20,0.7)';
    ctx.strokeStyle = remaining !== null && remaining < 15 ? '#ff2222' : '#334466';
    ctx.lineWidth   = 1;
    const r = 4, bw = boxW, bh = boxH;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + bw - r, y);
    ctx.arcTo(x + bw, y, x + bw, y + r, r);
    ctx.lineTo(x + bw, y + bh - r);
    ctx.arcTo(x + bw, y + bh, x + bw - r, y + bh, r);
    ctx.lineTo(x + r, y + bh);
    ctx.arcTo(x, y + bh, x, y + bh - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.font        = 'bold 11px monospace';
    ctx.fillStyle   = '#ffdd44';
    ctx.textAlign   = 'left';
    ctx.fillText('OBJECTIF', x + 8, y + 16);

    ctx.font      = '11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(obj.title, x + 8, y + 30);

    if (remaining !== null) {
      const pct = remaining / obj.timeLimit;
      const barW = boxW - 26;
      ctx.fillStyle = '#222244';
      ctx.fillRect(x + 8, y + 38, barW, 8);
      const barColor = remaining < 15 ? '#ff2222' : remaining < 30 ? '#ffaa00' : '#44ff88';
      ctx.fillStyle = barColor;
      ctx.fillRect(x + 8, y + 38, barW * pct, 8);
      ctx.fillStyle = remaining < 15 ? '#ff4444' : '#aaaaaa';
      ctx.font      = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(remaining)}s`, x + boxW - 8, y + 46);
    } else if (obj.type === 'kill_streak') {
      const pct = obj.progress / obj.target;
      const barW = boxW - 26;
      ctx.fillStyle = '#222244';
      ctx.fillRect(x + 8, y + 38, barW, 8);
      ctx.fillStyle = '#aa44ff';
      ctx.fillRect(x + 8, y + 38, barW * pct, 8);
      ctx.fillStyle = '#aaaaaa';
      ctx.font      = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${obj.progress}/${obj.target}`, x + boxW - 8, y + 46);
    }

    ctx.restore();
  }
}
