// Procedural ambience: looping rain bed + synthesized thunder. Zero assets.
export class RainAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('neon-rain-muted') === '1';
    this.started = false;
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
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startRain() {
    if (!this.ctx || this.started) return;
    this.started = true;
    // low patter bed
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2.5);
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const g1 = this.ctx.createGain();
    g1.gain.value = 0.11;
    src.connect(lp).connect(g1).connect(this.master);
    src.start();
    // high hiss layer
    const src2 = this.ctx.createBufferSource();
    src2.buffer = this.noiseBuffer(1.7);
    src2.loop = true;
    src2.playbackRate.value = 0.7;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200;
    bp.Q.value = 0.6;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.028;
    src2.connect(bp).connect(g2).connect(this.master);
    src2.start();
  }

  thunder(intensity = 1) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + 0.02;
      const dur = 1.8 + Math.random() * 1.2;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer(dur);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(420, t0);
      lp.frequency.exponentialRampToValueAtTime(55, t0 + dur);
      const g = this.ctx.createGain();
      // double-rumble envelope
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 * intensity, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.12 * intensity, t0 + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.3 * intensity, t0 + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(lp).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (e) { /* silent */ }
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('neon-rain-muted', m ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.1);
    }
  }
}
