import { clamp } from './utils.js';

// Unified input: keyboard + pointer-lock mouse + touch (drive pad / foot stick).
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.locked = false;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.mode = 'drive'; // drive | foot
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.sensitivity = 1; // mouse look multiplier (settings)
    this.drive = { left: false, right: false, gas: false, brk: false };
    this.actHeld = false;
    this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookT = { active: false, id: -1, lx: 0, ly: 0 };
    this.onLockChange = null;
    this.onAux = null;
    this.joyBase = document.getElementById('joy-base');
    this.joyKnob = document.getElementById('joy-knob');
    if (this.isTouch) document.body.classList.add('touch');
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
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
      this.lookPitch = clamp(this.lookPitch - e.movementY * 0.0022 * this.sensitivity, -1.2, 1.0);
    });

    const hold = (id, obj, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); obj[key] = true; };
      const off = (e) => { if (e) e.preventDefault(); obj[key] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', () => { obj[key] = false; });
    };
    hold('t-left', this.drive, 'left');
    hold('t-right', this.drive, 'right');
    hold('t-gas', this.drive, 'gas');
    hold('t-brk', this.drive, 'brk');
    hold('t-act', this, 'actHeld');

    const tap = (id, name) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onAux) this.onAux(name);
      }, { passive: false });
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (this.onAux) this.onAux(name);
      });
    };
    tap('t-light', 'light');
    tap('t-radio', 'radio');

    const cv = this.canvas;
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.mode === 'foot' && t.clientX < window.innerWidth * 0.45 && !this.joy.active) {
          this.joy.active = true;
          this.joy.id = t.identifier;
          this.joy.ox = t.clientX;
          this.joy.oy = t.clientY;
          this.joy.x = 0;
          this.joy.y = 0;
          this.joyBase.style.left = t.clientX + 'px';
          this.joyBase.style.top = t.clientY + 'px';
          this.joyBase.classList.remove('hidden');
          this.joyKnob.style.transform = 'translate(-50%,-50%)';
        } else if (!this.lookT.active) {
          this.lookT.active = true;
          this.lookT.id = t.identifier;
          this.lookT.lx = t.clientX;
          this.lookT.ly = t.clientY;
        }
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          let dx = (t.clientX - this.joy.ox) / 52;
          let dy = (t.clientY - this.joy.oy) / 52;
          const m = Math.hypot(dx, dy);
          if (m > 1) {
            dx /= m;
            dy /= m;
          }
          this.joy.x = Math.abs(dx) < 0.14 ? 0 : dx;
          this.joy.y = Math.abs(dy) < 0.14 ? 0 : dy;
          this.joyKnob.style.transform =
            `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
        } else if (this.lookT.active && t.identifier === this.lookT.id) {
          this.lookYaw -= (t.clientX - this.lookT.lx) * 0.0052;
          this.lookPitch = clamp(this.lookPitch - (t.clientY - this.lookT.ly) * 0.0052, -1.2, 1.0);
          this.lookT.lx = t.clientX;
          this.lookT.ly = t.clientY;
        }
      }
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          this.joy.active = false;
          this.joy.x = 0;
          this.joy.y = 0;
          this.joyBase.classList.add('hidden');
        }
        if (this.lookT.active && t.identifier === this.lookT.id) {
          this.lookT.active = false;
        }
      }
    };
    cv.addEventListener('touchend', endTouch);
    cv.addEventListener('touchcancel', endTouch);
  }

  requestLock() {
    if (this.isTouch || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  lateUpdate() {
    this.justPressed.clear();
  }
}
