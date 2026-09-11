import { clamp } from './utils.js';

// All audio synthesized: engine, wind, rain, thunder + full SFX bank.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('midnight-drive-muted') === '1';
    this.eng = null;
    this.windGain = null;
    this.rainGain = null;
    this.skidGain = null;
    this.fuelNodes = null;
    this.noiseBuf = null;
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
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startBeds();
      this.startEngineNodes();
    } catch (e) {
      this.ctx = null;
    }
  }

  get ok() {
    return !!this.ctx;
  }

  // ---- continuous beds ----
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
    const fr = 42 + rpm01 * 175 + throttle * 12;
    this.eng.o1.frequency.setTargetAtTime(fr, t, 0.05);
    this.eng.o2.frequency.setTargetAtTime(fr * 0.5, t, 0.05);
    this.eng.f.frequency.setTargetAtTime(280 + rpm01 * 2400 + throttle * 600, t, 0.08);
    this.eng.g.gain.setTargetAtTime(on ? 0.085 + throttle * 0.05 + rpm01 * 0.02 : 0, t, 0.09);
  }

  updateBeds(speedKmh, rainI, skidding) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(0.02 + rainI * 0.13, t, 0.4);
    const w = clamp(speedKmh / 200, 0, 1);
    this.windGain.gain.setTargetAtTime(w * w * 0.16, t, 0.3);
    this.skidGain.gain.setTargetAtTime(skidding ? 0.1 : 0, t, 0.1);
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

  // ---- SFX bank ----
  click() { this.tone({ f: 660, f2: 920, dur: 0.07, vol: 0.1 }); }
  deny() { this.tone({ f: 220, f2: 140, dur: 0.18, type: 'square', vol: 0.14 }); }
  door() {
    this.noise({ dur: 0.12, vol: 0.25, low: 300, high: 1200 });
    this.tone({ f: 140, f2: 70, dur: 0.14, type: 'sine', vol: 0.25 });
  }
  horn() {
    this.tone({ f: 370, dur: 0.35, type: 'sawtooth', vol: 0.16 });
    this.tone({ f: 466, dur: 0.35, type: 'sawtooth', vol: 0.16 });
  }
  trafficHorn() {
    this.tone({ f: 520, dur: 0.22, type: 'sawtooth', vol: 0.1 });
    this.tone({ f: 655, dur: 0.22, type: 'sawtooth', vol: 0.1 });
  }
  blinker() { this.tone({ f: 1900, dur: 0.03, type: 'square', vol: 0.05 }); }
  wiper() { this.noise({ dur: 0.16, vol: 0.06, low: 500, high: 2000 }); }
  crash(strength = 1) {
    this.noise({ dur: 0.45, vol: 0.4 * strength, low: 90, high: 2600 });
    this.tone({ f: 150, f2: 40, dur: 0.4, type: 'sawtooth', vol: 0.2 * strength });
  }
  scrape() { this.noise({ dur: 0.25, vol: 0.16, low: 800, high: 5000, type: 'highpass' }); }
  chaching() {
    this.tone({ f: 880, dur: 0.09, type: 'sine', vol: 0.16 });
    this.tone({ f: 1320, dur: 0.2, type: 'sine', vol: 0.16, delay: 0.08 });
  }
  gulp() {
    this.tone({ f: 300, f2: 150, dur: 0.12, type: 'sine', vol: 0.16 });
    this.tone({ f: 260, f2: 130, dur: 0.12, type: 'sine', vol: 0.16, delay: 0.15 });
  }
  snore() {
    for (let i = 0; i < 3; i++) {
      this.noise({ dur: 0.5, vol: 0.1, delay: i * 1.1, low: 200, high: 600 });
    }
  }
  clank() {
    this.tone({ f: 700, f2: 300, dur: 0.08, type: 'square', vol: 0.12 });
    this.noise({ dur: 0.06, vol: 0.1, low: 2000, high: 6000, type: 'highpass' });
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
      const { o, n, g } = this.fuelNodes;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        try { o.stop(); n.stop(); } catch (e) { /* noop */ }
      }, 300);
    } catch (e) { /* silent */ }
    this.fuelNodes = null;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('midnight-drive-muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
