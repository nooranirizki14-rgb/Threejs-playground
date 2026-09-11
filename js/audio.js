// Synthesized retro sound effects — zero audio assets, pure WebAudio.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('neon-rush-muted') === '1';
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get enabled() {
    return !this.muted && this.ctx && this.ctx.state === 'running';
  }

  tone({ freq = 440, freqEnd = null, dur = 0.15, type = 'square', vol = 0.2, delay = 0 }) {
    if (!this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.4, vol = 0.3, delay = 0, low = 400, high = 4000 }) {
    if (!this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(high, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, low), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t0);
  }

  jump()  { this.tone({ freq: 300, freqEnd: 720, dur: 0.18, type: 'square', vol: 0.14 }); }
  land()  { this.noise({ dur: 0.12, vol: 0.14, low: 200, high: 900 }); }
  slide() { this.noise({ dur: 0.2, vol: 0.1, low: 300, high: 1600 }); }
  swoosh(){ this.noise({ dur: 0.11, vol: 0.07, low: 900, high: 5200 }); }
  click() { this.tone({ freq: 620, freqEnd: 920, dur: 0.07, type: 'square', vol: 0.1 }); }

  // coin pitch climbs with pickup combo — juicy!
  coin(combo = 0) {
    const base = 880 * Math.pow(2, Math.min(combo, 14) * 0.055);
    this.tone({ freq: base, dur: 0.1, type: 'sine', vol: 0.2 });
    this.tone({ freq: base * 1.5, dur: 0.16, type: 'sine', vol: 0.18, delay: 0.055 });
  }

  crash() {
    this.noise({ dur: 0.6, vol: 0.4, low: 90, high: 3200 });
    this.tone({ freq: 170, freqEnd: 38, dur: 0.55, type: 'sawtooth', vol: 0.22 });
  }

  go() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.12, type: 'square', vol: 0.13, delay: i * 0.07 }));
  }

  gameover() {
    [392, 311, 233, 155].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.22, type: 'sawtooth', vol: 0.1, delay: i * 0.13 }));
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('neon-rush-muted', m ? '1' : '0');
  }
}
