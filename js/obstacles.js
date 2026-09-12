import * as THREE from 'three';
import { LANES } from './player.js';

// Shared geometry / materials — spawned obstacles are cheap wrappers.
const GEO = {
  low: new THREE.BoxGeometry(1.9, 1.0, 0.6),
  high: new THREE.BoxGeometry(1.9, 1.5, 0.6),
  wall: new THREE.BoxGeometry(2.1, 3.2, 0.8),
  coin: new THREE.TorusGeometry(0.34, 0.13, 10, 22),
};
const EDGE = {
  low: new THREE.EdgesGeometry(GEO.low),
  high: new THREE.EdgesGeometry(GEO.high),
  wall: new THREE.EdgesGeometry(GEO.wall),
};
const MAT = {
  low: new THREE.MeshStandardMaterial({
    color: 0x2a0a00, emissive: 0xff4400, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.6,
  }),
  high: new THREE.MeshStandardMaterial({
    color: 0x1a0530, emissive: 0x9d00ff, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.6,
  }),
  wall: new THREE.MeshStandardMaterial({
    color: 0x2a0016, emissive: 0xff0f5f, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6,
  }),
  coin: new THREE.MeshStandardMaterial({
    color: 0xffc93c, emissive: 0xa86a00, emissiveIntensity: 0.9, metalness: 1.0, roughness: 0.25,
  }),
};
const EMAT = {
  low: new THREE.LineBasicMaterial({ color: 0xffd166 }),
  high: new THREE.LineBasicMaterial({ color: 0xe0aaff }),
  wall: new THREE.LineBasicMaterial({ color: 0xff8fb3 }),
};

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.spawnIn = 25;
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.group);
    this.items.length = 0;
    // pre-populate the track so the action starts within ~3 seconds
    this.spawnRow(18, -50);
    this.spawnRow(18, -85);
    this.spawnRow(18, -120);
    this.spawnIn = 25;
  }

  addItem(group, type, lane, z, extra = {}) {
    group.position.z = z;
    if (lane !== null && lane !== undefined) group.position.x = LANES[lane];
    this.scene.add(group);
    const item = {
      group, type, lane, z,
      hit: false, vx: 0, vy: 0, vz: 0,
      spin: new THREE.Vector3(),
      ...extra,
    };
    this.items.push(item);
    return item;
  }

  addBarrier(type, lane, z) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(GEO[type], MAT[type]);
    mesh.castShadow = true;
    const edge = new THREE.LineSegments(EDGE[type], EMAT[type]);
    const y = type === 'low' ? 0.5 : type === 'high' ? 1.65 : 1.6;
    mesh.position.y = y;
    edge.position.y = y;
    g.add(mesh, edge);
    this.addItem(g, type, lane, z);
  }

  addCoin(lane, z) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(GEO.coin, MAT.coin);
    m.position.y = 0.85;
    g.add(m);
    this.addItem(g, 'coin', lane, z, { mesh: m, phase: Math.random() * Math.PI * 2 });
  }

  // Every pattern leaves at least one survivable option.
  spawnRow(speed, z = -135) {
    const roll = Math.random();
    let gap;
    if (roll < 0.3) {
      // coin run
      const lane = (Math.random() * 3) | 0;
      const n = 4 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) this.addCoin(lane, z - i * 3.2);
      gap = 26 + Math.random() * 8;
    } else if (roll < 0.52) {
      // jump/slide barriers in 1–2 lanes
      const order = shuffle([0, 1, 2]);
      const count = Math.random() < 0.55 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        this.addBarrier(Math.random() < 0.5 ? 'low' : 'high', order[i], z);
      }
      if (count === 2 && Math.random() < 0.7) {
        for (let i = 0; i < 3; i++) this.addCoin(order[2], z - 4 - i * 3);
      }
      gap = 24 + Math.random() * 10;
    } else if (roll < 0.74) {
      // wall with a single gap lane
      const gapLane = (Math.random() * 3) | 0;
      for (let l = 0; l < 3; l++) if (l !== gapLane) this.addBarrier('wall', l, z);
      if (Math.random() < 0.8) {
        for (let i = 0; i < 3; i++) this.addCoin(gapLane, z - 5 - i * 3);
      }
      gap = 30 + Math.random() * 10;
    } else {
      // slalom: low in one lane, high in another, coins in the free lane
      const order = shuffle([0, 1, 2]);
      this.addBarrier('low', order[0], z);
      this.addBarrier('high', order[1], z);
      for (let i = 0; i < 3; i++) this.addCoin(order[2], z - 4 - i * 3);
      gap = 28 + Math.random() * 10;
    }
    // guarantee minimum reaction time at any speed
    this.spawnIn = Math.max(gap, speed * 0.8);
  }

  // crash physics: the thing you hit goes flying
  knock(item, px) {
    item.hit = true;
    item.vx = (item.group.position.x - px) * 1.5 + (Math.random() - 0.5) * 4;
    item.vy = 7 + Math.random() * 4;
    item.vz = 10 + Math.random() * 4;
    item.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
  }

  update(dt, speed, player, hooks, collidable) {
    if (speed > 1) {
      this.spawnIn -= speed * dt;
      if (this.spawnIn <= 0) this.spawnRow(speed);
    }

    const px = player.group.position.x;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];

      if (it.hit) {
        it.vy -= 22 * dt;
        it.group.position.x += it.vx * dt;
        it.group.position.y += it.vy * dt;
        it.group.position.z += (it.vz + speed * 0.5) * dt;
        it.group.rotation.x += it.spin.x * dt;
        it.group.rotation.y += it.spin.y * dt;
        it.group.rotation.z += it.spin.z * dt;
        if (it.group.position.y < -6 || it.group.position.z > 20) {
          this.scene.remove(it.group);
          this.items.splice(i, 1);
        }
        continue;
      }

      it.z += speed * dt;
      it.group.position.z = it.z;

      if (it.type === 'coin') {
        it.mesh.rotation.y += 4 * dt;
        it.mesh.position.y = 0.85 + Math.sin(performance.now() * 0.005 + it.phase) * 0.12;
        if (collidable && Math.abs(it.z) < 1.6 && Math.abs(it.group.position.x - px) < 1.1) {
          const dy = Math.abs(0.85 - (player.bottom + 0.7));
          if (dy < 1.5) {
            hooks.coin(it.group.position.clone());
            this.scene.remove(it.group);
            this.items.splice(i, 1);
            continue;
          }
        }
      } else if (collidable && Math.abs(it.z) < 1.25 && Math.abs(it.group.position.x - px) < 1.0) {
        let crash = false;
        if (it.type === 'low') crash = player.bottom < 0.95;                    // must jump
        else if (it.type === 'high') crash = player.bottom < 2.3 && player.top > 0.95; // must slide
        else if (it.type === 'wall') crash = true;                              // must be in gap
        if (crash) {
          this.knock(it, px);
          hooks.crash(it.group.position.clone());
          collidable = false; // one crash per frame max
        }
      }

      if (it.z > 14) {
        this.scene.remove(it.group);
        this.items.splice(i, 1);
      }
    }
  }
}
