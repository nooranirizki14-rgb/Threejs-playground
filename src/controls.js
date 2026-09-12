import { clamp } from './utils.js';

// Keyboard + pointer-lock mouse look + touch (left stick walks, right drag looks).
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.locked = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.sensitivity = 1;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.onLockChange = null;
    if (this.isTouch) document.body.classList.add('touch');

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.justPressed.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookYaw -= e.movementX * 0.0022 * this.sensitivity;
      this.lookPitch = clamp(this.lookPitch - e.movementY * 0.0022 * this.sensitivity, -1.25, 1.25);
    });

    // touch: left half = move stick, right half = look drag
    this.lookTouch = { id: -1, lx: 0, ly: 0 };
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2 && !this.stick.active) {
          this.stick.active = true;
          this.stick.id = t.identifier;
          this.stick.ox = t.clientX;
          this.stick.oy = t.clientY;
          this.stick.x = 0;
          this.stick.y = 0;
        } else if (this.lookTouch.id === -1) {
          this.lookTouch.id = t.identifier;
          this.lookTouch.lx = t.clientX;
          this.lookTouch.ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          this.stick.x = clamp((t.clientX - this.stick.ox) / 60, -1, 1);
          this.stick.y = clamp((t.clientY - this.stick.oy) / 60, -1, 1);
        } else if (t.identifier === this.lookTouch.id) {
          this.lookYaw -= (t.clientX - this.lookTouch.lx) * 0.0045;
          this.lookPitch = clamp(this.lookPitch - (t.clientY - this.lookTouch.ly) * 0.0045, -1.25, 1.25);
          this.lookTouch.lx = t.clientX;
          this.lookTouch.ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          this.stick.active = false;
          this.stick.id = -1;
          this.stick.x = 0;
          this.stick.y = 0;
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  requestLock() {
    if (this.isTouch || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  moveInput() {
    let f = 0;
    let s = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;
    if (this.stick.active) {
      f += -this.stick.y;
      s += this.stick.x;
    }
    return { f: clamp(f, -1, 1), s: clamp(s, -1, 1) };
  }

  lateUpdate() {
    this.justPressed.clear();
  }
}
