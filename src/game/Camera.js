import { lerp } from '../utils/math.js';
import { CAMERA, WORLD } from '../data/constants.js';

export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  follow(targetX, targetY) {
    this.targetX = targetX - this.width / 2;
    this.targetY = targetY - this.height / 2;
    // Clamp to world bounds
    this.targetX = Math.max(0, Math.min(WORLD.WIDTH - this.width, this.targetX));
    this.targetY = Math.max(0, Math.min(WORLD.HEIGHT - this.height, this.targetY));
  }

  shake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  update(dt) {
    this.x = lerp(this.x, this.targetX, CAMERA.LERP);
    this.y = lerp(this.y, this.targetY, CAMERA.LERP);

    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  apply(ctx) {
    ctx.translate(
      -Math.round(this.x) + this.shakeX,
      -Math.round(this.y) + this.shakeY
    );
  }

  // Convert screen coords to world coords
  screenToWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }

  // Convert world coords to screen coords
  worldToScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}
