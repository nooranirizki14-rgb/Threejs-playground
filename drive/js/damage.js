// Engine wear + temperature model. Redline it, crash it, or run it hot
// and you'll be pushing. Chill: nothing explodes, it just quits.
import { clamp } from './utils.js';

export class Engine {
  constructor() {
    this.health = 100;
    this.temp = 92;
    this.misfireT = 0;
  }

  reset() {
    this.health = 100;
    this.temp = 92;
    this.misfireT = 0;
  }

  get broken() {
    return this.health <= 0;
  }

  get health01() {
    return clamp(this.health / 100, 0, 1);
  }

  // returns power multiplier (misfires included)
  update(dt, { rpm01, throttle, speedKmh, offroad, running }) {
    if (!running) {
      this.temp += (60 - this.temp) * Math.min(1, dt * 0.05);
      return 1;
    }
    // temperature: load heats, speed cools
    const load = throttle * (0.5 + rpm01);
    const cooling = 4 + speedKmh * 0.12;
    this.temp += (load * 26 - (this.temp - 88) * cooling * 0.02) * dt;
    this.temp = clamp(this.temp, 60, 145);

    // wear
    let wear = 0.008; // age, per second while running
    if (rpm01 > 0.88) wear += (rpm01 - 0.88) * 9;      // redline
    if (offroad) wear += 0.5;
    if (this.temp > 122) wear += (this.temp - 122) * 0.06; // overheat
    this.health = clamp(this.health - wear * dt, 0, 100);

    // misfire when worn: random power cuts
    let power = 1;
    if (this.health < 25 && !this.broken) {
      this.misfireT -= dt;
      if (this.misfireT <= 0) {
        this.misfireT = 0.4 + Math.random() * (this.health / 25) * 2.5;
      }
      if (this.misfireT < 0.18) power = 0.25;
    }
    if (this.health < 50) power *= 0.9;
    return power;
  }

  crashDamage(impactKmh) {
    if (impactKmh < 8) return 0;
    const dmg = clamp((impactKmh - 8) * 0.35, 1, 22);
    this.health = clamp(this.health - dmg, 0, 100);
    return dmg;
  }

  repairSelf() {
    // with a kit at the hood: +65, temp reset
    this.health = clamp(this.health + 65, 0, 100);
    this.temp = Math.min(this.temp, 95);
  }

  repairGarage() {
    this.health = 100;
    this.temp = 92;
  }

  serialize() {
    return { health: this.health, temp: this.temp };
  }

  load(d) {
    if (!d) return;
    this.health = d.health ?? 100;
    this.temp = d.temp ?? 92;
  }
}
