import { clamp, storeGet, storeSet } from './utils.js';

// Real-first audio: plays recorded samples from public/sfx/ when present,
// falls back to synthesized sound for anything missing (upload more .mp3
// files to public/sfx/ — see public/sfx/README.md — and they just work).
const SFX_FILES = ['click', 'tick', 'blinker', 'door', 'crash', 'clank', 'glass',
  'crunch', 'photo', 'bell', 'gulp', 'deny', 'fuelcap', 'horn', 'wiper'];
const LOOP_FILES = ['engine', 'rain', 'wind', 'gravel', 'skid', 'fuel'];
const THUNDER_FILES = ['thunder1', 'thunder2', 'thunder3'];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = storeGet('midnight-drive-muted') === '1';
    this.volume = parseFloat(storeGet('midnight-drive-volume') || '0.8') || 0.8;
    this.volume = clamp(this.volume, 0, 1);
    this.eng = null;
    this.windGain = null;
    this.rainGain = null;
    this.skidGain = null;
    this.fuelNodes = null;
    this.noiseBuf = null;
    this.bank = {};   // name -> AudioBuffer | null
    this.loops = {};  // name -> { src, g, f? } live loop nodes
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9 * this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startBeds();
      this.startEngineNodes();
      this.loadBank();
    } catch (e) {
      this.ctx = null;
    }
  }

  get ok() {
    return !!this.ctx;
  }

  sfxBase() {
    try {
      const base = (import.meta.env && import.meta.env.BASE_URL) || './';
      return base + 'sfx/';
    } catch (e) {
      return './sfx/';
    }
  }

  async loadBank() {
    const all = [...SFX_FILES, ...LOOP_FILES, ...THUNDER_FILES];
    await Promise.all(all.map(async (n) => {
      try {
        const res = await fetch(this.sfxBase() + n + '.mp3');
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('audio')) {
          this.bank[n] = null; // missing (or dev SPA fallback page)
          return;
        }
        const ab = await res.arrayBuffer();
        this.bank[n] = await this.ctx.decodeAudioData(ab);
        if (LOOP_FILES.includes(n)) this.startRealLoop(n);
      } catch (e) {
        this.bank[n] = null;
      }
    }));
  }

  has(n) {
    return !!this.bank[n];
  }

  playBuf(n, { vol = 0.5, rate = 1, rateVar = 0 } = {}) {
    if (!this.ok || this.muted || !this.bank[n]) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.bank[n];
      src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * rateVar);
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.master);
      src.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  startRealLoop(n) {
    if (!this.ctx || this.loops[n] || !this.bank[n]) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.bank[n];
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      if (n === 'engine') {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 800;
        src.connect(f).connect(g).connect(this.master);
        this.loops[n] = { src, g, f };
      } else {
        src.connect(g).connect(this.master);
        this.loops[n] = { src, g };
      }
      src.start();
    } catch (e) { /* keep synth */ }
  }

  loopGain(n, v, tc = 0.3) {
    const L = this.loops[n];
    if (!L) return;
    L.g.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  // ---- continuous beds (synth fallback layer) ----
  loopNoise(filterType, freq, q = 0.7) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  startBeds() {
    this.rainGain = this.loopNoise('lowpass', 1200);
    this.windGain = this.loopNoise('bandpass', 500, 0.5);
    this.skidGain = this.loopNoise('highpass', 2800);
  }

  startEngineNodes() {
    const o1 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 27.5;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o1.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(this.master);
    o1.start();
    o2.start();
    this.eng = { o1, o2, f, g };
  }

  updateEngine(rpm01, throttle, on) {
    if (!this.eng) return;
    const t = this.ctx.currentTime;
    const R = this.loops.engine;
    if (R) {
      // real engine loop: pitch + brightness follow RPM
      R.src.playbackRate.setTargetAtTime(
        clamp(0.62 + rpm01 * 0.75 + throttle * 0.12, 0.5, 1.65), t, 0.06);
      R.f.frequency.setTargetAtTime(300 + rpm01 * 2600 + throttle * 600, t, 0.08);
      R.g.gain.setTargetAtTime(on ? 0.3 + throttle * 0.14 : 0, t, 0.09);
      this.eng.g.gain.setTargetAtTime(0, t, 0.1);
      return;
    }
    const fr = 42 + rpm01 * 175 + throttle * 12;
    this.eng.o1.frequency.setTargetAtTime(fr, t, 0.05);
    this.eng.o2.frequency.setTargetAtTime(fr * 0.5, t, 0.05);
    this.eng.f.frequency.setTargetAtTime(280 + rpm01 * 2400 + throttle * 600, t, 0.08);
    this.eng.g.gain.setTargetAtTime(on ? 0.085 + throttle * 0.05 + rpm01 * 0.02 : 0, t, 0.09);
  }

  updateBeds(speedKmh, rainI, skidding, dirt01 = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const w = clamp(speedKmh / 200, 0, 1);
    // real layers (silent until their file exists)
    this.loopGain('rain', 0.05 + rainI * 0.5, 0.4);
    this.loopGain('wind', w * w * 0.5, 0.3);
    this.loopGain('skid', skidding ? 0.4 : 0, 0.1);
    this.loopGain('gravel', dirt01 * clamp(speedKmh / 60, 0, 1) * 0.5, 0.25);
    // synth fallback layers (muted wherever a real loop exists)
    this.rainGain.gain.setTargetAtTime(
      this.loops.rain ? 0 : 0.02 + rainI * 0.13, t, 0.4);
    this.windGain.gain.setTargetAtTime(
      this.loops.wind ? 0 : w * w * 0.16, t, 0.3);
    this.skidGain.gain.setTargetAtTime(
      this.loops.skid ? 0 : skidding ? 0.1 : 0, t, 0.1);
  }

  // ---- one-shot helpers ----
  tone({ f = 440, f2 = null, dur = 0.15, type = 'square', vol = 0.2, delay = 0 }) {
    if (!this.ok || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) { /* silent */ }
  }

  noise({ dur = 0.3, vol = 0.3, delay = 0, low = 300, high = 4000, type = 'lowpass' }) {
    if (!this.ok || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(high, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, low), t0 + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (e) { /* silent */ }
  }

  // ---- SFX bank (real sample first, synth fallback) ----
  click() {
    if (!this.playBuf('click', { vol: 0.5 })) {
      this.tone({ f: 660, f2: 920, dur: 0.07, vol: 0.1 });
    }
  }
  tick() {
    if (!this.playBuf('tick', { vol: 0.4 })) {
      this.tone({ f: 1200, dur: 0.03, vol: 0.06 });
    }
  }
  deny() {
    if (!this.playBuf('deny', { vol: 0.45 })) {
      this.tone({ f: 220, f2: 140, dur: 0.18, type: 'square', vol: 0.14 });
    }
  }
  door() {
    if (this.playBuf('door', { vol: 0.6, rateVar: 0.06 })) return;
    this.noise({ dur: 0.12, vol: 0.25, low: 300, high: 1200 });
    this.tone({ f: 140, f2: 70, dur: 0.14, type: 'sine', vol: 0.25 });
  }
  horn() {
    if (this.playBuf('horn', { vol: 0.55, rateVar: 0.03 })) return;
    this.tone({ f: 370, dur: 0.35, type: 'sawtooth', vol: 0.16 });
    this.tone({ f: 466, dur: 0.35, type: 'sawtooth', vol: 0.16 });
  }
  trafficHorn() {
    if (this.playBuf('horn', { vol: 0.3, rate: 1.3, rateVar: 0.08 })) return;
    this.tone({ f: 520, dur: 0.22, type: 'sawtooth', vol: 0.1 });
    this.tone({ f: 655, dur: 0.22, type: 'sawtooth', vol: 0.1 });
  }
  blinker() {
    if (!this.playBuf('blinker', { vol: 0.4, rateVar: 0.04 })) {
      this.tone({ f: 1900, dur: 0.03, type: 'square', vol: 0.05 });
    }
  }
  wiper() {
    if (!this.playBuf('wiper', { vol: 0.4, rateVar: 0.08 })) {
      this.noise({ dur: 0.16, vol: 0.06, low: 500, high: 2000 });
    }
  }
  crash(strength = 1) {
    if (this.has('crash')) {
      this.playBuf('crash', { vol: 0.35 + 0.3 * strength, rateVar: 0.15 });
      this.playBuf('crunch', { vol: 0.3 * strength, rateVar: 0.2 });
      if (strength > 0.75) this.playBuf('glass', { vol: 0.5, rateVar: 0.1 });
      return;
    }
    this.noise({ dur: 0.45, vol: 0.4 * strength, low: 90, high: 2600 });
    this.tone({ f: 150, f2: 40, dur: 0.4, type: 'sawtooth', vol: 0.2 * strength });
  }
  scrape() { this.noise({ dur: 0.25, vol: 0.16, low: 800, high: 5000, type: 'highpass' }); }
  chaching() {
    this.tone({ f: 880, dur: 0.09, type: 'sine', vol: 0.16 });
    this.tone({ f: 1320, dur: 0.2, type: 'sine', vol: 0.16, delay: 0.08 });
  }
  gulp() {
    if (!this.playBuf('gulp', { vol: 0.5, rateVar: 0.1 })) {
      this.tone({ f: 300, f2: 150, dur: 0.12, type: 'sine', vol: 0.16 });
      this.tone({ f: 260, f2: 130, dur: 0.12, type: 'sine', vol: 0.16, delay: 0.15 });
    }
  }
  snore() {
    for (let i = 0; i < 3; i++) {
      this.noise({ dur: 0.5, vol: 0.1, delay: i * 1.1, low: 200, high: 600 });
    }
  }
  clank() {
    if (!this.playBuf('clank', { vol: 0.5, rateVar: 0.12 })) {
      this.tone({ f: 700, f2: 300, dur: 0.08, type: 'square', vol: 0.12 });
      this.noise({ dur: 0.06, vol: 0.1, low: 2000, high: 6000, type: 'highpass' });
    }
  }
  photo() {
    if (!this.playBuf('photo', { vol: 0.55 })) {
      this.tone({ f: 2200, dur: 0.04, vol: 0.1 });
      this.noise({ dur: 0.08, vol: 0.12, low: 2000, high: 7000, type: 'highpass' });
    }
  }
  bell() {
    if (!this.playBuf('bell', { vol: 0.45 })) {
      this.tone({ f: 1567, dur: 0.4, type: 'sine', vol: 0.12 });
      this.tone({ f: 2093, dur: 0.5, type: 'sine', vol: 0.1, delay: 0.18 });
    }
  }
  fuelcap() {
    if (!this.playBuf('fuelcap', { vol: 0.5 })) {
      this.tone({ f: 500, f2: 900, dur: 0.06, vol: 0.1 });
    }
  }
  repairDone() {
    [523, 659, 784].forEach((f, i) => this.tone({ f, dur: 0.14, type: 'triangle', vol: 0.16, delay: i * 0.09 }));
  }
  towBeep() {
    for (let i = 0; i < 3; i++) this.tone({ f: 950, dur: 0.16, type: 'square', vol: 0.1, delay: i * 0.4 });
  }
  staticBurst(dur = 0.25) {
    this.noise({ dur, vol: 0.1, low: 1200, high: 5000, type: 'bandpass' });
  }
  growl() {
    this.tone({ f: 90, f2: 55, dur: 0.5, type: 'sawtooth', vol: 0.1 });
  }

  thunder(intensity = 1) {
    const variants = THUNDER_FILES.filter((n) => this.has(n));
    if (variants.length) {
      this.playBuf(variants[(Math.random() * variants.length) | 0], {
        vol: 0.55 * intensity, rate: 0.9 + Math.random() * 0.2,
      });
      return;
    }
    if (!this.ok || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + 0.02;
      const dur = 1.8 + Math.random() * 1.2;
      const src = this.ctx.createBufferSource();
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      src.buffer = buf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, t0);
      lp.frequency.exponentialRampToValueAtTime(55, t0 + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.45 * intensity, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.1 * intensity, t0 + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.28 * intensity, t0 + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(lp).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (e) { /* silent */ }
  }

  // fuel pump loop
  startFuel() {
    if (!this.ok || this.fuelNodes) return;
    if (this.has('fuel') && this.loops.fuel) {
      this.loops.fuel.g.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.15);
      this.fuelNodes = { real: true };
      return;
    }
    try {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 95;
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      const g = this.ctx.createGain();
      g.gain.value = 0.06;
      o.connect(g);
      n.connect(f).connect(g);
      g.connect(this.master);
      o.start();
      n.start();
      this.fuelNodes = { o, n, g };
    } catch (e) { /* silent */ }
  }

  stopFuel() {
    if (!this.fuelNodes) return;
    try {
      if (this.fuelNodes.real) {
        this.loopGain('fuel', 0, 0.05);
      } else {
        const { o, n, g } = this.fuelNodes;
        g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        setTimeout(() => {
          try { o.stop(); n.stop(); } catch (e) { /* noop */ }
        }, 300);
      }
    } catch (e) { /* silent */ }
    this.fuelNodes = null;
  }

  setMuted(m) {
    this.muted = m;
    storeSet('midnight-drive-muted', m ? '1' : '0');
    this.applyVolume();
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    storeSet('midnight-drive-volume', String(this.volume));
    this.applyVolume();
  }

  applyVolume() {
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.9 * this.volume, this.ctx.currentTime, 0.1
      );
    }
  }
}
