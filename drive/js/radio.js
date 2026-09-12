// Procedural FM radio: 3 fully synthesized stations + static + off.
// Lookahead step-sequencer, zero audio assets.
const n2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

const STATIONS = [
  {
    name: 'MIDNIGHT SYNTH', freq: '88.1', bpm: 100, swing: 0,
    chords: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0.4, 0, 0, 1, 0, 0, 0, 1, 0.4],
    bassSteps: [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    stab: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    lead: 1,
  },
  {
    name: 'LOFI RAIN', freq: '91.7', bpm: 74, swing: 0.22,
    chords: [[48, 55, 58, 62], [46, 53, 57, 60], [44, 51, 55, 60], [43, 50, 55, 59]],
    kick: [1, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 1, 0, 0, 0, 0, 0],
    hat: [1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0.3],
    bassSteps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    stab: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lead: 0, vinyl: 1, rhodes: 1,
  },
  {
    name: 'NIGHT DRIVE FM', freq: '95.3', bpm: 120, swing: 0,
    chords: [[41, 53, 57, 60], [41, 53, 57, 60], [39, 51, 55, 58], [44, 56, 59, 62]],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5],
    bassSteps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    stab: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    lead: 0,
  },
];

export class Radio {
  constructor() {
    this.ctx = null;
    this.bus = null;
    this.index = -1; // -1 = off
    this.step = 0;
    this.bar = 0;
    this.nextT = 0;
    this.timer = null;
    this.noiseBuf = null;
  }

  attach(ctx, master) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.bus.connect(master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  current() {
    if (this.index < 0) return { name: 'OFF', freq: '--.-' };
    const s = STATIONS[this.index];
    return { name: s.name, freq: s.freq };
  }

  next() {
    this.stop();
    this.index = this.index >= STATIONS.length - 1 ? -1 : this.index + 1;
    if (this.index >= 0) this.start();
    return this.current();
  }

  start() {
    if (!this.ctx || this.index < 0) return;
    this.step = 0;
    this.bar = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.pump(), 40);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pump() {
    if (!this.ctx || this.index < 0) return;
    const st = STATIONS[this.index];
    const stepDur = 60 / st.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.18) {
      const swingShift = st.swing && this.step % 2 === 1 ? st.swing * stepDur : 0;
      this.playStep(st, this.step, this.bar, this.nextT + swingShift, stepDur);
      this.nextT += stepDur;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  playStep(st, s, bar, t, stepDur) {
    const chord = st.chords[bar % st.chords.length];
    const root = chord[0];
    if (st.kick[s]) this.kick(t, st.kick[s]);
    if (st.hat[s]) this.hat(t, st.hat[s] * 0.5);
    if (st.bassSteps[s]) this.bass(t, n2f(root), stepDur * 0.9);
    if (s === 0) this.pad(t, chord, stepDur * 16, st);
    if (st.stab[s]) this.stab(t, chord);
    if (st.lead && s % 2 === 0) {
      const arp = chord[(s / 2) % chord.length] + 12;
      this.pluck(t, n2f(arp));
    }
    if (st.vinyl && Math.random() < 0.5) this.crackle(t);
  }

  env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  kick(t, v) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    this.env(g, t, 0.5 * v, 0.16);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.2);
  }

  hat(t, v) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    this.env(g, t, 0.16 * v, 0.05);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t);
    src.stop(t + 0.08);
  }

  bass(t, freq, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.22, dur);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  pad(t, chord, dur, st) {
    for (const m of chord) {
      for (const det of [-4, 4]) {
        const o = this.ctx.createOscillator();
        o.type = st.rhodes ? 'triangle' : 'sawtooth';
        o.frequency.value = n2f(m);
        o.detune.value = det;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = st.rhodes ? 1200 : 900;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.5);
        g.gain.setValueAtTime(0.035, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(this.bus);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  stab(t, chord) {
    for (const m of chord.slice(1)) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = n2f(m);
      const g = this.ctx.createGain();
      this.env(g, t, 0.06, 0.18);
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + 0.22);
    }
  }

  pluck(t, freq) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.14);
    const g = this.ctx.createGain();
    this.env(g, t, 0.07, 0.16);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.2);
  }

  crackle(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 2;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3000 + Math.random() * 3000;
    const g = this.ctx.createGain();
    this.env(g, t + Math.random() * 0.1, 0.03, 0.02);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t);
    src.stop(t + 0.15);
  }
}
