import * as THREE from 'three';
import { rnd } from './utils.js';

// Wild neighbors: Miso the porch cat, a fence-post owl, a fairy ring.
export const CAT_POS = new THREE.Vector3(-4, 1.08, 4.9);
export const OWL_POS = new THREE.Vector3(-2.1, 1.15, -20);
export const RING_POS = new THREE.Vector3(7, 0, -9);

export class Cat {
  constructor(scene) {
    const fur = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 1 });
    this.group = new THREE.Group();
    this.group.position.copy(CAT_POS);
    this.group.rotation.y = 2.6;
    const box = (mat, w, h, d, x, y, z, parent) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    box(fur, 0.16, 0.22, 0.16, 0, 0.11, 0.02, this.group);   // haunch
    box(fur, 0.13, 0.2, 0.13, 0, 0.2, 0.08, this.group);     // chest
    this.head = new THREE.Group();
    this.head.position.set(0, 0.36, 0.1);
    this.group.add(this.head);
    box(fur, 0.15, 0.13, 0.13, 0, 0, 0, this.head);
    const earGeo = new THREE.ConeGeometry(0.035, 0.08, 4);
    for (const ex of [-0.05, 0.05]) {
      const ear = new THREE.Mesh(earGeo, fur);
      ear.position.set(ex, 0.1, 0);
      this.head.add(ear);
    }
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f0a, emissive: 0x51ff7a, emissiveIntensity: 1.6, roughness: 0.3,
    });
    const eyeGeo = new THREE.SphereGeometry(0.018, 8, 6);
    this.eyeL = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.eyeL.position.set(-0.04, 0.01, 0.068);
    this.eyeR = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.eyeR.position.set(0.04, 0.01, 0.068);
    this.head.add(this.eyeL, this.eyeR);
    // tail in two segments for the flick
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.1, -0.08);
    this.group.add(this.tail);
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.22, 6), fur);
    t1.position.y = 0.11;
    const t2g = new THREE.Group();
    t2g.position.y = 0.22;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.18, 6), fur);
    t2.position.y = 0.09;
    t2g.add(t2);
    this.tail.add(t1, t2g);
    this.tailTip = t2g;
    this.tail.rotation.x = 0.5;
    scene.add(this.group);
    this.blinkTimer = rnd(2, 5);
    this.blinking = 0;
    this.meowTimer = rnd(30, 60);
    this.onMeow = null;
    this.nuzzleT = 0;
  }

  nuzzle() {
    this.nuzzleT = 2.5;
  }

  update(t, dt) {
    this.nuzzleT = Math.max(0, this.nuzzleT - dt);
    // tail flicks in slow bursts — fast happy wag when petted
    const happy = this.nuzzleT > 0;
    const burst = happy ? 1.6 : (Math.sin(t * 0.4) > 0.55 ? 1 : 0.15);
    const spd = happy ? 9 : 3.2;
    this.tail.rotation.z = Math.sin(t * spd) * 0.35 * burst;
    this.tailTip.rotation.z = Math.sin(t * spd + 1) * 0.5 * burst;
    // head tracks the yard lazily — dips into a pet
    this.head.rotation.y = Math.sin(t * 0.23) * 0.7;
    this.head.rotation.x += ((happy ? 0.35 : 0) - this.head.rotation.x) * Math.min(1, dt * 5);
    // blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = rnd(2.5, 6);
      this.blinking = 0.12;
    }
    if (this.blinking > 0) {
      this.blinking -= dt;
      this.eyeL.scale.y = 0.1;
      this.eyeR.scale.y = 0.1;
    } else {
      this.eyeL.scale.y = 1;
      this.eyeR.scale.y = 1;
    }
    // occasional meow
    this.meowTimer -= dt;
    if (this.meowTimer <= 0) {
      this.meowTimer = rnd(45, 100);
      if (this.onMeow) this.onMeow();
    }
  }
}

export class Owl {
  constructor(scene) {
    const feather = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 1 });
    this.group = new THREE.Group();
    this.group.position.copy(OWL_POS);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), feather);
    body.scale.set(1, 1.3, 1);
    body.position.y = 0.18;
    body.castShadow = true;
    this.group.add(body);
    this.head = new THREE.Group();
    this.head.position.y = 0.38;
    this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), feather);
    this.head.add(skull);
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffd24a, emissiveIntensity: 1.4, roughness: 0.3,
    });
    const eyeGeo = new THREE.SphereGeometry(0.032, 8, 6);
    this.eyeL = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.eyeL.position.set(-0.045, 0.02, 0.09);
    this.eyeR = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.eyeR.position.set(0.045, 0.02, 0.09);
    this.head.add(this.eyeL, this.eyeR);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), feather);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.03, 0.1);
    this.head.add(beak);
    const tuftGeo = new THREE.ConeGeometry(0.03, 0.08, 4);
    for (const ex of [-0.06, 0.06]) {
      const tuft = new THREE.Mesh(tuftGeo, feather);
      tuft.position.set(ex, 0.11, 0);
      this.head.add(tuft);
    }
    scene.add(this.group);
    this.perkTimer = 0;
  }

  perk() {
    this.perkTimer = 3;
  }

  update(t, dt) {
    this.perkTimer = Math.max(0, this.perkTimer - dt);
    if (this.perkTimer > 0) {
      // snap toward the porch, eyes wide
      this.head.rotation.y += (2.8 - this.head.rotation.y) * Math.min(1, dt * 6);
      this.eyeL.scale.setScalar(1.3);
      this.eyeR.scale.setScalar(1.3);
    } else {
      this.head.rotation.y = Math.sin(t * 0.3) * 1.1;
      this.eyeL.scale.setScalar(1);
      this.eyeR.scale.setScalar(1);
    }
  }
}

export class FairyRing {
  constructor(scene) {
    this.burstT = 0;
    this.capMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a1a, emissive: 0x7aff9a, emissiveIntensity: 0.5, roughness: 0.6,
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xb8ac98, roughness: 0.9 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 1.2 + rnd(-0.1, 0.1);
      const x = RING_POS.x + Math.cos(a) * r;
      const z = RING_POS.z + Math.sin(a) * r;
      const s = rnd(0.7, 1.3);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.09, 6), stemMat);
      stem.position.set(x, 0.045 * s, z);
      stem.scale.setScalar(s);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.capMat);
      cap.position.set(x, 0.09 * s, z);
      cap.scale.setScalar(s);
      scene.add(stem, cap);
    }
  }

  burst() {
    this.burstT = 2;
  }

  update(t, dt) {
    this.burstT = Math.max(0, this.burstT - dt);
    this.capMat.emissiveIntensity = 0.42 + Math.sin(t * 1.6) * 0.14 + (this.burstT > 0 ? 1.2 : 0);
  }
}
