import * as THREE from 'three';
import { clamp } from './utils.js';

// On-foot first-person walker with circle-collider push-out.
export class Walker {
  constructor() {
    this.pos = new THREE.Vector3(-1.75, 0, 22);
    this.yaw = 0;
    this.pitch = 0;
    this.bob = 0;
  }

  place(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
  }

  update(dt, move, colliders, carCircles, xLimit) {
    // move: {f, s, run}
    const speed = move.run ? 6 : 3.6;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const f = move.f * speed;
    const s = move.s * speed;
    this.pos.x += (-sin * f + cos * s) * dt;
    this.pos.z += (-cos * f - sin * s) * dt;

    // rails: same limits as the car, plus median block (always left side)
    this.pos.x = clamp(this.pos.x, -xLimit, -0.8);

    // push-out of circles
    const push = (c, r) => {
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = r + c.r;
      if (d < min && d > 0.001) {
        this.pos.x = c.x + (dx / d) * min;
        this.pos.z = c.z + (dz / d) * min;
      }
    };
    for (const c of colliders) push(c, 0.45);
    for (const c of carCircles) push(c, 0.45);

    const moving = Math.abs(move.f) + Math.abs(move.s) > 0.1;
    if (moving) this.bob += dt * (move.run ? 11 : 8);
    return moving;
  }

  eyeHeight() {
    return 1.65 + Math.sin(this.bob) * 0.035;
  }
}
