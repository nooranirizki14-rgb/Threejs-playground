import { clamp } from './utils.js';

// Arcade car physics: speed scalar + heading bicycle-ish + handbrake slide.
export class CarPhysics {
  constructor() {
    this.x = -1.75;
    this.z = 20;
    this.heading = 0;   // 0 faces -Z
    this.speed = 0;     // m/s (+ forward)
    this.steer = 0;     // smoothed -1..1
    this.slide = 0;     // lateral slide velocity
    this.reversing = false;
  }

  forward() {
    return { x: -Math.sin(this.heading), z: -Math.cos(this.heading) };
  }

  right() {
    return { x: Math.cos(this.heading), z: -Math.sin(this.heading) };
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.slide = 0;
    this.reversing = false;
  }

  update(dt, input, env) {
    // input: {throttle 0..1, brake 0..1, steer -1..1, handbrake}
    // env: {engineOn, health01, surface: 'road'|'lot'|'dirt', auto}
    const healthF = 0.45 + 0.55 * env.health01;
    const surfMax = env.surface === 'road' ? 56 : env.surface === 'lot' ? 22 : 11;
    const surfGrip = env.surface === 'road' ? 1 : env.surface === 'lot' ? 0.85 : 0.5;

    // steering smoothing (heavier at speed)
    const steerRate = 6 / (1 + Math.abs(this.speed) / 14);
    this.steer += (input.steer - this.steer) * Math.min(1, dt * steerRate);

    const fwd = this.speed >= -0.1;
    if (env.engineOn) {
      if (input.throttle > 0 && !this.reversing) {
        const top = surfMax * healthF;
        const pull = 8.5 * (1 - Math.max(0, this.speed) / (top + 8));
        this.speed += Math.max(0, pull) * input.throttle * dt;
      }
      if (input.brake > 0) {
        if (this.speed > 0.6) {
          this.speed -= 13 * input.brake * dt;
        } else if (!this.reversing && input.brake > 0.5) {
          this.reversing = true; // stopped + brake = reverse gear
        }
      } else if (this.speed > 0.3) {
        this.reversing = false;
      }
      if (this.reversing && input.brake > 0) {
        this.speed -= 5 * input.brake * dt; // reverse up to -6
        this.speed = Math.max(this.speed, -6.5);
      }
      if (this.reversing && input.throttle > 0) this.reversing = false;
    }
    if (input.handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 16 * dt);
    }
    // drag + rolling resistance
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (0.35 + this.speed * this.speed * 0.00042) * dt);
    if (!env.engineOn) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 1.2 * dt);
    }
    if (Math.abs(this.speed) < 0.05 && input.throttle === 0 && input.brake === 0) this.speed = 0;

    // heading (bicycle-ish, grip-scaled; flips in reverse like a real car)
    const grip = input.handbrake ? surfGrip * 0.45 : surfGrip;
    const dirF = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * 1.7 * (Math.abs(this.speed) / (Math.abs(this.speed) + 13)) * grip * dirF * dt;
    // handbrake slide: lateral kick
    if (input.handbrake && Math.abs(this.speed) > 6) {
      this.slide += this.steer * Math.abs(this.speed) * 0.4 * dt;
    }
    this.slide *= Math.max(0, 1 - dt * (input.handbrake ? 1.2 : 4));

    const f = this.forward();
    const r = this.right();
    this.x += (f.x * this.speed + r.x * this.slide) * dt;
    this.z += (f.z * this.speed + r.z * this.slide) * dt;

    return { reversing: this.reversing && this.speed < 0.3 };
  }
}
