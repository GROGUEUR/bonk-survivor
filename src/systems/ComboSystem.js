export class ComboSystem {
  constructor() {
    this.count = 0;
    this.maxCount = 0;
    this.resetTimer = 0;
    this.resetDelay = 2000; // 2s without kill resets combo
    this.displayTimer = 0;  // how long to show the combo popup
  }

  onKill() {
    this.count++;
    if (this.count > this.maxCount) this.maxCount = this.count;
    this.resetTimer = this.resetDelay;
    this.displayTimer = 1200;
  }

  update(dt) {
    if (this.resetTimer > 0) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.count = 0;
    }
    if (this.displayTimer > 0) this.displayTimer -= dt;
  }

  getXpMult() {
    if (this.count >= 20) return 3;
    if (this.count >= 10) return 2;
    if (this.count >= 5)  return 1.5;
    return 1;
  }

  draw(ctx, screenW, screenH) {
    if (this.count < 2 || this.displayTimer <= 0) return;
    const alpha = Math.min(1, this.displayTimer / 400);
    const scale = this.count >= 10 ? 1.4 : this.count >= 5 ? 1.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(28 * scale)}px monospace`;
    const label = this.count >= 20 ? '🔥 x' + this.count : 'x' + this.count;
    const color = this.count >= 20 ? '#ff4400' : this.count >= 10 ? '#ffaa00' : this.count >= 5 ? '#ffdd00' : '#ffffff';
    ctx.fillStyle = color;
    ctx.shadowBlur = this.count >= 5 ? 12 : 4;
    ctx.shadowColor = color;
    ctx.fillText(label + ' COMBO', screenW / 2, screenH / 2 - 80);
    const mult = this.getXpMult();
    if (mult > 1) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#88ffaa';
      ctx.shadowBlur = 0;
      ctx.fillText(`XP ×${mult}`, screenW / 2, screenH / 2 - 55);
    }
    ctx.restore();
  }
}
