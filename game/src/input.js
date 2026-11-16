// Keyboard and mouse read once per fixed step: nothing else in the game touches a DOM event.

const SWALLOW = new Set(['Space', 'Tab', 'KeyB', 'ControlLeft']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.tapped = new Set();
    this.dx = 0;
    this.dy = 0;
    this.firing = false;
    this.aiming = false;
    this.locked = false;
    this.bind();
  }

  bind() {
    const canvas = this.canvas;
    addEventListener('keydown', (event) => {
      if (SWALLOW.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.code);
      this.tapped.add(event.code);
    });
    addEventListener('keyup', (event) => this.keys.delete(event.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.firing = false;
      this.aiming = false;
    });
    addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.dx += event.movementX || 0;
      this.dy += event.movementY || 0;
    });
    addEventListener('mousedown', (event) => {
      if (event.button === 0) this.firing = true;
      if (event.button === 2) this.aiming = true;
    });
    addEventListener('mouseup', (event) => {
      if (event.button === 0) this.firing = false;
      if (event.button === 2) this.aiming = false;
    });
    addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const request = this.canvas.requestPointerLock();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch {
      // A browser without pointer lock still plays: the arrow keys steer the view.
    }
  }

  held(code) {
    return this.keys.has(code);
  }

  consume(code) {
    if (!this.tapped.has(code)) return false;
    this.tapped.delete(code);
    return true;
  }

  takeLook() {
    this.lookX = this.dx;
    this.lookY = this.dy;
    this.dx = 0;
    this.dy = 0;
  }

  endStep() {
    this.tapped.clear();
  }
}
