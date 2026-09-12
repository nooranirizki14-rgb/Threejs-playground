import { clamp, rnd } from './utils.js';

// Real + crafted audio: loops (rain, fire, crickets, wind, radio), one-shots
// (thunder, click, footsteps, thunk, hoot, bark, munch, kibble). Missing
// files = silence. See public/sfx/CREDITS.md.
const base = import.meta.env.BASE_URL || './';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.muted = false;
    this.cache = {};
    this.rainSrc = null;
    this.rainGain = null;
    this.fireSrc = null;
    this.fireGain = null;
    this.cricketSrc = null;
    this.cricketGain = null;
    this.windSrc = null;
    this.windGain = null;
    this.radioSrc = null;
    this.radioGain = null;
    this.rainOn = true;
    this.indoor = false;
    this.surfTried = {};
    this.surfBufs = {};
  }

  unlock() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.ready = true;
    } catch (e) { /* no audio */ }
  }

  async load(name) {
    if (!this.ready || this.cache[name] === null) return this.cache[name] || null;
    if (this.cache[name]) return this.cache[name];
    try {
      const res = await fetch(`${base}sfx/${name}.mp3`);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('audio')) {
        this.cache[name] = null;
        return null;
      }
      const buf = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(buf);
      this.cache[name] = decoded;
      return decoded;
    } catch (e) {
      this.cache[name] = null;
      return null;
    }
  }

  async startLoop(name, volume) {
    if (!this.ready) return null;
    const buf = await this.load(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
    return { src, gain };
  }

  async startAmbience() {
    if (!this.ready) return;
    if (!this.rainSrc) {
      const r = await this.startLoop('rain', 0.5);
      if (r) {
        this.rainSrc = r.src;
        this.rainGain = r.gain;
      }
    }
    if (!this.fireSrc) {
      const f = await this.startLoop('fire', 0);
      if (f) {
        this.fireSrc = f.src;
        this.fireGain = f.gain;
      }
    }
    if (!this.cricketSrc) {
      const c = await this.startLoop('crickets', 0);
      if (c) {
        this.cricketSrc = c.src;
        this.cricketGain = c.gain;
      }
    }
    if (!this.windSrc) {
      const w = await this.startLoop('wind', 0.14);
      if (w) {
        this.windSrc = w.src;
        this.windGain = w.gain;
      }
    }
    if (!this.radioSrc) {
      const r = await this.startLoop('radio', 0);
      if (r) {
        this.radioSrc = r.src;
        this.radioGain = r.gain;
      }
    }
  }

  applyRainGain() {
    if (!this.ready || !this.rainGain) return;
    const target = this.rainOn ? (this.indoor ? 0.18 : 0.5) : 0;
    const t = this.ctx.currentTime;
    this.rainGain.gain.cancelScheduledValues(t);
    this.rainGain.gain.linearRampToValueAtTime(target, t + 1.2);
  }

  setRain(on) {
    this.rainOn = on;
    if (!this.ready) return;
    this.applyRainGain();
    // crickets come out when the rain stops
    if (this.cricketGain) {
      const t = this.ctx.currentTime;
      this.cricketGain.gain.cancelScheduledValues(t);
      this.cricketGain.gain.linearRampToValueAtTime(on ? 0.0 : 0.4, t + 2.0);
    }
  }

  setIndoor(indoor) {
    if (this.indoor === indoor) return;
    this.indoor = indoor;
    this.applyRainGain();
  }

  setRadio(on) {
    if (!this.ready || !this.radioGain) return;
    const t = this.ctx.currentTime;
    this.radioGain.gain.cancelScheduledValues(t);
    this.radioGain.gain.linearRampToValueAtTime(on ? 0.5 : 0.0, t + 0.8);
  }

  updateFire(dt, dist) {
    if (!this.ready || !this.fireGain) return;
    const target = Math.pow(clamp(1 - dist / 24, 0, 1), 1.5) * 0.7;
    const cur = this.fireGain.gain.value;
    this.fireGain.gain.value = cur + (target - cur) * Math.min(1, dt * 3);
  }

  oneShot(buf, rate, gainVal) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  async thunder() {
    if (!this.ready) return;
    const buf = await this.load('thunder');
    if (!buf) return;
    this.oneShot(buf, rnd(0.85, 1.1), rnd(0.4, 0.7));
  }

  async click() {
    if (!this.ready) return;
    const buf = await this.load('click');
    if (!buf) return;
    this.oneShot(buf, 1, 0.5);
  }

  async thunk() {
    if (!this.ready) return;
    const buf = await this.load('step');
    if (!buf) return;
    this.oneShot(buf, 0.45, 0.35);
  }

  async hoot() {
    if (!this.ready) return;
    const buf = await this.load('hoot');
    if (!buf) return;
    this.oneShot(buf, rnd(0.95, 1.05), 0.35);
  }

  async bark(kind) {
    if (!this.ready) return;
    const buf = await this.load('bark');
    if (!buf) return;
    this.oneShot(buf, kind === 'happy' ? 1.15 : 0.9, kind === 'happy' ? 0.35 : 0.5);
  }

  async munch() {
    if (!this.ready) return;
    const buf = await this.load('munch');
    if (!buf) return;
    this.oneShot(buf, rnd(0.95, 1.05), 0.6);
  }

  async kibble() {
    if (!this.ready) return;
    const buf = await this.load('kibble');
    if (!buf) return;
    this.oneShot(buf, 1, 0.6);
  }

  async step(surface) {
    if (!this.ready) return;
    const files = surface === 'wood' ? ['step_wood']
      : surface === 'grass' ? ['step_grass']
        : ['step', 'step2'];
    if (!this.surfTried[surface]) {
      this.surfTried[surface] = true;
      const bufs = await Promise.all(files.map((f) => this.load(f)));
      this.surfBufs[surface] = bufs.filter(Boolean);
    }
    const set = this.surfBufs[surface];
    if (!set || !set.length) return;
    const buf = set[(Math.random() * set.length) | 0];
    const gain = surface === 'wood' ? 0.3 : surface === 'grass' ? 0.25 : 0.22;
    this.oneShot(buf, rnd(0.9, 1.1), gain);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ready) {
      this.master.gain.value = this.muted ? 0 : 0.8;
    }
    return this.muted;
  }
}
