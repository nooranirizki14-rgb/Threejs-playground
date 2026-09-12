// First-person walk controls: pointer-lock mouse + WASD on desktop,
// virtual joystick + drag-look on touch.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Controls {
  constructor(dom) {
    this.dom = dom; // renderer canvas
    this.yaw = 0;   // facing -z
    this.pitch = -0.02;
    this.keys = new Set();
    this.locked = false;
    this.started = false;
    this.autoWalk = true;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = { active: false, id: -1, lx: 0, ly: 0 };
    this.lastInputAt = performance.now();
    this.onLockChange = null;
    this.onAutoWalkChange = null;
    this.joyBase = document.getElementById('joy-base');
    this.joyKnob = document.getElementById('joy-knob');
    if (this.isTouch) document.body.classList.add('touch');
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);
      this.poke();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch = clamp(this.pitch - e.movementY * 0.0023, -1.25, 1.25);
      this.poke();
    });

    // touch: left half = joystick, right half = look
    const el = this.dom;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.poke();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && !this.joy.active) {
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
        } else if (!this.look.active) {
          this.look.active = true;
          this.look.id = t.identifier;
          this.look.lx = t.clientX;
          this.look.ly = t.clientY;
        }
      }
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.poke();
      for (const t of e.changedTouches) {
        if (this.joy.active && t.identifier === this.joy.id) {
          let dx = (t.clientX - this.joy.ox) / 52;
          let dy = (t.clientY - this.joy.oy) / 52;
          const m = Math.hypot(dx, dy);
          if (m > 1) { dx /= m; dy /= m; }
          // deadzone
          this.joy.x = Math.abs(dx) < 0.14 ? 0 : dx;
          this.joy.y = Math.abs(dy) < 0.14 ? 0 : dy;
          this.joyKnob.style.transform =
            `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
        } else if (this.look.active && t.identifier === this.look.id) {
          this.yaw -= (t.clientX - this.look.lx) * 0.0052;
          this.pitch = clamp(this.pitch - (t.clientY - this.look.ly) * 0.0052, -1.25, 1.25);
          this.look.lx = t.clientX;
          this.look.ly = t.clientY;
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
        if (this.look.active && t.identifier === this.look.id) {
          this.look.active = false;
        }
      }
    };
    el.addEventListener('touchend', endTouch);
    el.addEventListener('touchcancel', endTouch);
  }

  poke() {
    this.lastInputAt = performance.now();
  }

  requestLock() {
    if (this.isTouch || this.locked || !this.started) return;
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  setAutoWalk(v) {
    this.autoWalk = v;
    if (this.onAutoWalkChange) this.onAutoWalkChange(v);
  }

  // forward f (+1 ahead), strafe s (+1 right)
  getMove() {
    let f = 0;
    let s = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
    if (this.joy.active) {
      f += -this.joy.y;
      s += this.joy.x;
    }
    const manual = Math.abs(f) > 0.02 || Math.abs(s) > 0.02;
    if (this.autoWalk && !manual) f = 0.5; // relaxed stroll
    return {
      f: clamp(f, -1, 1),
      s: clamp(s, -1, 1),
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      manual,
    };
  }
}
