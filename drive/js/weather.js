// Midnight weather director: drifting rain intensity + lightning scheduler.
import { clamp, lerp } from './utils.js';

export class Weather {
  constructor() {
    this.intensity = 0.7;   // current rain 0..1
    this.target = 0.7;
    this.changeIn = 50;
    this.nextFlash = 9;
    this.flashEnv = [];
    this.flash = 0;
    this.pendingThunder = -1;
    this.thunderI = 1;
    this.onThunder = null; // game injects audio hook
    this.gust = 0;         // wind gust strength 0..1
    this.gustDir = 1;      // pushes the car sideways
    this.gustT = 0;
    this.gustTarget = 0;
  }

  update(dt) {
    // drift intensity toward target, retarget periodically
    this.changeIn -= dt;
    if (this.changeIn <= 0) {
      this.changeIn = 60 + Math.random() * 120;
      const r = Math.random();
      this.target = r < 0.12 ? 0.12 + Math.random() * 0.15   // drizzle break
        : r < 0.6 ? 0.45 + Math.random() * 0.3               // steady rain
        : 0.75 + Math.random() * 0.25;                        // downpour
    }
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * 0.05);

    // wind gusts in heavy rain: push the car, slant the rain
    this.gustT -= dt;
    if (this.gustT <= 0) {
      this.gustT = 3.5 + Math.random() * 7;
      this.gustDir = Math.random() < 0.5 ? -1 : 1;
      this.gustTarget = this.intensity > 0.45 ? 0.25 + Math.random() * 0.75 : 0;
    }
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 0.6);

    // lightning only when properly raining
    if (this.intensity > 0.5) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 9 + Math.random() * 24;
        const peak = 0.45 + Math.random() * 0.55;
        this.flashEnv.push({ t: 0, dur: 0.09, peak: peak * 0.7 });
        this.flashEnv.push({ t: -0.16, dur: 0.24, peak });
        this.pendingThunder = 0.7 + Math.random() * 1.8;
        this.thunderI = 0.6 + Math.random() * 0.6;
      }
    }
    let f = 0;
    for (let i = this.flashEnv.length - 1; i >= 0; i--) {
      const e = this.flashEnv[i];
      e.t += dt;
      if (e.t >= 0) {
        const k = e.t / e.dur;
        if (k >= 1) this.flashEnv.splice(i, 1);
        else f = Math.max(f, e.peak * Math.sin(Math.PI * k));
      }
    }
    this.flash = f;
    if (this.pendingThunder >= 0) {
      this.pendingThunder -= dt;
      if (this.pendingThunder < 0 && this.onThunder) this.onThunder(this.thunderI);
    }
    return f;
  }

  get fogDensity() {
    return lerp(0.02, 0.03, clamp(this.intensity, 0, 1));
  }
}
