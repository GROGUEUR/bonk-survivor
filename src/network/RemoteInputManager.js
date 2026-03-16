/**
 * RemoteInputManager — drop-in replacement for InputManager for network players.
 * The host receives input packets from guests and feeds them here.
 * Exposes the same interface as InputManager so Player.update() works unchanged.
 */
export class RemoteInputManager {
  constructor() {
    this._dx           = 0;
    this._dy           = 0;
    this._dashPending  = false;
  }

  /** Called by Game.js when an input packet arrives from this guest */
  applyInput({ dx = 0, dy = 0, dash = false } = {}) {
    this._dx = dx;
    this._dy = dy;
    if (dash) this._dashPending = true; // latch until consumed
  }

  getMovement()             { return { dx: this._dx, dy: this._dy }; }

  consumeJustPressedDash()  {
    const v = this._dashPending;
    this._dashPending = false;
    return v;
  }

  consumeJustPressedPause() { return false; }
  consumeJustPressed()      { return false; }
  consumeJustPressedAny()   { return false; }

  destroy() {}
}
