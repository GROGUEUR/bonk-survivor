export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnDeath(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        decay: 0.025 + Math.random() * 0.02,
        gravity: 0.05,
      });
    }
  }

  spawnExplosion(x, y, radius, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 2 + Math.random() * (radius / 30);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        color: Math.random() > 0.5 ? '#ff8800' : '#ffdd00',
        alpha: 1,
        decay: 0.015 + Math.random() * 0.015,
        gravity: 0,
      });
    }
  }

  spawnLevelUp(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 4 + Math.random() * 4,
        color: Math.random() > 0.5 ? '#ffdd00' : '#88ffaa',
        alpha: 1,
        decay: 0.012,
        gravity: -0.02,
      });
    }
  }

  update(dt) {
    const factor = dt / 16.67;
    this.particles = this.particles.filter(p => {
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      p.vy += p.gravity * factor;
      p.alpha -= p.decay * factor;
      p.size *= 0.995;
      return p.alpha > 0 && p.size > 0.5;
    });
  }

  draw(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    });
  }
}
