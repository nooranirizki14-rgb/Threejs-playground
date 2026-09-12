import * as THREE from 'three';
import { makeGlowSprite } from './textures.js';
import { LANES_ME, LANES_ON } from './road.js';
import { rnd, pick } from './utils.js';

// Ambient AI traffic: same-direction + oncoming, brake lights, honks.
const COLORS = [0xd8dce8, 0x1a1d26, 0x7a1f24, 0x1f3a7a, 0xc8c8c8, 0x2a2a30];

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.glowTex = makeGlowSprite({});
    this.cars = [];
    this.honkCooldown = 0;
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.62, 4.5);
    const skirtGeo = new THREE.BoxGeometry(1.7, 0.34, 4.35);
    const cabGeo = new THREE.BoxGeometry(1.6, 0.5, 2.2);
    const barGeo = new THREE.BoxGeometry(1.5, 0.14, 0.08);
    for (let i = 0; i < 14; i++) {
      const same = i < 8;
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color: pick(COLORS), metalness: 0.6, roughness: 0.5,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.62;
      g.add(body);
      const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 1 }));
      skirt.position.y = 0.3;
      g.add(skirt);
      const cab = new THREE.Mesh(cabGeo, new THREE.MeshStandardMaterial({ color: 0x05070d, metalness: 0.8, roughness: 0.3 }));
      cab.position.set(0, 1.12, same ? 0.2 : -0.2);
      g.add(cab);
      // light bars face travel direction
      const front = same ? -1 : 1;
      const hl = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.8) }));
      hl.position.set(0, 0.68, front * 2.28);
      g.add(hl);
      const tl = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.12, 0.12) }));
      tl.position.set(0, 0.72, -front * 2.28);
      g.add(tl);
      const hg = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xfff2d8, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      hg.scale.set(3.4, 1.6, 1);
      hg.position.set(0, 0.68, front * 2.4);
      g.add(hg);
      const tg = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xff2020, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      tg.scale.set(2.6, 1.1, 1);
      tg.position.set(0, 0.72, -front * 2.4);
      g.add(tg);
      scene.add(g);
      const car = {
        g, same,
        lane: same ? rnd() < 0.5 ? 0 : 1 : rnd() < 0.5 ? 0 : 1,
        speed: same ? rnd(19, 30) : rnd(22, 30),
        cruise: 0,
        brake: 0,
        tlMat: tl.material,
      };
      car.cruise = car.speed;
      this.respawn(car, rnd(-320, 60), true);
      this.cars.push(car);
    }
  }

  laneX(car) {
    return car.same ? LANES_ME[car.lane] : LANES_ON[car.lane];
  }

  respawn(car, pz, initial = false) {
    // spawn ahead of the player (either travel direction)
    car.g.position.z = initial ? pz - rnd(0, 320) : pz - 280 - rnd(0, 90);
    car.g.position.x = this.laneX(car);
    car.speed = car.cruise = car.same ? rnd(19, 30) : rnd(22, 30);
  }

  update(dt, pz, player) {
    // player: {x, z, speed, lane}
    this.honkCooldown -= dt;
    let honk = false;
    const list = [];
    for (const car of this.cars) {
      const dir = car.same ? -1 : 1; // z velocity sign
      let target = car.cruise;
      // brake for player ahead in same lane
      if (car.same) {
        const myLaneX = this.laneX(car);
        if (Math.abs(player.x - myLaneX) < 1.6) {
          const dz = car.g.position.z - player.z; // >0 means player ahead (smaller z)
          if (dz > 0 && dz < 42) {
            target = Math.min(target, Math.max(0, player.speed + (dz - 10) * 0.5));
            if (dz < 13 && player.speed < 9 && this.honkCooldown <= 0) {
              honk = true;
              this.honkCooldown = 4;
            }
          }
        }
        // don't pass through each other in the same lane
        for (const o of this.cars) {
          if (o === car || !o.same || o.lane !== car.lane) continue;
          const dz = car.g.position.z - o.g.position.z;
          if (dz > 0 && dz < 26) target = Math.min(target, o.speed);
        }
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
      car.g.position.z += dir * car.speed * dt;
      car.brake = target < car.speed - 1 ? 1 : 0;
      car.tlMat.color.setRGB(car.brake ? 3.2 : 1.8, 0.12, 0.12);

      const z = car.g.position.z;
      if (z - pz > 70 || z - pz < -340) this.respawn(car, pz);
      list.push({ x: car.g.position.x, z: car.g.position.z, same: car.same, speed: car.speed });
    }
    return { list, honk };
  }
}
