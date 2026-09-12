import * as THREE from 'three';
import { rnd } from './utils.js';

// BISCUIT — a golden companion. Follows you, sniffs around while you sit,
// sleeps on his bed when you're on the couch, eats kibble, barks at thunder.
const BED_POS = new THREE.Vector3(-2.2, 0, 6.6);

export class Dog {
  constructor(scene) {
    const fur = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 1 });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1 });
    const noseM = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 });
    this.group = new THREE.Group();
    this.bodyInner = new THREE.Group();
    this.group.add(this.bodyInner);
    const B = this.bodyInner;
    const box = (mat, w, h, d, x, y, z, parent) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // torso + chest (forward = +Z)
    box(fur, 0.28, 0.3, 0.6, 0, 0.38, 0, B);
    box(fur, 0.3, 0.32, 0.25, 0, 0.38, 0.28, B);
    // head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.58, 0.42);
    B.add(this.head);
    box(fur, 0.24, 0.24, 0.24, 0, 0, 0, this.head);
    box(fur, 0.13, 0.12, 0.18, 0, -0.04, 0.18, this.head);
    box(noseM, 0.06, 0.05, 0.04, 0, -0.02, 0.28, this.head);
    this.earL = box(darkFur, 0.07, 0.18, 0.05, -0.13, 0.06, -0.02, this.head);
    this.earR = box(darkFur, 0.07, 0.18, 0.05, 0.13, 0.06, -0.02, this.head);
    this.earL.rotation.z = 0.25;
    this.earR.rotation.z = -0.25;
    // tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.48, -0.32);
    this.tail.rotation.x = -0.5;
    B.add(this.tail);
    box(fur, 0.07, 0.07, 0.3, 0, 0.08, -0.12, this.tail);
    // legs (pivot at the hip)
    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.09, 0.36, 0.09);
    legGeo.translate(0, -0.18, 0);
    for (const [lx, lz] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.2], [0.1, -0.2]]) {
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.set(lx, 0.36, lz);
      leg.castShadow = true;
      B.add(leg);
      this.legs.push(leg);
    }
    scene.add(this.group);

    this.pos = new THREE.Vector3(1.5, 0, 0.5);
    this.group.position.copy(this.pos);
    this.yaw = 0;
    this.mode = 'follow';
    this.wanderTarget = new THREE.Vector3(0, 0, -2);
    this.wanderTimer = 0;
    this.sniffTimer = 0;
    this.eatTimer = 0;
    this.phase = 0;
    this.wagBoost = 0;
    this.perkTimer = 0;
    this.vy = 0;
    this.airborne = false;
    this.onBark = null;
    this.onAte = null;
  }

  pet() {
    this.wagBoost = 3;
    if (this.onBark) this.onBark('happy');
  }

  startEat() {
    this.mode = 'eat';
    this.eatTimer = 0;
  }

  thunder() {
    if (!this.airborne) {
      this.airborne = true;
      this.vy = 2.4;
    }
    this.perkTimer = 2;
    if (this.onBark) this.onBark('alarm');
  }

  moveToward(target, speed, dt) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const want = Math.atan2(dx, dz);
    let dy = want - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 6);
    const step = Math.min(d, speed * dt);
    this.pos.x += Math.sin(this.yaw) * step;
    this.pos.z += Math.cos(this.yaw) * step;
    return d;
  }

  update(dt, t, playerPos, playerSeated, couchSeated, bowlPos, bowlFilled, collide) {
    if (this.mode === 'eat' && !bowlFilled) this.mode = 'follow';
    if (couchSeated && (this.mode === 'follow' || this.mode === 'wander')) this.mode = 'tobed';
    if (!couchSeated && (this.mode === 'sleep' || this.mode === 'tobed')) this.mode = 'follow';

    let walking = false;
    let headDown = 0;

    if (this.mode === 'eat' && bowlFilled) {
      const d = this.moveToward(bowlPos, 3.0, dt);
      if (d < 0.7) {
        headDown = 1;
        this.wagBoost = Math.max(this.wagBoost, 1.2);
        this.eatTimer += dt;
        if (this.eatTimer > 5) {
          this.mode = 'follow';
          if (this.onAte) this.onAte();
          if (this.onBark) this.onBark('happy');
        }
      } else {
        walking = true;
      }
    } else if (this.mode === 'tobed') {
      const d = this.moveToward(BED_POS, 2.0, dt);
      walking = d >= 0.5;
      if (d < 0.5) this.mode = 'sleep';
    } else if (this.mode === 'sleep') {
      headDown = 1;
      this.bodyInner.scale.y = 1 + Math.sin(t * 1.8) * 0.02;
    } else if (playerSeated) {
      // wander + sniff near the porch
      this.mode = 'wander';
      this.wanderTimer -= dt;
      if (this.sniffTimer > 0) {
        this.sniffTimer -= dt;
        headDown = 1;
      } else {
        const d = this.moveToward(this.wanderTarget, 1.0, dt);
        walking = d >= 0.4;
        if (d < 0.4 && this.wanderTimer <= 0) {
          this.wanderTimer = rnd(6, 12);
          this.wanderTarget.set(rnd(-6, 6), 0, rnd(-6, 4));
          if (Math.random() < 0.4) this.sniffTimer = 2;
        }
      }
    } else {
      this.mode = 'follow';
      const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      if (d > 2.2) {
        this.moveToward(playerPos, 3.2, dt);
        walking = true;
      } else if (d > 1.4) {
        this.moveToward(playerPos, 1.2, dt);
        walking = true;
      } else {
        // idle: face the player
        const want = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
        let dy = want - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 4);
      }
    }

    if (collide) collide(this.pos);
    if (this.airborne) {
      this.pos.y += this.vy * dt;
      this.vy -= 9.8 * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.airborne = false;
      }
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;

    // animation: legs, tail, ears, sit pose
    if (walking) this.phase += dt * 10;
    const sw = walking ? Math.sin(this.phase) * 0.6 : 0;
    this.legs[0].rotation.x += (sw - this.legs[0].rotation.x) * Math.min(1, dt * 10);
    this.legs[3].rotation.x += (sw - this.legs[3].rotation.x) * Math.min(1, dt * 10);
    this.legs[1].rotation.x += (-sw - this.legs[1].rotation.x) * Math.min(1, dt * 10);
    this.legs[2].rotation.x += (-sw - this.legs[2].rotation.x) * Math.min(1, dt * 10);
    this.wagBoost = Math.max(0, this.wagBoost - dt);
    const wagFast = this.wagBoost > 0;
    this.tail.rotation.y = Math.sin(t * (wagFast ? 14 : 6)) * (wagFast ? 0.5 : 0.22);
    this.perkTimer = Math.max(0, this.perkTimer - dt);
    const perk = this.perkTimer > 0 ? -0.5 : 0;
    this.earL.rotation.x += (perk - this.earL.rotation.x) * Math.min(1, dt * 8);
    this.earR.rotation.x += (perk - this.earR.rotation.x) * Math.min(1, dt * 8);
    const sitting = this.mode === 'sleep' || (!walking && (this.mode === 'wander' || this.mode === 'follow') && headDown === 0 && Math.random() < 0) ? 0 : 0;
    void sitting;
    const sitK = this.mode === 'sleep' ? 1 : 0;
    this.bodyInner.rotation.x += (-0.45 * sitK - this.bodyInner.rotation.x) * Math.min(1, dt * 5);
    this.bodyInner.position.y += (-0.1 * sitK - this.bodyInner.position.y) * Math.min(1, dt * 5);
    this.head.rotation.x += (0.55 * headDown - this.head.rotation.x) * Math.min(1, dt * 6);
  }
}
