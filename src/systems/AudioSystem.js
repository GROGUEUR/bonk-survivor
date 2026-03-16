export class AudioSystem {
  constructor() {
    this.muted = false;
    this.ctx = null;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _playTone(frequency, type, duration, volume = 0.3, startFreq = null, endFreq = null) {
    if (this.muted || !this.ctx) return;
    this._resume();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      const now = this.ctx.currentTime;
      if (startFreq && endFreq) {
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration / 1000);
      } else {
        osc.frequency.setValueAtTime(frequency, now);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
      osc.start(now);
      osc.stop(now + duration / 1000);
    } catch (e) {}
  }

  playHit() {
    this._playTone(800, 'square', 60, 0.08);
  }

  playPlayerHit() {
    this._playTone(150, 'sawtooth', 150, 0.2);
  }

  playLightning() {
    this._playTone(0, 'sawtooth', 120, 0.15, 600, 200);
  }

  playExplosion() {
    this._playTone(0, 'sawtooth', 300, 0.25, 200, 40);
  }

  playLevelUp() {
    if (this.muted || !this.ctx) return;
    this._resume();
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 'triangle', 200, 0.2), i * 80);
    });
  }

  playCollect() {
    this._playTone(1200, 'sine', 80, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
