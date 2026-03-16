export class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'magnet' | 'heart' | 'chest'
    this.alive = true;
    this.pulse = 0;
    this.pulseDir = 1;
    this.collectRadius = 26;
  }

  update(dt) {
    this.pulse += this.pulseDir * dt * 0.004;
    if (this.pulse > 1) this.pulseDir = -1;
    if (this.pulse < 0) this.pulseDir = 1;
  }

  draw(ctx) {
    const scale = 0.85 + this.pulse * 0.3;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    if (this.type === 'heart')  this._drawHeart(ctx);
    if (this.type === 'magnet') this._drawMagnet(ctx);
    if (this.type === 'chest')  this._drawChest(ctx);
    ctx.restore();
  }

  _drawHeart(ctx) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff2244';
    ctx.fillStyle = '#ff4466';
    const s = 9;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.4);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.4, -s * 1.2, -s * 1.4, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 1.2, -s * 1.4, s * 1.2, -s * 0.4, 0, s * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  _drawMagnet(ctx) {
    const r = 9;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#4466ff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Arc
    ctx.strokeStyle = '#aabbff';
    ctx.beginPath();
    ctx.arc(0, 2, r, Math.PI, 0, false);
    ctx.stroke();
    // Left leg (red)
    ctx.strokeStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(-r, 2);
    ctx.lineTo(-r, 10);
    ctx.stroke();
    // Right leg (blue)
    ctx.strokeStyle = '#4488ff';
    ctx.beginPath();
    ctx.moveTo(r, 2);
    ctx.lineTo(r, 10);
    ctx.stroke();
  }

  _drawChest(ctx) {
    const w = 20, h = 14;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffaa00';
    ctx.fillStyle = '#cc8800';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#885500';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Lid divider
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();
    // Lock
    ctx.fillStyle = '#ffdd00';
    ctx.fillRect(-3, -3, 6, 5);
    ctx.strokeStyle = '#aa8800';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -3, 6, 5);
  }
}
