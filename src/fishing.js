import * as THREE from 'three';
import { rnd } from './utils.js';
import { makeWood } from './textures.js';

// Dock fishing minigame: cast, wait, pull on the bite. Plus a rowboat
// bobbing beside the dock.
export const ROD_POS = new THREE.Vector3(0.62, 0.35, -32.8);
const TIP = new THREE.Vector3(1.2, 1.7, -34.8);
const CAST = new THREE.Vector3(1.5, 0.06, -36);
const FISH = ['moonfish 🌙', 'midnight bass 🐟', 'starry trout ✨', 'lanternfish 🏮'];

export class Fishing {
  constructor(scene) {
    this.state = 'idle'; // idle | waiting | bite | caught
    this.waitTimer = 0;
    this.biteTimer = 0;
    this.catchTimer = 0;
    this.count = 0;
    this.onSplash = null;
    this.onPlip = null;
    this.onBite = null;
    this.onCatch = null;
    this.onMiss = null;
    this.onReel = null;

    // rod leaning on the dock post
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.8 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 2.4, 6), rodMat);
    rod.position.set(0.9, 1.0, -33.8);
    rod.rotation.set(0.7, 0, -0.35);
    rod.castShadow = true;
    scene.add(rod);
    const reel = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.025, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.9, roughness: 0.3 })
    );
    reel.position.set(0.62, 0.55, -32.9);
    scene.add(reel);

    // line (tip -> bobber)
    this.lineGeo = new THREE.BufferGeometry();
    this.lineArr = new Float32Array(6);
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.lineArr, 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({
      color: 0xd8d8d8, transparent: true, opacity: 0.6,
    }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    // bobber
    this.bobber = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.4 })
    );
    this.bobber.position.copy(CAST);
    this.bobber.visible = false;
    scene.add(this.bobber);

    // splash rings pool
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.12, 20),
        new THREE.MeshBasicMaterial({
          color: 0x9fb0c8, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(CAST.x, 0.05, CAST.z);
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, t: 1e9 });
    }

    // the catch (fish or boot, arcs to the dock)
    this.catchGroup = new THREE.Group();
    this.catchGroup.visible = false;
    scene.add(this.catchGroup);
    this.fishMesh = new THREE.Group();
    const scale = new THREE.MeshStandardMaterial({
      color: 0x6a8aa8, metalness: 0.7, roughness: 0.35,
    });
    const fbody = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), scale);
    fbody.rotation.x = Math.PI / 2;
    const ftail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), scale);
    ftail.rotation.x = -Math.PI / 2;
    ftail.position.z = -0.22;
    ftail.scale.x = 0.4;
    this.fishMesh.add(fbody, ftail);
    this.bootMesh = new THREE.Group();
    const bootM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.28), bootM);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.25, 0.12), bootM);
    shaft.position.set(0, 0.15, -0.07);
    this.bootMesh.add(foot, shaft);
    this.fishMesh.visible = false;
    this.bootMesh.visible = false;
    this.catchGroup.add(this.fishMesh, this.bootMesh);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3(0, 0.45, -33);
  }

  label() {
    if (this.state === 'idle') return 'cast a line';
    if (this.state === 'waiting') return 'wait…';
    if (this.state === 'bite') return 'PULL!';
    return 'nice!';
  }

  press() {
    if (this.state === 'idle') {
      this.state = 'waiting';
      this.waitTimer = rnd(4, 9);
      this.bobber.visible = true;
      this.bobber.position.copy(CAST);
      this.line.visible = true;
      for (const r of this.rings) r.t = 0;
      if (this.onSplash) this.onSplash();
    } else if (this.state === 'bite') {
      const boot = Math.random() < 0.1;
      this.state = 'caught';
      this.catchTimer = 0;
      this.fishMesh.visible = !boot;
      this.bootMesh.visible = boot;
      this.catchGroup.visible = true;
      this.from.copy(CAST);
      this.bobber.visible = false;
      this.line.visible = false;
      if (!boot) this.count++;
      if (this.onCatch) {
        this.onCatch(boot ? 'old boot 🥾' : FISH[(Math.random() * FISH.length) | 0], this.count, boot);
      }
    } else if (this.state === 'waiting') {
      this.state = 'idle';
      this.bobber.visible = false;
      this.line.visible = false;
      if (this.onReel) this.onReel();
    }
  }

  update(dt, t) {
    for (const r of this.rings) {
      r.t += dt;
      if (r.t < 0.9) {
        r.m.visible = true;
        const k = r.t / 0.9;
        r.m.scale.setScalar(1 + k * 4);
        r.m.material.opacity = (1 - k) * 0.7;
      } else {
        r.m.visible = false;
      }
    }
    if (this.state === 'waiting') {
      this.bobber.position.y = CAST.y + Math.sin(t * 2.2) * 0.02;
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) {
        this.state = 'bite';
        this.biteTimer = 1.4;
        if (this.onPlip) this.onPlip();
        if (this.onBite) this.onBite();
      }
    } else if (this.state === 'bite') {
      this.bobber.position.y = CAST.y - 0.07 + Math.sin(t * 14) * 0.02;
      this.biteTimer -= dt;
      if (this.biteTimer <= 0) {
        this.state = 'idle';
        this.bobber.visible = false;
        this.line.visible = false;
        if (this.onMiss) this.onMiss();
      }
    } else if (this.state === 'caught') {
      this.catchTimer += dt;
      const k = Math.min(1, this.catchTimer / 0.7);
      this.catchGroup.position.lerpVectors(this.from, this.to, k);
      this.catchGroup.position.y += Math.sin(k * Math.PI) * 1.2;
      this.catchGroup.rotation.z = Math.sin(t * 20) * 0.5 * (1 - k * 0.5);
      if (this.catchTimer > 2.2) {
        this.state = 'idle';
        this.catchGroup.visible = false;
      }
    }
    if (this.line.visible) {
      const a = this.lineGeo.getAttribute('position').array;
      a[0] = TIP.x; a[1] = TIP.y; a[2] = TIP.z;
      a[3] = this.bobber.position.x; a[4] = this.bobber.position.y; a[5] = this.bobber.position.z;
      this.lineGeo.getAttribute('position').needsUpdate = true;
    }
  }
}

export class Rowboat {
  constructor(scene) {
    const woodTex = makeWood({ base: '#4a3421', dark: '#201204', planks: 4, weather: 0.4 });
    const wood = new THREE.MeshStandardMaterial({ ...woodTex, roughness: 0.9 });
    const g = new THREE.Group();
    g.position.set(-3.5, 0, -27);
    g.rotation.y = 0.35;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 2.8), wood);
    hull.position.y = 0.1;
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.1, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x0a0805, roughness: 1 })
    );
    inner.position.y = 0.24;
    g.add(hull, inner);
    for (const bz of [-0.7, 0.5]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.25), wood);
      bench.position.set(0, 0.28, bz);
      g.add(bench);
    }
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), wood);
    oar.rotation.z = Math.PI / 2;
    oar.rotation.y = 0.3;
    oar.position.set(0.1, 0.32, 0);
    g.add(oar);
    scene.add(g);
    this.group = g;
    // mooring line to the dock post
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3.0, 0.3, -26.2),
      new THREE.Vector3(-0.8, 0.35, -26.5),
    ]);
    scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a2018 })));
  }

  update(t) {
    this.group.position.y = Math.sin(t * 0.8) * 0.05;
    this.group.rotation.z = Math.sin(t * 0.6 + 1) * 0.02;
    this.group.rotation.x = Math.sin(t * 0.5) * 0.015;
  }
}
