// Driver needs: energy (sleep) + food. Chill penalties, never death.
import { clamp } from './utils.js';

export class Needs {
  constructor() {
    this.energy = 100;
    this.food = 100;
  }

  reset() {
    this.energy = 100;
    this.food = 100;
  }

  update(dt, driving) {
    // ~25 min of driving per full energy bar, ~35 min per food bar
    const eRate = driving ? 100 / 1500 : 100 / 2400;
    const fRate = 100 / 2100;
    this.energy = clamp(this.energy - eRate * dt, 0, 100);
    this.food = clamp(this.food - fRate * dt, 0, 100);
  }

  // extra drain while pushing the car
  pushDrain(dt) {
    this.energy = clamp(this.energy - 2.2 * dt, 0, 100);
  }

  eat(amount) {
    this.food = clamp(this.food + amount, 0, 100);
  }

  rest(hours) {
    this.energy = clamp(this.energy + hours * 14, 0, 100);
    this.food = clamp(this.food - hours * 3, 0, 100);
  }

  coffee() {
    this.energy = clamp(this.energy + 26, 0, 100);
    this.food = clamp(this.food + 4, 0, 100);
  }

  // eyelid droop 0..1 + steering wobble flag
  get fatigue() {
    if (this.energy > 30) return 0;
    return clamp((30 - this.energy) / 30, 0, 1);
  }

  get starving() {
    return this.food < 22;
  }

  serialize() {
    return { energy: this.energy, food: this.food };
  }

  load(d) {
    if (!d) return;
    this.energy = d.energy ?? 100;
    this.food = d.food ?? 100;
  }
}
