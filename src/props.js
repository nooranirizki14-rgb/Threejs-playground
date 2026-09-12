import * as THREE from 'three';
import { makeCanvas } from './utils.js';

// Cabin wall + window + door, porch swing, guest chair, planters,
// expanded fence, stone paths, shed, bench overlook, firewood stack,
// dock with lantern, feature trees.
function glowTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,190,120,0.9)');
  grad.addColorStop(0.4, 'rgba(255,190,120,0.3)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Props {
  constructor(scene) {
    this.boxes = [];
    this.circles = [];
    const wood = new THREE.MeshStandardMaterial({ color: 0x2e2114, roughness: 0.95 });
    const midWood = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.9 });

    this.buildCabin(scene, wood);
    this.buildSwing(scene, midWood);
    this.buildGuestChair(scene, midWood);
    this.buildPlanters(scene);
    this.buildFence(scene, wood);
    this.buildStones(scene);
    this.buildShed(scene, wood);
    this.buildBench(scene, midWood);
    this.buildFirewood(scene, midWood);
    this.buildDock(scene, midWood);
    this.buildTrees(scene);
    this.lightsOn = true;
  }

  fenceRun(scene, mat, x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const ang = Math.atan2(dx, dz);
    for (const ry of [0.55, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, len), mat);
      rail.position.set(cx, ry, cz);
      rail.rotation.y = ang;
      scene.add(rail);
    }
    const n = Math.max(2, Math.round(len / 2));
    const postGeo = new THREE.BoxGeometry(0.14, 1.15, 0.14);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Mesh(postGeo, mat);
      p.position.set(x0 + dx * t, 0.57, z0 + dz * t);
      p.castShadow = true;
      scene.add(p);
    }
    this.boxes.push({
      x0: Math.min(x0, x1) - 0.12, x1: Math.max(x0, x1) + 0.12,
      z0: Math.min(z0, z1) - 0.12, z1: Math.max(z0, z1) + 0.12,
    });
  }

  buildCabin(scene, wood) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(15, 3.4, 0.3), wood);
    wall.position.set(0, 1.7, 5.6);
    wall.castShadow = true;
    scene.add(wall);
    // warm window
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.1), wood);
    frame.position.set(-2.5, 1.8, 5.42);
    scene.add(frame);
    this.windowMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffb45e, emissiveIntensity: 1.4, roughness: 0.4,
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), this.windowMat);
    pane.position.set(-2.5, 1.8, 5.36);
    pane.rotation.y = Math.PI;
    scene.add(pane);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.04), wood);
    mullV.position.set(-2.5, 1.8, 5.34);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.04), wood);
    mullH.position.set(-2.5, 1.8, 5.34);
    scene.add(mullV, mullH);
    this.windowGlowMat = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(this.windowGlowMat);
    glow.scale.set(3.2, 2.4, 1);
    glow.position.set(-2.5, 1.8, 5.2);
    scene.add(glow);
    // door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 2.25, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 })
    );
    door.position.set(2.5, 1.24, 5.42);
    scene.add(door);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xb89a5a, metalness: 0.8, roughness: 0.3 })
    );
    knob.position.set(2.12, 1.2, 5.33);
    scene.add(knob);
  }

  buildSwing(scene, mat) {
    const g = new THREE.Group();
    g.position.set(3.6, 2.93, 3.4);
    const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1 });
    for (const lx of [-0.55, 0.55]) {
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set(lx, -1.1, 0);
      g.add(rope);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.45), mat);
    bench.position.set(0, -2.2, 0);
    bench.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 0.05), mat);
    back.position.set(0, -1.9, 0.22);
    g.add(bench, back);
    scene.add(g);
    this.swing = g;
    this.circles.push({ x: 3.6, z: 3.4, r: 0.85 });
  }

  buildGuestChair(scene, mat) {
    const g = new THREE.Group();
    g.position.set(-3.6, 0.12, 3.4);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.48), mat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    g.add(seat);
    const legGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.44, 8);
    for (const [lx, lz] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx, 0.22, lz);
      g.add(leg);
    }
    for (const lx of [-0.22, 0.22]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), mat);
      post.position.set(lx, 0.74, 0.21);
      g.add(post);
    }
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.04), mat);
    slat.position.set(0, 0.9, 0.21);
    g.add(slat);
    scene.add(g);
    this.circles.push({ x: -3.6, z: 3.4, r: 0.55 });
  }

  buildPlanters(scene) {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d4023, roughness: 1 });
    for (const px of [-5, 5]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.34), boxMat);
      box.position.set(px, 0.35, 4.55);
      box.castShadow = true;
      scene.add(box);
      for (let i = 0; i < 4; i++) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leafMat);
        blob.position.set(px - 0.45 + i * 0.3, 0.58, 4.55);
        scene.add(blob);
      }
      this.circles.push({ x: px, z: 4.55, r: 0.65 });
    }
  }

  buildFence(scene, wood) {
    this.fenceRun(scene, wood, -18, -20, -1.2, -20);
    this.fenceRun(scene, wood, 1.2, -20, 18, -20);
    this.fenceRun(scene, wood, -18, -20, -18, 10);
    this.fenceRun(scene, wood, 18, -20, 18, 10);
    this.fenceRun(scene, wood, -18, 10, 18, 10);
  }

  buildStones(scene) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 1 });
    const geo = new THREE.CylinderGeometry(0.45, 0.5, 0.08, 9);
    const spots = [];
    for (let i = 0; i < 7; i++) {
      spots.push([0.4 + (i % 2 === 0 ? -0.15 : 0.15), -4.5 - i * 2.3]); // porch -> gate
    }
    spots.push([-1.5, -9.5], [-3, -10.5], [-4.5, -11.5], [-6, -12.3], [-7.2, -12.8]); // -> campfire
    spots.push([3, -12], [6, -13.5], [9, -14.5], [11.5, -15]); // -> bench
    spots.forEach(([x, z], i) => {
      const s = new THREE.Mesh(geo, mat);
      s.position.set(x, 0.04, z);
      s.rotation.y = i * 0.7;
      s.receiveShadow = true;
      scene.add(s);
    });
  }

  buildShed(scene, wood) {
    const g = new THREE.Group();
    g.position.set(-14.5, 0, -17.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.5), wood);
    body.position.y = 1.1;
    body.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x1c150c, roughness: 1 })
    );
    roof.position.y = 2.8;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.7, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 })
    );
    door.position.set(-0.5, 0.85, 1.26);
    this.shedMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffb45e, emissiveIntensity: 1.0, roughness: 0.4,
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), this.shedMat);
    win.position.set(0.7, 1.4, 1.26);
    g.add(body, roof, door, win);
    scene.add(g);
    this.boxes.push({ x0: -16.2, x1: -12.8, z0: -19, z1: -16 });
  }

  buildBench(scene, mat) {
    const g = new THREE.Group();
    g.position.set(13.5, 0, -15.5);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.45), mat);
    seat.position.y = 0.5;
    seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), mat);
    back.position.set(0, 0.85, 0.22);
    const legGeo = new THREE.BoxGeometry(0.07, 0.5, 0.4);
    for (const lx of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx, 0.25, 0);
      g.add(leg);
    }
    g.add(seat, back);
    scene.add(g);
    // lantern post beside the bench
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), mat);
    pole.position.set(14.5, 0.8, -15.5);
    scene.add(pole);
    this.benchMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffb45e, emissiveIntensity: 2, roughness: 0.4,
    });
    const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), this.benchMat);
    lampBox.position.set(14.5, 1.65, -15.5);
    scene.add(lampBox);
    this.benchGlowMat = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(this.benchGlowMat);
    glow.scale.set(1.4, 1.4, 1);
    glow.position.set(14.5, 1.65, -15.5);
    scene.add(glow);
    this.benchLight = new THREE.PointLight(0xffb45e, 6, 9, 2);
    this.benchLight.position.set(14.5, 1.65, -15.5);
    scene.add(this.benchLight);
    this.circles.push({ x: 13.5, z: -15.5, r: 0.95 });
    this.circles.push({ x: 14.5, z: -15.5, r: 0.25 });
  }

  buildFirewood(scene, mat) {
    const g = new THREE.Group();
    g.position.set(9.5, 0, 7.8);
    const logGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.1, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 1 });
    let row = 0;
    for (let layer = 0; layer < 3; layer++) {
      const count = 4 - layer;
      for (let i = 0; i < count; i++) {
        const log = new THREE.Mesh(logGeo, logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.12 + layer * 0.2, (i - (count - 1) / 2) * 0.24);
        log.castShadow = true;
        g.add(log);
      }
      row++;
    }
    void row;
    const tarp = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.06, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 1 })
    );
    tarp.position.y = 0.72;
    g.add(tarp);
    scene.add(g);
    this.circles.push({ x: 9.5, z: 7.8, r: 0.85 });
  }

  buildDock(scene, mat) {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x3d2c1b, roughness: 0.95 });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 12), deckMat);
    dock.position.set(0, 0.3, -28);
    dock.receiveShadow = true;
    scene.add(dock);
    const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8);
    for (const [px, pz] of [[-0.8, -22.6], [0.8, -22.6], [-0.8, -28], [0.8, -28], [-0.8, -33.4], [0.8, -33.4]]) {
      const p = new THREE.Mesh(postGeo, mat);
      p.position.set(px, -0.1, pz);
      scene.add(p);
    }
    // side rails + end rail colliders (the corridor is |x| < 0.75)
    this.boxes.push({ x0: 0.75, x1: 1.2, z0: -34.4, z1: -21.8 });
    this.boxes.push({ x0: -1.2, x1: -0.75, z0: -34.4, z1: -21.8 });
    this.boxes.push({ x0: -1.2, x1: 1.2, z0: -34.6, z1: -34.1 });
    // water blockers: past the shore only the dock corridor is walkable
    this.boxes.push({ x0: -13, x1: -0.75, z0: -35, z1: -22 });
    this.boxes.push({ x0: 0.75, x1: 13, z0: -35, z1: -22 });
    // lantern post at the end
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 8), mat);
    pole.position.set(0.55, 1.1, -33.2);
    scene.add(pole);
    this.lanternMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffb45e, emissiveIntensity: 2, roughness: 0.4,
    });
    const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), this.lanternMat);
    lampBox.position.set(0.55, 1.7, -33.2);
    scene.add(lampBox);
    this.lanternGlowMat = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(this.lanternGlowMat);
    glow.scale.set(1.6, 1.6, 1);
    glow.position.set(0.55, 1.7, -33.2);
    scene.add(glow);
    this.lantern = new THREE.PointLight(0xffb45e, 10, 12, 2);
    this.lantern.position.set(0.55, 1.7, -33.2);
    scene.add(this.lantern);
  }

  buildTrees(scene) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x0e2013, roughness: 1 });
    const spots = [[-9, -12], [10, -16], [-15, -8], [15.5, -6], [-14, 4], [12, 6], [6, 8.5]];
    for (const [tx, tz] of spots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), trunkMat);
      trunk.position.set(tx, 1.1, tz);
      trunk.castShadow = true;
      scene.add(trunk);
      const layers = [[1.8, 1.6, 1.8], [1.4, 1.5, 2.9], [1.0, 1.4, 3.9]];
      for (const [r, h, y] of layers) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leafMat);
        cone.position.set(tx, y, tz);
        cone.castShadow = true;
        scene.add(cone);
      }
      this.circles.push({ x: tx, z: tz, r: 0.6 });
    }
  }

  setLights(on) {
    this.lightsOn = on;
    this.windowMat.emissiveIntensity = on ? 1.4 : 0;
    this.windowGlowMat.opacity = on ? 0.4 : 0;
    this.lanternMat.emissiveIntensity = on ? 2 : 0;
    this.lanternGlowMat.opacity = on ? 0.55 : 0;
    this.lantern.visible = on;
    this.benchMat.emissiveIntensity = on ? 2 : 0;
    this.benchGlowMat.opacity = on ? 0.5 : 0;
    this.benchLight.visible = on;
    this.shedMat.emissiveIntensity = on ? 1.0 : 0;
  }

  update(t) {
    this.swing.rotation.x = Math.sin(t * 0.6) * 0.05;
  }
}
