import * as THREE from 'three';
import { clamp, fmtRp } from './utils.js';

// Lone hitchhikers on the shoulder. Stop, pick them up on foot,
// drop them at their station for a tip. Pure cozy side-income.
const DEST_NAMES = {
  mart: 'Mart 24H',
  motel: 'Motel Melati',
  diner: 'Warkop Diner',
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(125,255,106,0.9)');
  grad.addColorStop(0.4, 'rgba(125,255,106,0.35)');
  grad.addColorStop(1, 'rgba(125,255,106,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Hitchhikers {
  constructor(scene) {
    this.group = new THREE.Group();
    const coat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.75, 4, 10),
      new THREE.MeshStandardMaterial({
        color: 0xc9a227, roughness: 0.55, emissive: 0x2a2005,
      })
    );
    coat.position.y = 0.9;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 })
    );
    head.position.y = 1.68;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x7dff6a, side: THREE.DoubleSide })
    );
    sign.position.set(0, 1.25, 0.42);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(2.4, 2.4, 1);
    glow.position.y = 1.2;
    this.group.add(coat, head, sign, glow);
    this.sign = sign;
    this.group.rotation.y = Math.PI / 2; // face the road
    this.group.visible = false;
    scene.add(this.group);

    this.state = 'cooldown'; // waiting | aboard | cooldown
    this.coolT = 25;
    this.x = 0;
    this.z = 0;
    this.fromZ = 0;
    this.destZ = 0;
    this.destName = '';
    this.tip = 0;
    this.bobT = 0;
  }

  info() {
    return {
      state: this.state,
      x: this.x,
      z: this.z,
      destZ: this.destZ,
      destName: this.destName,
      tip: this.tip,
    };
  }

  update(dt, pz, stations) {
    this.bobT += dt;
    if (this.state === 'waiting') {
      this.group.position.y = Math.abs(Math.sin(this.bobT * 2.2)) * 0.06;
      this.sign.position.y = 1.25 + Math.sin(this.bobT * 3.1) * 0.09;
      // player drove past? relocate further ahead
      if (pz < this.z - 120) this.spawn(pz, stations);
    } else if (this.state === 'cooldown') {
      this.coolT -= dt;
      if (this.coolT <= 0) this.spawn(pz, stations);
    }
  }

  spawn(pz, stations) {
    const list = stations.aheadList(pz, 4);
    if (!list.length) {
      this.coolT = 20;
      return;
    }
    // wait on the shoulder ~80 m before the next station
    const st = list[0];
    this.x = -7.4;
    this.z = st.z - 80;
    this.group.position.set(this.x, 0, this.z);
    this.group.visible = true;
    this.state = 'waiting';
    this.destZ = 0;
    this.destName = '';
  }

  // called when the player picks them up on foot
  pickUp(pz, stations) {
    if (this.state !== 'waiting') return null;
    const list = stations.aheadList(pz, 6);
    // destination: 2.5–6 km ahead
    const cands = list.filter((s) => pz - s.z > 2200 && pz - s.z < 6500);
    const dest = cands.length ? cands[0] : list[list.length - 1];
    if (!dest) return null;
    this.state = 'aboard';
    this.group.visible = false;
    this.fromZ = pz;
    this.destZ = dest.z;
    this.destName = DEST_NAMES[dest.flavor] || 'SPBU';
    const distKm = (this.fromZ - this.destZ) / 1000;
    this.tip = Math.round((60000 + distKm * 14000) / 5000) * 5000;
    return { destName: this.destName, tip: this.tip };
  }

  // near the destination with the car?
  nearDrop(carX, carZ) {
    if (this.state !== 'aboard') return false;
    return Math.abs(carZ - this.destZ) < 40 && carX < -8 && carX > -30;
  }

  dropOff() {
    if (this.state !== 'aboard') return 0;
    const tip = this.tip;
    this.state = 'cooldown';
    this.coolT = 90 + Math.random() * 90;
    this.tip = 0;
    this.destName = '';
    return tip;
  }

  tipPreview() {
    return this.state === 'aboard' ? fmtRp(this.tip) : '';
  }

  nearWaiting(px, pz, r) {
    if (this.state !== 'waiting') return false;
    return Math.hypot(px - this.x, pz - this.z) < r;
  }

  progress(pz) {
    // 0..1 journey progress while aboard (for the passenger chip)
    if (this.state !== 'aboard') return 0;
    const total = Math.max(1, this.fromZ - this.destZ);
    return clamp((this.fromZ - pz) / total, 0, 1);
  }
}
