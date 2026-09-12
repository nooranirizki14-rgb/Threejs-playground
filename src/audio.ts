// Procedural storm audio: rain, wind, tornado roar, engine, thunder,
// impacts, wipers, alarms + radio (WX band / music), pet sounds,
// camera shutter, hail ticks, transformer boom. No audio files.
function noiseBuffer(ctx: AudioContext, brown = false, secs = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

interface PendingThunder { t: number; gain: number }

export class StormAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bufWhite: AudioBuffer | null = null;
  private bufBrown: AudioBuffer | null = null;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private roarGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private radioGain: GainNode | null = null;
  private radioMode: 'off' | 'wx' | 'music' = 'off';
  private pending: PendingThunder[] = [];
  private time = 0;
  private wxTimer = 2;
  private musicTimer = 0;
  private musicStep = 0;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(ctx.destination);
      this.bufWhite = noiseBuffer(ctx, false);
      this.bufBrown = noiseBuffer(ctx, true);
      const loop = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(f);
        f.connect(g);
        g.connect(this.master as GainNode);
        src.start();
        return { f, g };
      };
      const white = this.bufWhite;
      const brown = this.bufBrown;
      this.rainGain = loop(white, 'bandpass', 3200, 0.6).g;
      const wind = loop(white, 'lowpass', 420, 0.4);
      this.windGain = wind.g;
      this.windFilter = wind.f;
      this.roarGain = loop(brown, 'lowpass', 110, 0.5).g;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const ef = ctx.createBiquadFilter();
      ef.type = 'lowpass';
      ef.frequency.value = 300;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(ef);
      ef.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.radioGain = ctx.createGain();
      this.radioGain.gain.value = 0.0;
      this.radioGain.connect(this.master);
    } catch (e) { /* silent */ }
  }

  get ready() {
    return !!this.ctx;
  }

  setRadio(m: 'off' | 'wx' | 'music') {
    this.radioMode = m;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.master) {
      this.master.gain.value = this.muted ? 0 : 0.8;
    }
    return this.muted;
  }

  update(dt: number, s: { rain: number; wind: number; roar: number; rpm: number; engineOn: boolean }) {
    if (!this.ctx) return;
    this.time += dt;
    const k = Math.min(1, dt * 3);
    const set = (g: GainNode | null, v: number) => {
      if (g) g.gain.value += (v - g.gain.value) * k;
    };
    set(this.rainGain, s.rain * 0.5);
    set(this.windGain, Math.min(1, s.wind) * 0.7);
    if (this.windFilter) {
      this.windFilter.frequency.value = 300 + Math.min(1, s.wind) * 900;
    }
    set(this.roarGain, Math.min(1, s.roar) * 0.9);
    if (this.engineOsc && this.engineGain) {
      this.engineOsc.frequency.value = 50 + s.rpm * 90;
      const eg = s.engineOn ? 0.05 + s.rpm * 0.06 : 0;
      this.engineGain.gain.value += (eg - this.engineGain.gain.value) * k;
    }
    if (this.radioGain) {
      const rg = this.radioMode === 'off' ? 0 : 0.5;
      this.radioGain.gain.value += (rg - this.radioGain.gain.value) * k;
    }
    if (this.radioMode === 'wx' && this.radioGain && this.radioGain.gain.value > 0.2) {
      this.wxTimer -= dt;
      if (this.wxTimer <= 0) {
        this.wxTimer = 5 + Math.random() * 6;
        this.wxBurst();
      }
    }
    if (this.radioMode === 'music') {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 0.19;
        this.musicNote(this.musicStep++);
      }
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        this.thunderBurst(p.gain);
      }
    }
  }

  thunder(delaySec: number, gain: number) {
    if (!this.ctx) return;
    this.pending.push({ t: Math.min(delaySec, 6), gain });
  }

  private thunderBurst(gain: number) {
    if (!this.ctx || !this.master || !this.bufBrown) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.2 + Math.random() * 1.5;
    const src = ctx.createBufferSource();
    src.buffer = this.bufBrown;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(1, gain), t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  thump(gain = 0.6) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(1, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  crack() {
    if (!this.ctx || !this.master || !this.bufWhite) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufWhite;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.35);
  }

  beep(freq = 880) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.setValueAtTime(0.06, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }

  wiperSwish() {
    if (!this.ctx || !this.master || !this.bufWhite) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufWhite;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  bark() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.18;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.16);
    }
  }

  meow() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(780, t + 0.12);
    o.frequency.linearRampToValueAtTime(440, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
  }

  shutter() {
    if (!this.ctx || !this.master || !this.bufWhite) return;
    const ctx = this.ctx;
    for (const dt of [0, 0.07]) {
      const t = ctx.currentTime + dt;
      const src = ctx.createBufferSource();
      src.buffer = this.bufWhite;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    }
  }

  boom() {
    if (!this.ctx || !this.master || !this.bufBrown) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufBrown;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 1);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g2);
    g2.connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
  }

  hailTick() {
    if (!this.ctx || !this.master || !this.bufWhite) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufWhite;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 4200;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05 + Math.random() * 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.07);
  }

  private wxBurst() {
    if (!this.ctx || !this.radioGain || !this.bufWhite) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // static burst + alert triple-beep, like a weather radio
    const src = ctx.createBufferSource();
    src.buffer = this.bufWhite;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1600;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.1);
    g.gain.setValueAtTime(0.16, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(f);
    f.connect(g);
    g.connect(this.radioGain);
    src.start(t);
    src.stop(t + 1.5);
    for (let i = 0; i < 3; i++) {
      const bt = t + 0.15 + i * 0.28;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1046;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, bt);
      og.gain.exponentialRampToValueAtTime(0.2, bt + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, bt + 0.2);
      o.connect(og);
      og.connect(this.radioGain);
      o.start(bt);
      o.stop(bt + 0.25);
    }
  }

  private musicNote(step: number) {
    if (!this.ctx || !this.radioGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // A-minor chase groove: bass + arp + hat
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    const arp = [220, 261.63, 329.63, 440, 329.63, 261.63, 246.94, 196];
    const bf = bass[step % 8];
    const bo = ctx.createOscillator();
    bo.type = 'triangle';
    bo.frequency.value = step % 2 === 0 ? bf : bf * 1.5;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.16, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    bo.connect(bg);
    bg.connect(this.radioGain);
    bo.start(t);
    bo.stop(t + 0.2);
    if (step % 2 === 1 && this.bufWhite) {
      const ao = ctx.createOscillator();
      ao.type = 'square';
      ao.frequency.value = arp[step % 8] * 2;
      const af = ctx.createBiquadFilter();
      af.type = 'lowpass';
      af.frequency.value = 2400;
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.05, t);
      ag.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      ao.connect(af);
      af.connect(ag);
      ag.connect(this.radioGain);
      ao.start(t);
      ao.stop(t + 0.17);
      const hs = ctx.createBufferSource();
      hs.buffer = this.bufWhite;
      const hf = ctx.createBiquadFilter();
      hf.type = 'highpass';
      hf.frequency.value = 6000;
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.05, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      hs.connect(hf);
      hf.connect(hg);
      hg.connect(this.radioGain);
      hs.start(t);
      hs.stop(t + 0.05);
    }
  }
}
