import { clamp } from './utils.js';

// Chill cruise: lane keeping + adaptive speed. Can't refuel for you (yet).
export class Autopilot {
  constructor() {
    this.on = false;
  }

  set(on) {
    this.on = on;
  }

  // st: {x, heading, speed, laneX, trafficAhead {dist, speed}|null, canDrive}
  drive(st) {
    if (!this.on || !st.canDrive) return null;
    const err = st.laneX - st.x;
    const desired = clamp(err * 0.1, -0.25, 0.25);
    let dh = desired - st.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = clamp(dh * 2.5, -1, 1);

    let target = 22; // ~80 km/h cruise
    if (st.trafficAhead) {
      const t = st.trafficAhead;
      if (t.dist < 50) target = Math.min(target, Math.max(0, t.speed + (t.dist - 14) * 0.4));
    }
    let throttle = 0;
    let brake = 0;
    if (st.speed < target - 0.5) throttle = clamp((target - st.speed) * 0.3, 0, 0.8);
    else if (st.speed > target + 1) brake = clamp((st.speed - target) * 0.3, 0, 0.7);
    return { throttle, brake, steer, handbrake: false };
  }
}
