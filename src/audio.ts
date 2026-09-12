// Procedural storm audio: rain, wind, tornado roar, engine, thunder,
// impacts, wipers, alarms. No audio files — all synthesized WebAudio.
function noiseBuffer(ctx: AudioContext, brown = false): AudioBuffer {
  const len = ctx.sampleRate * 2;
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
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private roarGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private pending: PendingThunder[] = [];
  private time = 0;
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
      const white = noiseBuffer(ctx, false);
      const brown = noiseBuffer(ctx, true);
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
      const rain = loop(white, 'bandpass', 3200, 0.6);
      this.rainGain = rain.g;
      const wind = loop(white, 'lowpass', 420, 0.4);
      this.windGain = wind.g;
      this.windFilter = wind.f;
      const roar = loop(brown, 'lowpass', 110, 0.5);
      this.roarGain = roar.g;
      // engine: detuned saws through a lowpass
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
    } catch (e) { /* silent */ }
  }

  get ready() {
    return !!this.ctx;
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
    // scheduled thunder
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
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.2 + Math.random() * 1.5;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, true);
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
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, false);
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
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, false);
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
}
