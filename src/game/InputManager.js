// P1 key map: WASD / ZQSD + Space dash + Escape pause
export const P1_KEY_MAP = {
  up:    ['KeyW', 'KeyZ', 'ArrowUp'],
  down:  ['KeyS', 'ArrowDown'],
  left:  ['KeyA', 'KeyQ', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash:  ['Space'],
  pause: ['Escape'],
};

// P2 key map: Numpad / IJKL + Enter dash
export const P2_KEY_MAP = {
  up:    ['KeyI', 'Numpad8'],
  down:  ['KeyK', 'Numpad2', 'Numpad5'],
  left:  ['KeyJ', 'Numpad4'],
  right: ['KeyL', 'Numpad6'],
  dash:  ['Enter', 'NumpadEnter'],
  pause: [],
};

export class InputManager {
  constructor(keyMap = null) {
    this.keys = {};
    this.justPressed = new Set();
    this._keyMap = keyMap || P1_KEY_MAP;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  _onKeyDown(e) {
    if (!this.keys[e.code]) {
      this.justPressed.add(e.code);
    }
    this.keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  // Consume a specific key code (used for Escape, etc.)
  consumeJustPressed(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  // Consume any of the given key codes (used for mapped actions)
  consumeJustPressedAny(codes) {
    for (const code of codes) {
      if (this.justPressed.has(code)) {
        this.justPressed.delete(code);
        return true;
      }
    }
    return false;
  }

  // Shortcut: consume dash key press
  consumeJustPressedDash() {
    return this.consumeJustPressedAny(this._keyMap.dash);
  }

  // Shortcut: consume pause key press
  consumeJustPressedPause() {
    return this.consumeJustPressedAny(this._keyMap.pause || []);
  }

  getMovement() {
    let dx = 0, dy = 0;
    if (this._isDown(this._keyMap.left))  dx -= 1;
    if (this._isDown(this._keyMap.right)) dx += 1;
    if (this._isDown(this._keyMap.up))    dy -= 1;
    if (this._isDown(this._keyMap.down))  dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }
    return { dx, dy };
  }

  _isDown(keys) {
    return keys.some(k => this.keys[k]);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
