import * as THREE from 'three';
import { makeCanvas } from './utils.js';

// Footprints fading in the mud + visible breath in the cold air.
function puffTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(220,225,235,0.55)');
  grad.addColorStop(1, 'rgba(220,225,235,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Footprints {
  constructor(scene) {
    this.pool = [];
    this.idx = 0;
    this.side = 1;
    const geo = new THREE.PlaneGeometry(0.16, 0.32);
    for (let i = 0; i < 44; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0x030304, transparent: true, opacity: 0, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.pool.push({ m, life: 0 });
    }
  }

  step(x, z, yaw) {
    this.side *= -1;
    const p = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.pool.length;
    const px = Math.cos(yaw) * 0.12 * this.side;
    const pz = -Math.sin(yaw) * 0.12 * this.side;
    p.m.position.set(x + px, 0.011, z + pz);
    p.m.rotation.z = -yaw;
    p.m.visible = true;
    p.life = 25;
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.m.visible = false;
      } else {
        p.m.material.opacity = Math.min(0.5, p.life * 0.1);
      }
    }
  }
}

export class Breath {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffTexture(), transparent: true, opacity: 0, depthWrite: false,
      }));
      m.visible = false;
      scene.add(m);
      this.pool.push({ m, t: 1e9, vx: 0, vy: 0, vz: 0 });
    }
    this.idx = 0;
    this.timer = 2;
  }

  update(dt, camPos, camDir) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 3.8;
      const p = this.pool[this.idx];
      this.idx = (this.idx + 1) % this.pool.length;
      p.m.position.set(
        camPos.x + camDir.x * 0.35,
        camPos.y - 0.15,
        camPos.z + camDir.z * 0.35
      );
      p.vx = camDir.x * 0.2;
      p.vy = 0.15;
      p.vz = camDir.z * 0.2;
      p.t = 0;
      p.m.visible = true;
    }
    for (const p of this.pool) {
      if (p.t > 1.6) {
        p.m.visible = false;
        continue;
      }
      p.t += dt;
      const k = p.t / 1.6;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      const s = 0.15 + k * 0.35;
      p.m.scale.set(s, s, 1);
      p.m.material.opacity = Math.sin(k * Math.PI) * 0.16;
    }
  }
}
