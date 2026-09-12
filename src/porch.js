import * as THREE from 'three';
import { makeCanvas, rnd } from './utils.js';
import { makeWood, makePlaid, addAO } from './textures.js';

// Wooden porch: PBR deck, posts, roof, railing, hanging lamp with
// volumetric cone, string lights, side table + book + steaming cup,
// chair, rug, blanket, front step, roof runoff drips.
export const CHAIR_POS = { x: 0, z: 2.6 };
export const SEAT_TOP = 0.57;

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

function steamTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(220,220,225,0.4)');
  grad.addColorStop(1, 'rgba(220,220,225,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Porch {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];   // railing AABB colliders {x0,x1,z0,z1}
    this.circles = []; // furniture circle colliders {x,z,r}
    const deckTex = makeWood({ base: '#5a4128', dark: '#2a1a0c', planks: 8, rx: 3, ry: 2, weather: 0.5 });
    const trimTex = makeWood({ base: '#4a3421', dark: '#241608', planks: 3, rx: 1, ry: 1, gaps: false, weather: 0.25 });
    const wood = new THREE.MeshStandardMaterial({ ...deckTex, roughness: 0.85 });
    const darkWood = new THREE.MeshStandardMaterial({ ...trimTex, roughness: 0.9 });

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
    this.buildStrings(scene);
    this.buildTable(scene, darkWood);
    this.buildChair(scene);
    this.buildStep(scene, darkWood);

    // lived-in details: rug, draped blanket, book, steaming cup
    const plaid = makePlaid('#4a3a52', '#22202a', 2, 1.5);
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.02, 1.4),
      new THREE.MeshStandardMaterial({ ...plaid, roughness: 1 })
    );
    rug.position.set(0, 0.13, 2.2);
    rug.receiveShadow = true;
    scene.add(rug);
    const blanketTex = makePlaid('#5a2a2a', '#1a1a1a', 1, 1);
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.06),
      new THREE.MeshStandardMaterial({ ...blanketTex, roughness: 1 })
    );
    blanket.position.set(-2, 0.78, 4.9);
    blanket.castShadow = true;
    scene.add(blanket);

    // contact shadows ground the furniture
    addAO(scene, 0, 0.145, 2.6, 1.3, 1.2, 0.9);      // chair
    addAO(scene, -1.35, 0.145, 2.6, 1.0, 1.0, 0.8);  // table
    addAO(scene, 3.6, 0.145, 3.4, 1.7, 1.0, 0.7);    // swing
    addAO(scene, -3.6, 0.145, 3.4, 1.0, 0.9, 0.8);   // guest chair

    // roof runoff drips along the front edge
    const DN = 120;
    this.dripPos = new Float32Array(DN * 3);
    this.dripSpd = new Float32Array(DN);
    for (let i = 0; i < DN; i++) {
      this.dripPos[i * 3] = rnd(-6.4, 6.4);
      this.dripPos[i * 3 + 1] = rnd(0, 2.9);
      this.dripPos[i * 3 + 2] = -3.55;
      this.dripSpd[i] = rnd(6, 9);
    }
    this.dripGeo = new THREE.BufferGeometry();
    this.dripGeo.setAttribute('position', new THREE.BufferAttribute(this.dripPos, 3));
    this.drips = new THREE.Points(this.dripGeo, new THREE.PointsMaterial({
      color: 0xaac0d8, size: 0.035, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.drips.frustumCulled = false;
    scene.add(this.drips);
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
        color: 0x1d3025, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide,
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
    // volumetric-feel light cone under the shade
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xffc98a, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.1, 16, 1, true), this.coneMat);
    cone.position.y = 1.15;
    g.add(cord, shade, bulb, glow, cone);
    scene.add(g);

    this.lamp = new THREE.PointLight(0xffc98a, 40, 24, 2);
    this.lamp.position.set(0, 2.25, 0.5);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(512, 512);
    this.lamp.shadow.camera.near = 0.1;
    this.lamp.shadow.camera.far = 24;
    this.lamp.shadow.bias = -0.004;
    scene.add(this.lamp);
    this.lampOn = true;
  }

  buildStrings(scene) {
    this.stringMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const cordMat = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
    const bulbGeo = new THREE.SphereGeometry(0.035, 8, 6);
    const run = (x0, z0, x1, z1, y, sag, n) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const yy = y - Math.sin(t * Math.PI) * sag;
        pts.push(new THREE.Vector3(x, yy, z));
        const bulb = new THREE.Mesh(bulbGeo, this.stringMat);
        bulb.position.set(x, yy - 0.05, z);
        scene.add(bulb);
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cordMat);
      scene.add(line);
    };
    run(-6.4, -3.5, 6.4, -3.5, 2.72, 0.4, 15);   // front edge
    run(-6.4, -3.5, -6.4, 4.5, 2.72, 0.5, 11);   // left edge
  }

  setLamp(on) {
    this.lampOn = on;
    this.lamp.visible = on;
    this.bulbMat.color.setRGB(...(on ? [2.2, 1.6, 1.0] : [0.25, 0.22, 0.2]));
    this.glowMat.opacity = on ? 0.55 : 0;
    this.coneMat.opacity = on ? 0.05 : 0;
    this.stringMat.color.set(on ? 0xffd9a0 : 0x22201c);
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
      new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.35 })
    );
    cup.position.set(0.08, 0.62, 0.05);
    // a forgotten book
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x5a1f1f, roughness: 0.7 })
    );
    book.position.set(-0.12, 0.6, -0.08);
    book.rotation.y = 0.5;
    book.castShadow = true;
    g.add(top, leg, cup, book);
    scene.add(g);
    // steam wisp above the cup
    this.steamMat = new THREE.SpriteMaterial({
      map: steamTexture(), transparent: true, opacity: 0.25, depthWrite: false,
    });
    this.steam = new THREE.Sprite(this.steamMat);
    this.steam.scale.set(0.16, 0.16, 1);
    this.steam.position.set(-1.27, 0.85, 2.65);
    scene.add(this.steam);
    this.circles.push({ x: -1.35, z: 2.6, r: 0.45 });
  }

  buildChair(scene) {
    const chairTex = makeWood({ base: '#6b4a2a', dark: '#2a1a0c', planks: 2, gaps: false, weather: 0.1 });
    const g = new THREE.Group();
    g.position.set(CHAIR_POS.x, 0.12, CHAIR_POS.z);
    const mat = new THREE.MeshStandardMaterial({ ...chairTex, roughness: 0.8 });
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
  }

  buildStep(scene, mat) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.6), mat);
    step.position.set(0, 0.06, -3.6);
    step.receiveShadow = true;
    scene.add(step);
  }

  update(t, dt, rainOn) {
    // steam rises and curls off the cup
    const p = (t * 0.25) % 1;
    this.steam.position.y = 0.82 + p * 0.4;
    this.steam.position.x = -1.27 + Math.sin(p * 5) * 0.03;
    const sc = 0.12 + p * 0.16;
    this.steam.scale.set(sc, sc, 1);
    this.steamMat.opacity = Math.sin(p * Math.PI) * 0.28;

    // runoff drips only while it rains
    this.drips.visible = rainOn;
    if (rainOn) {
      const a = this.dripGeo.getAttribute('position').array;
      for (let i = 0; i < this.dripSpd.length; i++) {
        a[i * 3 + 1] -= this.dripSpd[i] * dt;
        if (a[i * 3 + 1] < 0) {
          a[i * 3 + 1] = 2.9;
          a[i * 3] = rnd(-6.4, 6.4);
        }
      }
      this.dripGeo.getAttribute('position').needsUpdate = true;
    }
  }
}
