import { rnd } from './utils.js';

// Real-recordings-first audio: loads mp3s from public/sfx/.
// Missing files = silence (never placeholders). See public/sfx/README.md.
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

  async startRain() {
    if (!this.ready || this.rainSrc) return;
    const buf = await this.load('rain');
    if (!buf) return;
    this.rainSrc = this.ctx.createBufferSource();
    this.rainSrc.buffer = buf;
    this.rainSrc.loop = true;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.5;
    this.rainSrc.connect(this.rainGain);
    this.rainGain.connect(this.master);
    this.rainSrc.start();
  }

  setRain(on) {
    if (!this.ready || !this.rainGain) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.cancelScheduledValues(t);
    this.rainGain.gain.linearRampToValueAtTime(on ? 0.5 : 0.0, t + 1.2);
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

  toggleMute() {
    this.muted = !this.muted;
    if (this.ready) {
      this.master.gain.value = this.muted ? 0 : 0.8;
    }
    return this.muted;
  }
}
