import * as THREE from 'three';
import { makeCanvas } from './utils.js';
import { makeWood, addAO } from './textures.js';

// Porch life: toggleable radio, midnight noodle bowl (refills!), dog kibble bowl.
export const RADIO_POS = new THREE.Vector3(-2.6, 0.12, 3.3);
export const NOODLE_POS = new THREE.Vector3(-2.6, 0.12, 1.5);
export const BOWL_POS = new THREE.Vector3(1.8, 0.12, -2.2);

function steamTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(220,220,225,0.4)');
  grad.addColorStop(1, 'rgba(220,220,225,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class PorchLife {
  constructor(scene) {
    this.circles = [];
    this.radioOn = false;
    this.noodlesEaten = false;
    this.noodleTimer = 0;
    this.bowlFilled = false;
    this.onRefill = null;
    const stoolTex = makeWood({ base: '#4a3421', dark: '#201204', planks: 2, gaps: false, weather: 0.2 });
    const stoolMat = new THREE.MeshStandardMaterial({ ...stoolTex, roughness: 0.9 });

    const stool = (x, z) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), stoolMat);
      top.position.set(x, 0.57, z);
      top.castShadow = true;
      scene.add(top);
      const legGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
      for (const [lx, lz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) {
        const leg = new THREE.Mesh(legGeo, stoolMat);
        leg.position.set(x + lx, 0.345, z + lz);
        scene.add(leg);
      }
    };

    // radio stool + radio
    stool(RADIO_POS.x, RADIO_POS.z);
    const radioMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1c, roughness: 0.6 });
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.2), radioMat);
    radio.position.set(RADIO_POS.x, 0.73, RADIO_POS.z);
    radio.castShadow = true;
    scene.add(radio);
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.9 });
    for (const gx of [-0.1, 0.1]) {
      const grill = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), grillMat);
      grill.rotation.x = Math.PI / 2;
      grill.position.set(RADIO_POS.x + gx, 0.72, RADIO_POS.z - 0.105);
      scene.add(grill);
    }
    this.dialMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f0a, emissive: 0x51ff7a, emissiveIntensity: 0, roughness: 0.4,
    });
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), this.dialMat);
    dial.position.set(RADIO_POS.x, 0.82, RADIO_POS.z - 0.101);
    dial.rotation.y = Math.PI;
    scene.add(dial);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.9, roughness: 0.3 })
    );
    antenna.position.set(RADIO_POS.x + 0.16, 1.1, RADIO_POS.z + 0.03);
    antenna.rotation.z = -0.25;
    scene.add(antenna);
    addAO(scene, RADIO_POS.x, 0.145, RADIO_POS.z, 0.8, 0.7, 0.7);
    this.circles.push({ x: RADIO_POS.x, z: RADIO_POS.z, r: 0.4 });

    // noodle stool + bowl + chopsticks + steam
    stool(NOODLE_POS.x, NOODLE_POS.z);
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.09, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8e2e8, roughness: 0.3 })
    );
    bowl.position.set(NOODLE_POS.x, 0.645, NOODLE_POS.z);
    bowl.castShadow = true;
    scene.add(bowl);
    this.noodles = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.028, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 0.7 })
    );
    this.noodles.rotation.x = Math.PI / 2;
    this.noodles.position.set(NOODLE_POS.x, 0.69, NOODLE_POS.z);
    scene.add(this.noodles);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xa8824a, roughness: 0.8 });
    for (const off of [-0.02, 0.02]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), stickMat);
      stick.rotation.z = Math.PI / 2;
      stick.rotation.y = 0.25;
      stick.position.set(NOODLE_POS.x, 0.71, NOODLE_POS.z + off);
      scene.add(stick);
    }
    this.steamMat = new THREE.SpriteMaterial({
      map: steamTexture(), transparent: true, opacity: 0.25, depthWrite: false,
    });
    this.steam = new THREE.Sprite(this.steamMat);
    this.steam.scale.set(0.18, 0.18, 1);
    this.steam.position.set(NOODLE_POS.x, 0.8, NOODLE_POS.z);
    scene.add(this.steam);
    addAO(scene, NOODLE_POS.x, 0.145, NOODLE_POS.z, 0.8, 0.7, 0.7);
    this.circles.push({ x: NOODLE_POS.x, z: NOODLE_POS.z, r: 0.4 });

    // dog kibble bowl near the steps
    const dbowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.12, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a2020, metalness: 0.3, roughness: 0.5 })
    );
    dbowl.position.set(BOWL_POS.x, 0.18, BOWL_POS.z);
    dbowl.castShadow = true;
    scene.add(dbowl);
    this.kibble = new THREE.Group();
    const kibMat = new THREE.MeshStandardMaterial({ color: 0x6a4a22, roughness: 1 });
    const kibGeo = new THREE.BoxGeometry(0.035, 0.03, 0.035);
    for (let i = 0; i < 9; i++) {
      const k = new THREE.Mesh(kibGeo, kibMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.11;
      k.position.set(BOWL_POS.x + Math.cos(a) * r, 0.25, BOWL_POS.z + Math.sin(a) * r);
      k.rotation.y = Math.random() * 3;
      this.kibble.add(k);
    }
    this.kibble.visible = false;
    scene.add(this.kibble);
    addAO(scene, BOWL_POS.x, 0.145, BOWL_POS.z, 0.6, 0.6, 0.7);
    this.circles.push({ x: BOWL_POS.x, z: BOWL_POS.z, r: 0.3 });
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    this.dialMat.emissiveIntensity = this.radioOn ? 1.5 : 0;
    return this.radioOn;
  }

  fillBowl() {
    this.bowlFilled = true;
    this.kibble.visible = true;
  }

  emptyBowl() {
    this.bowlFilled = false;
    this.kibble.visible = false;
  }

  eatNoodles() {
    this.noodlesEaten = true;
    this.noodleTimer = 90;
    this.noodles.visible = false;
  }

  update(t, dt) {
    if (this.noodlesEaten) {
      this.noodleTimer -= dt;
      if (this.noodleTimer <= 0) {
        this.noodlesEaten = false;
        this.noodles.visible = true;
        if (this.onRefill) this.onRefill();
      }
    }
    this.steam.visible = !this.noodlesEaten;
    if (!this.noodlesEaten) {
      const p = (t * 0.25) % 1;
      this.steam.position.y = 0.78 + p * 0.4;
      this.steam.position.x = NOODLE_POS.x + Math.sin(p * 5) * 0.03;
      const sc = 0.14 + p * 0.16;
      this.steam.scale.set(sc, sc, 1);
      this.steamMat.opacity = Math.sin(p * Math.PI) * 0.28;
    }
    if (this.radioOn) {
      this.dialMat.emissiveIntensity = 1.4 + Math.sin(t * 7) * 0.15;
    }
  }
}
