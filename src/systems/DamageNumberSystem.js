export class DamageNumberSystem {
  constructor() {
    this.numbers = [];
  }

  add(x, y, value, isCrit = false) {
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      value,
      isCrit,
      alpha: 1,
      vy: -1.5,
      timer: 0,
    });
  }

  addText(x, y, text, color = '#44ff88') {
    this.numbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      value: text,
      isCrit: false,
      alpha: 1,
      vy: -1,
      timer: 0,
      isText: true,
      color,
    });
  }

  update(dt) {
    this.numbers = this.numbers.filter(n => {
      n.y += n.vy;
      n.timer += dt;
      n.alpha = Math.max(0, 1 - n.timer / 800);
      return n.alpha > 0;
    });
  }

  draw(ctx, camera) {
    this.numbers.forEach(n => {
      ctx.save();
      ctx.globalAlpha = n.alpha;
      if (n.isText) {
        ctx.fillStyle = n.color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.value, n.x, n.y);
      } else if (n.isCrit) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ff8800';
        ctx.fillText(n.value, n.x, n.y);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.value, n.x, n.y);
      }
      ctx.restore();
    });
  }
}
