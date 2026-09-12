import * as THREE from 'three';

// Spring-lattice elastic deformation: grab, pull, poke, jiggle.
// Every vertex is a damped spring back to its rest pose, plus neighbor
// relaxation so the surface behaves like one connected sheet of jelly.
export class ElasticMesh {
  constructor(mesh, opts = {}) {
    this.mesh = mesh;
    const geo = mesh.geometry;
    this.attr = geo.attributes.position;
    this.count = this.attr.count;
    this.rest = new Float32Array(this.attr.array);
    this.off = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.weights = new Float32Array(this.count);
    this.avg = new Float32Array(this.count * 3);
    this.stiffness = opts.stiffness ?? 110;
    this.damping = opts.damping ?? 5.0;
    this.coupling = opts.coupling ?? 0.4;
    this.maxPull = opts.maxPull ?? 1.7;
    this.grabRadius = opts.grabRadius ?? 1.1;
    this.dragging = false;
    this.grabIdx = -1;
    this.grabTarget = new THREE.Vector3();
    this.lastPull = 0;
    this.buildNeighbors(geo);
  }

  buildNeighbors(geo) {
    const idx = geo.index.array;
    const sets = [];
    for (let i = 0; i < this.count; i++) sets.push(new Set());
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      sets[a].add(b); sets[a].add(c);
      sets[b].add(a); sets[b].add(c);
      sets[c].add(a); sets[c].add(b);
    }
    this.nStart = new Int32Array(this.count + 1);
    let total = 0;
    for (let i = 0; i < this.count; i++) { this.nStart[i] = total; total += sets[i].size; }
    this.nStart[this.count] = total;
    this.nList = new Int32Array(total);
    for (let i = 0; i < this.count; i++) {
      let j = this.nStart[i];
      for (const m of sets[i]) this.nList[j++] = m;
    }
  }

  nearestVertex(p) {
    let best = 0, bd = Infinity;
    const r = this.rest;
    for (let i = 0; i < this.count; i++) {
      const dx = r[i * 3] - p.x, dy = r[i * 3 + 1] - p.y, dz = r[i * 3 + 2] - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  paintWeights(centerIdx, radius) {
    const r = this.rest;
    const cx = r[centerIdx * 3], cy = r[centerIdx * 3 + 1], cz = r[centerIdx * 3 + 2];
    for (let i = 0; i < this.count; i++) {
      const dx = r[i * 3] - cx, dy = r[i * 3 + 1] - cy, dz = r[i * 3 + 2] - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.weights[i] = d < radius ? 0.5 + 0.5 * Math.cos((Math.PI * d) / radius) : 0;
    }
  }

  grab(point, radius) {
    this.grabIdx = this.nearestVertex(point);
    this.paintWeights(this.grabIdx, radius ?? this.grabRadius);
    this.grabTarget.copy(point);
    this.dragging = true;
    this.lastPull = 0;
  }

  dragTo(point) {
    this.grabTarget.copy(point);
  }

  release() {
    this.dragging = false;
    this.grabIdx = -1;
    return this.lastPull;
  }

  poke(point, strength = 3.0, radius = 0.6) {
    const c = this.nearestVertex(point);
    const r = this.rest;
    const cx = r[c * 3], cy = r[c * 3 + 1], cz = r[c * 3 + 2];
    const il = 1 / (Math.hypot(cx, cy, cz) || 1);
    const dx = -cx * il * strength, dy = -cy * il * strength, dz = -cz * il * strength;
    for (let i = 0; i < this.count; i++) {
      const ex = r[i * 3] - cx, ey = r[i * 3 + 1] - cy, ez = r[i * 3 + 2] - cz;
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d < radius) {
        const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / radius);
        this.vel[i * 3] += dx * w;
        this.vel[i * 3 + 1] += dy * w;
        this.vel[i * 3 + 2] += dz * w;
      }
    }
  }

  jiggle(s = 2.0) {
    for (let i = 0; i < this.count; i++) {
      this.vel[i * 3] += (Math.random() - 0.5) * 2 * s;
      this.vel[i * 3 + 1] += (Math.random() - 0.5) * 2 * s;
      this.vel[i * 3 + 2] += (Math.random() - 0.5) * 2 * s;
    }
  }

  reset() {
    this.off.fill(0);
    this.vel.fill(0);
    this.dragging = false;
    this.grabIdx = -1;
    this.write();
  }

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    const { off, vel, rest, count } = this;
    const k = this.stiffness, c = this.damping;
    if (this.dragging && this.grabIdx >= 0) {
      const follow = Math.min(1, dt * 24);
      const gx = this.grabTarget.x, gy = this.grabTarget.y, gz = this.grabTarget.z;
      const w = this.weights;
      let peak = 0;
      for (let i = 0; i < count; i++) {
        const wi = w[i];
        const i3 = i * 3;
        if (wi > 0.001) {
          const tx = (gx - rest[i3]) * wi;
          const ty = (gy - rest[i3 + 1]) * wi;
          const tz = (gz - rest[i3 + 2]) * wi;
          const px = off[i3], py = off[i3 + 1], pz = off[i3 + 2];
          const nx = px + (tx - px) * follow;
          const ny = py + (ty - py) * follow;
          const nz = pz + (tz - pz) * follow;
          const iv = 1 / Math.max(dt, 1e-4);
          vel[i3] = vel[i3] * 0.6 + (nx - px) * iv * 0.4;
          vel[i3 + 1] = vel[i3 + 1] * 0.6 + (ny - py) * iv * 0.4;
          vel[i3 + 2] = vel[i3 + 2] * 0.6 + (nz - pz) * iv * 0.4;
          off[i3] = nx; off[i3 + 1] = ny; off[i3 + 2] = nz;
          const m = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (m > peak) peak = m;
        } else {
          vel[i3] += (-k * off[i3] - c * vel[i3]) * dt;
          vel[i3 + 1] += (-k * off[i3 + 1] - c * vel[i3 + 1]) * dt;
          vel[i3 + 2] += (-k * off[i3 + 2] - c * vel[i3 + 2]) * dt;
          off[i3] += vel[i3] * dt;
          off[i3 + 1] += vel[i3 + 1] * dt;
          off[i3 + 2] += vel[i3 + 2] * dt;
        }
      }
      this.lastPull = Math.max(this.lastPull * 0.995, peak);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const sp = Math.hypot(vel[i3], vel[i3 + 1], vel[i3 + 2]);
        if (sp > 14) {
          const f = 14 / sp;
          vel[i3] *= f; vel[i3 + 1] *= f; vel[i3 + 2] *= f;
        }
      }
    } else {
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        vel[i3] += (-k * off[i3] - c * vel[i3]) * dt;
        vel[i3 + 1] += (-k * off[i3 + 1] - c * vel[i3 + 1]) * dt;
        vel[i3 + 2] += (-k * off[i3 + 2] - c * vel[i3 + 2]) * dt;
        off[i3] += vel[i3] * dt;
        off[i3 + 1] += vel[i3 + 1] * dt;
        off[i3 + 2] += vel[i3 + 2] * dt;
      }
      this.lastPull *= 0.95;
    }
    // clamp pull length
    const M = this.maxPull;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const m = Math.hypot(off[i3], off[i3 + 1], off[i3 + 2]);
      if (m > M) {
        const f = M / m;
        off[i3] *= f; off[i3 + 1] *= f; off[i3 + 2] *= f;
      }
    }
    // neighbor relaxation: one connected sheet of jelly
    const f = 1 - Math.pow(1 - this.coupling, dt * 60);
    const { nStart, nList, avg } = this;
    for (let i = 0; i < count; i++) {
      const s = nStart[i], e = nStart[i + 1];
      let ax = 0, ay = 0, az = 0;
      for (let j = s; j < e; j++) {
        const m = nList[j] * 3;
        ax += off[m]; ay += off[m + 1]; az += off[m + 2];
      }
      const nlen = Math.max(1, e - s);
      const i3 = i * 3;
      avg[i3] = ax / nlen; avg[i3 + 1] = ay / nlen; avg[i3 + 2] = az / nlen;
    }
    for (let i = 0; i < count * 3; i++) off[i] += (avg[i] - off[i]) * f;
    this.write();
  }

  write() {
    const a = this.attr.array;
    for (let i = 0; i < a.length; i++) a[i] = this.rest[i] + this.off[i];
    this.attr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  anchor(index, outPos, outNrm) {
    const p = this.attr.array;
    const n = this.mesh.geometry.attributes.normal.array;
    outPos.set(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]);
    outNrm.set(n[index * 3], n[index * 3 + 1], n[index * 3 + 2]);
  }
}
