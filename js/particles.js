import * as THREE from 'three';

// Lightweight pooled GPU point-sprite particle system (single draw call).
export class Particles {
  constructor(scene, { max = 600, size = 0.18 } = {}) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.baseCol = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.head = 0;

    for (let i = 0; i < max; i++) this.positions[i * 3 + 1] = -999;

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);

    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    this._cA = new THREE.Color();
    this._cB = new THREE.Color();
  }

  spawn(x, y, z, {
    count = 10, color = 0xffffff, color2 = null,
    speed = 5, life = 0.8, gravity = 0, drag = 0, bias = null,
  } = {}) {
    const cA = this._cA.set(color);
    const cB = this._cB.set(color2 === null ? color : color2);
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      const i3 = i * 3;
      // random direction on a sphere
      const theta = Math.random() * Math.PI * 2;
      const zz = Math.random() * 2 - 1;
      const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
      const s = speed * (0.3 + Math.random() * 0.7);
      let vx = rr * Math.cos(theta) * s;
      let vy = zz * s;
      let vz = rr * Math.sin(theta) * s;
      if (bias) { vx += bias[0]; vy += bias[1]; vz += bias[2]; }
      this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
      this.positions[i3] = x; this.positions[i3 + 1] = y; this.positions[i3 + 2] = z;
      const L = life * (0.6 + Math.random() * 0.7);
      this.life[i] = L;
      this.maxLife[i] = L;
      this.grav[i] = gravity;
      this.drag[i] = drag;
      const t = Math.random();
      this.baseCol[i3] = cA.r + (cB.r - cA.r) * t;
      this.baseCol[i3 + 1] = cA.g + (cB.g - cA.g) * t;
      this.baseCol[i3 + 2] = cA.b + (cB.b - cA.b) * t;
    }
  }

  update(dt) {
    if (dt <= 0) return;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -999;
        this.colors[i3] = this.colors[i3 + 1] = this.colors[i3 + 2] = 0;
        continue;
      }
      const dr = 1 - Math.min(0.9, this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 2] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      // cheap ground bounce
      if (this.positions[i3 + 1] < 0.02 && this.vel[i3 + 1] < 0) {
        this.positions[i3 + 1] = 0.02;
        this.vel[i3 + 1] *= -0.4;
      }
      const f = this.life[i] / this.maxLife[i];
      this.colors[i3] = this.baseCol[i3] * f;
      this.colors[i3 + 1] = this.baseCol[i3 + 1] * f;
      this.colors[i3 + 2] = this.baseCol[i3 + 2] * f;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.colors.fill(0);
    for (let i = 0; i < this.max; i++) this.positions[i * 3 + 1] = -999;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}
