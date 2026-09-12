import * as THREE from 'three';

// Debris: instanced chunks orbiting the tornado (near field, simplified
// physics) + a Points cloud of leaves/dust (far field, visual only).
// Nothing here is full rigid-body — all wind-advected with spin.
export type WindFn = (x: number, z: number, out: THREE.Vector3) => number;

const COUNT = 260;

export class Debris {
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private items: { a: number; r: number; y: number; s: number; rx: number; ry: number; wx: number; wy: number }[] = [];
  private leaves: THREE.Points;
  private leafPos: Float32Array;
  private leafDat: { a: number; r: number; y: number; s: number }[] = [];
  private checkIdx = 0;
  private wind = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.35, 0.12, 1.1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      this.items.push({
        a: Math.random() * Math.PI * 2,
        r: 8 + Math.random() * 90,
        y: Math.random() * 30,
        s: 0.5 + Math.random() * 1.6,
        rx: Math.random() * 6.28,
        ry: Math.random() * 6.28,
        wx: (Math.random() - 0.5) * 8,
        wy: (Math.random() - 0.5) * 8,
      });
      const pick = Math.random();
      if (pick < 0.4) col.setHex(0x5a4028);       // wood
      else if (pick < 0.65) col.setHex(0x3a3f45); // metal
      else if (pick < 0.85) col.setHex(0x2a4a22); // vegetation
      else col.setHex(0x6a6a70);                  // grey junk
      col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      this.mesh.setColorAt(i, col);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);

    // leaf/dust points
    const LN = 500;
    this.leafPos = new Float32Array(LN * 3);
    for (let i = 0; i < LN; i++) {
      this.leafDat.push({
        a: Math.random() * Math.PI * 2,
        r: 10 + Math.random() * 130,
        y: Math.random() * 40,
        s: 0.7 + Math.random(),
      });
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.leafPos, 3));
    this.leaves = new THREE.Points(lg, new THREE.PointsMaterial({
      color: 0x4a5a3a, size: 0.5, transparent: true, opacity: 0.8,
    }));
    this.leaves.frustumCulled = false;
    scene.add(this.leaves);
  }

  update(
    dt: number, cx: number, cz: number, radius: number, intensity: number,
    windAt: WindFn, carX: number, carZ: number, onHit: (strength: number) => void
  ) {
    const active = Math.floor(COUNT * (0.25 + intensity * 0.75));
    for (let i = 0; i < COUNT; i++) {
      const it = this.items[i];
      const px = cx + Math.cos(it.a) * it.r;
      const pz = cz + Math.sin(it.a) * it.r;
      // tangential speed peaks at the core edge, falls off with distance
      const wSpeed = windAt(px, pz, this.wind);
      const tang = Math.min(60, 8 + wSpeed * 0.9) * it.s;
      it.a += (tang / Math.max(4, it.r)) * dt;
      // drift: pulled in when far, flung around the core
      it.r += ((it.r > radius ? -6 : 2.5) + Math.sin(it.a * 3 + it.y) * 3) * dt * (0.5 + intensity);
      if (it.r < 3) it.r = 3 + Math.random() * 10;
      if (it.r > radius * 3.2) {
        it.r = radius * (0.8 + Math.random() * 0.8);
        it.y = Math.random() * 25;
      }
      it.y += (Math.sin(it.a * 2) * 2 + (it.r < radius ? 3 : -1)) * dt;
      if (it.y < 0.2) it.y = 0.2;
      if (it.y > 45) it.y = 45;
      it.rx += it.wx * dt;
      it.ry += it.wy * dt;
      const hidden = i >= active;
      const sc = hidden ? 0.0001 : it.s;
      this.dummy.position.set(
        cx + Math.cos(it.a) * it.r,
        it.y,
        cz + Math.sin(it.a) * it.r
      );
      this.dummy.rotation.set(it.rx, it.ry, 0);
      this.dummy.scale.setScalar(sc);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    // leaves: cheap orbit, no forces
    for (let i = 0; i < this.leafDat.length; i++) {
      const L = this.leafDat[i];
      L.a += dt * (2 + intensity * 10) * L.s * (20 / Math.max(10, L.r));
      this.leafPos[i * 3] = cx + Math.cos(L.a) * L.r;
      this.leafPos[i * 3 + 1] = L.y + Math.sin(L.a * 2 + i) * 2;
      this.leafPos[i * 3 + 2] = cz + Math.sin(L.a) * L.r;
    }
    this.leaves.geometry.attributes.position.needsUpdate = true;

    // car impacts: round-robin a slice of debris each frame
    for (let k = 0; k < 30; k++) {
      this.checkIdx = (this.checkIdx + 1) % active;
      const it = this.items[this.checkIdx];
      const dx = cx + Math.cos(it.a) * it.r - carX;
      const dz = cz + Math.sin(it.a) * it.r - carZ;
      if (dx * dx + dz * dz < 7.3 && it.y < 3.2) {
        onHit(0.4 + Math.random() * 0.6);
        // fling it away so it doesn't multi-hit
        it.r += 12;
        it.y += 4;
        break;
      }
    }
  }
}
