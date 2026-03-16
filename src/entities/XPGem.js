import { drawDiamond } from '../utils/drawing.js';

export class XPGem {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.size = 6;
    this.alive = true;
    this.pulse = 0;
    this.pulseDir = 1;
    this.attracted = false; // magnet pickup sets this
    // Color based on value
    if (value >= 15) this.color = '#00ffaa';
    else if (value >= 10) this.color = '#44aaff';
    else this.color = '#88ff44';
  }

  update(dt) {
    this.pulse += this.pulseDir * dt * 0.004;
    if (this.pulse >= 1) this.pulseDir = -1;
    if (this.pulse <= 0) this.pulseDir = 1;
  }

  draw(ctx) {
    const scale = 0.8 + this.pulse * 0.4;
    const s = this.size * scale;
    drawDiamond(ctx, this.x, this.y, s, this.color, 0.9);
    // Glow
    drawDiamond(ctx, this.x, this.y, s * 1.4, this.color, 0.2);
  }
}
