import * as THREE from 'three';
import { makeCanvas } from './utils.js';

// Wooden porch: deck, posts, roof, railing, hanging lamp, side table, chair.
// Deck spans x -7..7, z -3..5. Chair at (0, 0.12, 2.6) facing -Z (the lake).
export const CHAIR_POS = { x: 0, z: 2.6 };
export const SEAT_TOP = 0.57;

function woodTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#4a3421';
  ctx.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 8; p++) {
    const y = p * 32;
    ctx.fillStyle = `rgba(0,0,0,${0.12 + (p % 2) * 0.08})`;
    ctx.fillRect(0, y, 256, 32);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(256, y + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gy = y + 5 + Math.random() * 24;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(80, gy + 2, 170, gy - 2, 256, gy + 1);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2.5);
  return t;
}

function glowTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,200,130,0.9)');
  grad.addColorStop(0.4, 'rgba(255,200,130,0.3)');
  grad.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Porch {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];   // railing AABB colliders {x0,x1,z0,z1}
    this.circles = []; // furniture circle colliders {x,z,r}
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });

    // deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 8), wood);
    deck.position.set(0, 0.06, 1);
    deck.receiveShadow = true;
    scene.add(deck);

    // posts + roof
    const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 2.9, 8);
    for (const [px, pz] of [[-6.5, -2.5], [6.5, -2.5], [-6.5, 4.5], [6.5, 4.5]]) {
      const p = new THREE.Mesh(postGeo, darkWood);
      p.position.set(px, 1.45, pz);
      p.castShadow = true;
      scene.add(p);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.14, 9.6), darkWood);
    roof.position.set(0, 3.0, 1);
    scene.add(roof);

    // railing runs (with a gap at front center = walkway to the yard)
    this.railRun(scene, darkWood, -7, 4.9, 7, 4.9);       // back
    this.railRun(scene, darkWood, -6.9, -3, -6.9, 5);     // left
    this.railRun(scene, darkWood, 6.9, -3, 6.9, 5);       // right
    this.railRun(scene, darkWood, -7, -2.9, -1.6, -2.9);  // front left
    this.railRun(scene, darkWood, 1.6, -2.9, 7, -2.9);    // front right

    this.buildLamp(scene);
    this.buildTable(scene, darkWood);
    this.buildChair(scene, wood);
  }

  railRun(scene, mat, x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const ang = Math.atan2(dx, dz);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, len), mat);
    top.position.set(cx, 1.05, cz);
    top.rotation.y = ang;
    top.castShadow = true;
    scene.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, len), mat);
    bot.position.set(cx, 0.25, cz);
    bot.rotation.y = ang;
    scene.add(bot);
    const n = Math.max(2, Math.floor(len / 0.7));
    const balGeo = new THREE.BoxGeometry(0.05, 0.8, 0.05);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const b = new THREE.Mesh(balGeo, mat);
      b.position.set(x0 + dx * t, 0.65, z0 + dz * t);
      scene.add(b);
    }
    this.boxes.push({
      x0: Math.min(x0, x1) - 0.12, x1: Math.max(x0, x1) + 0.12,
      z0: Math.min(z0, z1) - 0.12, z1: Math.max(z0, z1) + 0.12,
    });
  }

  buildLamp(scene) {
    const g = new THREE.Group();
    g.position.set(0, 0, 0.5);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    cord.position.y = 2.65;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.24, 14, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x1d3025, roughness: 0.6, side: THREE.DoubleSide,
      })
    );
    shade.position.y = 2.3;
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 1.0) });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), this.bulbMat);
    bulb.position.y = 2.22;
    this.glowMat = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(this.glowMat);
    glow.scale.set(1.4, 1.4, 1);
    glow.position.y = 2.22;
    g.add(cord, shade, bulb, glow);
    scene.add(g);

    this.lamp = new THREE.PointLight(0xffc98a, 26, 22, 2);
    this.lamp.position.set(0, 2.25, 0.5);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.camera.near = 0.1;
    this.lamp.shadow.camera.far = 22;
    scene.add(this.lamp);
    this.lampOn = true;
  }

  setLamp(on) {
    this.lampOn = on;
    this.lamp.visible = on;
    this.bulbMat.color.setRGB(...(on ? [2.2, 1.6, 1.0] : [0.25, 0.22, 0.2]));
    this.glowMat.opacity = on ? 0.55 : 0;
  }

  buildTable(scene, mat) {
    const g = new THREE.Group();
    g.position.set(-1.35, 0.12, 2.6);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 16), mat);
    top.position.y = 0.55;
    top.castShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.55, 8), mat);
    leg.position.y = 0.27;
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.5 })
    );
    cup.position.set(0.08, 0.62, 0.05);
    g.add(top, leg, cup);
    scene.add(g);
    this.circles.push({ x: -1.35, z: 2.6, r: 0.45 });
  }

  buildChair(scene, woodMat) {
    const g = new THREE.Group();
    g.position.set(CHAIR_POS.x, 0.12, CHAIR_POS.z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.52), mat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    g.add(seat);
    const legGeo = new THREE.CylinderGeometry(0.032, 0.038, 0.45, 8);
    for (const [lx, lz] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx, 0.225, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    // backrest (behind = +z side, sitter faces -Z)
    for (const lx of [-0.24, 0.24]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), mat);
      post.position.set(lx, 0.76, 0.23);
      post.castShadow = true;
      g.add(post);
    }
    for (const sy of [0.82, 1.0]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.11, 0.04), mat);
      slat.position.set(0, sy, 0.23);
      g.add(slat);
    }
    // armrests
    for (const lx of [-0.3, 0.3]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.48), mat);
      arm.position.set(lx, 0.66, 0);
      arm.castShadow = true;
      g.add(arm);
      const sup = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), mat);
      sup.position.set(lx, 0.56, -0.2);
      g.add(sup);
    }
    scene.add(g);
    this.circles.push({ x: CHAIR_POS.x, z: CHAIR_POS.z, r: 0.5 });
    void woodMat;
  }
}
