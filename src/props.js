import * as THREE from 'three';
import { makeCanvas } from './utils.js';

// Cabin wall + window + door, porch swing, guest chair, planters,
// fence, stepping stones, dock with lantern, feature trees.
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
    this.fenceRun(scene, wood, -12, -20, -1.2, -20);
    this.fenceRun(scene, wood, 1.2, -20, 12, -20);
    this.fenceRun(scene, wood, -12, -20, -12, 6);
    this.fenceRun(scene, wood, 12, -20, 12, 6);
  }

  buildStones(scene) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 1 });
    const geo = new THREE.CylinderGeometry(0.45, 0.5, 0.08, 9);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(geo, mat);
      s.position.set(0.4 + (i % 2 === 0 ? -0.15 : 0.15), 0.04, -4.5 - i * 2.3);
      s.rotation.y = i * 0.7;
      s.receiveShadow = true;
      scene.add(s);
    }
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
    for (const [tx, tz] of [[-9, -12], [10, -16]]) {
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
  }

  update(t) {
    this.swing.rotation.x = Math.sin(t * 0.6) * 0.05;
  }
}
