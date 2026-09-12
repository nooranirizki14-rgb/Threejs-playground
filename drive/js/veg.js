import * as THREE from 'three';
import { rnd } from './utils.js';

// Roadside grass tufts: instanced crossed planes with a painted blade
// texture, recycled around the camera. Catches the headlights at night.
const SPAN = 600;
const BEHIND = 80;

function wrapZ(z, pz) {
  while (z - pz > BEHIND) z -= SPAN;
  while (z - pz < -(SPAN - BEHIND)) z += SPAN;
  return z;
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.random() * 56;
    const h = 24 + Math.random() * 38;
    const lean = (Math.random() - 0.5) * 14;
    const shade = 30 + Math.random() * 40;
    g.strokeStyle = `rgb(${shade * 0.45},${shade},${shade * 0.5})`;
    g.lineWidth = 2 + Math.random() * 2;
    g.beginPath();
    g.moveTo(x, 64);
    g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Veg {
  constructor(scene) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    const geo = new THREE.PlaneGeometry(1.4, 0.85);
    geo.translate(0, 0.42, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: grassTexture(),
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      color: 0x9fb89f,
    });
    const n = 240;
    this.data = [];
    for (let i = 0; i < n; i++) {
      this.data.push({
        side: Math.random() < 0.5 ? -1 : 1,
        x: 9.5 + Math.pow(Math.random(), 1.4) * 46,
        z: rnd(-SPAN, 0),
        s: rnd(0.6, 1.7),
        r: rnd(0, Math.PI),
      });
    }
    this.mesh = new THREE.InstancedMesh(geo, mat, n * 2);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.layout(0);
  }

  layout(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.data.length; i++) {
      const t = this.data[i];
      t.z = wrapZ(t.z, pz);
      for (let k = 0; k < 2; k++) {
        d.position.set(t.side * t.x, 0, t.z);
        d.scale.set(t.s, t.s, t.s);
        d.rotation.set(0, t.r + (k * Math.PI) / 2, 0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i * 2 + k, d.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(pz) {
    this.layout(pz);
  }
}
