import { clamp, rnd } from './utils.js';

// Real-recordings-first audio: loops (rain, fire, crickets), one-shots
// (thunder, lamp click, footsteps). Missing files = silence. See CREDITS.md.
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
    this.stepTried = false;
    this.stepBufs = [];
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
  }

  setRain(on) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (this.rainGain) {
      this.rainGain.gain.cancelScheduledValues(t);
      this.rainGain.gain.linearRampToValueAtTime(on ? 0.5 : 0.0, t + 1.2);
    }
    // crickets come out when the rain stops
    if (this.cricketGain) {
      this.cricketGain.gain.cancelScheduledValues(t);
      this.cricketGain.gain.linearRampToValueAtTime(on ? 0.0 : 0.4, t + 2.0);
    }
  }

  updateFire(dt, dist) {
    if (!this.ready || !this.fireGain) return;
    const target = Math.pow(clamp(1 - dist / 24, 0, 1), 1.5) * 0.7;
    const cur = this.fireGain.gain.value;
    this.fireGain.gain.value = cur + (target - cur) * Math.min(1, dt * 3);
  }

  async thunder() {
    if (!this.ready) return;
    const buf = await this.load('thunder');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rnd(0.85, 1.1);
    const g = this.ctx.createGain();
    g.gain.value = rnd(0.4, 0.7);
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  async click() {
    if (!this.ready) return;
    const buf = await this.load('click');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  async step() {
    if (!this.ready) return;
    if (!this.stepTried) {
      this.stepTried = true;
      const bufs = await Promise.all([this.load('step'), this.load('step2')]);
      this.stepBufs = bufs.filter(Boolean);
    }
    if (!this.stepBufs.length) return;
    const buf = this.stepBufs[(Math.random() * this.stepBufs.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rnd(0.9, 1.1);
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ready) {
      this.master.gain.value = this.muted ? 0 : 0.8;
    }
    return this.muted;
  }
}
