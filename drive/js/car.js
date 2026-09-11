import * as THREE from 'three';
import { makePlate, makeGlowSprite } from './textures.js';
import { clamp, lerp, rnd, makeCanvas, fmtKm } from './utils.js';

// Player sedan: full exterior + right-hand-drive interior, live gauges,
// animated wipers, rain-on-windshield, dirt, damage smoke.
const C = {
  body: 0x1c2740, dark: 0x0c0e15, glass: 0x0a1220, trim: 0x05060c,
};

export class Car {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    // live state (written by game.js every frame)
    this.speedKmh = 0;
    this.rpm01 = 0;
    this.gear = 'P';
    this.fuel01 = 1;
    this.tempC = 90;
    this.odoM = 0;
    this.clockStr = '00:00';
    this.steerVis = 0;
    this.throttleVis = 0;
    this.brakeVis = false;
    this.reversing = false;
    this.signal = 0;      // -1 left, 0 off, 1 right
    this.hazards = false;
    this.lightsOn = false;
    this.highBeam = false;
    this.wiperMode = 0;   // 0 off, 1 slow, 2 fast
    this.dirt = 0;
    this.health = 100;
    this.rainI = 0.7;
    this.behindDots = [];
    this.gpsLines = ['', ''];
    this.radioLine1 = 'OFF';
    this.radioLine2 = '';
    this.hoodOpen = 0;
    this.hoodTarget = 0;
    this.engineOn = true;
    this.washActive = false;
    this.beamLvl = 0;      // LED light bar upgrade 0..2

    this.glowTex = makeGlowSprite({});
    this.buildBody();
    this.buildWheels();
    this.buildLights();
    this.buildInterior();
    this.buildGlass();
    this.buildWipers();
    this.buildDrops();
    this.buildGauges();
    this.buildMirror();
    this.buildSmoke();

    this.wiperT = 0;
    this.wiperAngle = -0.9;
    this.gaugeT = 0;
    this.mirrorT = 0;
    this.gpsT = 0;
    this.smokeAcc = 0;
  }

  // ---------------- exterior ----------------
  buildBody() {
    const paint = new THREE.MeshStandardMaterial({
      color: C.body, metalness: 0.7, roughness: 0.35,
    });
    this.paint = paint;
    const dark = new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.9 });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.6), paint);
    lower.position.y = 0.62;
    this.group.add(lower);

    // hood (opens for repair) — hinge at rear edge
    this.hoodPivot = new THREE.Group();
    this.hoodPivot.position.set(0, 0.92, -1.0);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.32), paint);
    hood.position.set(0, 0, -0.66);
    this.hoodPivot.add(hood);
    this.group.add(this.hoodPivot);
    // engine block revealed under hood
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.9), dark);
    block.position.set(0, 0.78, -1.65);
    this.group.add(block);

    // trunk + bumpers + grille
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.18, 1.0), paint);
    trunk.position.set(0, 0.95, 1.75);
    this.group.add(trunk);
    for (const z of [-2.32, 2.32]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.3, 0.18), dark);
      b.position.set(0, 0.42, z);
      this.group.add(b);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.06), dark);
    grille.position.set(0, 0.62, -2.31);
    this.group.add(grille);

    // plates (KT = Kalimantan Timur 👋)
    const plateTex = makePlate('KT 4821 XA');
    for (const z of [-2.42, 2.42]) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.52, 0.13),
        new THREE.MeshBasicMaterial({ map: plateTex })
      );
      p.position.set(0, 0.45, z);
      if (z > 0) p.rotation.y = Math.PI;
      this.group.add(p);
    }

    // fuel flap (rear-right quarter)
    this.flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a3a5c, metalness: 0.7, roughness: 0.4 })
    );
    this.flap.position.set(0.91, 0.78, 1.55);
    this.group.add(this.flap);

    // mirrors
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), dark);
      m.position.set(s * 0.98, 1.05, -0.55);
      this.group.add(m);
    }

    // exhausts
    const exMat = new THREE.MeshStandardMaterial({ color: 0x30343f, metalness: 0.9, roughness: 0.3 });
    for (const s of [-0.3, 0.3]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), exMat);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(s, 0.28, 2.36);
      this.group.add(ex);
    }

    // dirt shell
    this.dirtMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.6, 4.66),
      new THREE.MeshBasicMaterial({
        color: 0x2a1f14, transparent: true, opacity: 0, depthWrite: false,
      })
    );
    this.dirtMesh.position.y = 0.62;
    this.group.add(this.dirtMesh);
  }

  buildWheels() {
    const tireGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x6a7080, metalness: 0.8, roughness: 0.35 });
    this.wheels = [];
    this.frontSteer = [];
    for (const [x, z, front] of [[-0.82, -1.45, 1], [0.82, -1.45, 1], [-0.82, 1.45, 0], [0.82, 1.45, 0]]) {
      const g = new THREE.Group();
      g.position.set(x, 0.33, z);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tireMat));
      spin.add(new THREE.Mesh(hubGeo, hubMat));
      g.add(spin);
      this.group.add(g);
      this.wheels.push(spin);
      if (front) this.frontSteer.push(g);
    }
    this.wheelSpin = 0;
  }

  buildLights() {
    // headlight lenses
    this.headLensMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (const s of [-0.6, 0.6]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), this.headLensMat);
      lens.position.set(s, 0.72, -2.31);
      this.group.add(lens);
    }
    // real spotlights
    this.headSpots = [];
    for (const s of [-0.6, 0.6]) {
      const sp = new THREE.SpotLight(0xfff2d8, 0, 90, 0.5, 0.55, 2);
      sp.position.set(s, 0.72, -2.2);
      const tgt = new THREE.Object3D();
      tgt.position.set(s * 1.4, 0, -30);
      this.group.add(tgt);
      sp.target = tgt;
      this.group.add(sp);
      this.headSpots.push(sp);
    }
    // volumetric-ish beam cones
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff2d8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.beams = [];
    for (const s of [-0.6, 0.6]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 15, 12, 1, true), this.beamMat);
      cone.rotation.x = Math.PI / 2 - 0.055;
      cone.position.set(s, 0.55, -9.5);
      this.group.add(cone);
      this.beams.push(cone);
    }
    // headlight glow sprites
    this.headGlowMat = new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xfff2d8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (const s of [-0.6, 0.6]) {
      const sp = new THREE.Sprite(this.headGlowMat);
      sp.scale.set(1.6, 1.6, 1);
      sp.position.set(s, 0.72, -2.4);
      this.group.add(sp);
    }
    // taillights
    this.tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.05, 0.05) });
    for (const s of [-0.6, 0.6]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.06), this.tailMat);
      t.position.set(s, 0.78, 2.31);
      this.group.add(t);
    }
    this.revMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), this.revMat);
    rev.position.set(0, 0.62, 2.31);
    this.group.add(rev);
    // turn signals
    this.sigMats = {};
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      this.sigMats[key] = new THREE.MeshBasicMaterial({ color: 0x201404 });
    }
    const sigGeo = new THREE.BoxGeometry(0.14, 0.1, 0.06);
    const place = (m, x, z) => { const q = new THREE.Mesh(sigGeo, m); q.position.set(x, 0.72, z); this.group.add(q); };
    place(this.sigMats.fl, -0.86, -2.31);
    place(this.sigMats.fr, 0.86, -2.31);
    place(this.sigMats.rl, -0.86, 2.31);
    place(this.sigMats.rr, 0.86, 2.31);
  }

  // ---------------- interior (RHD) ----------------
  buildInterior() {
    const trim = new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.92 });
    const fabric = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 1 });

    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.55), trim);
    dash.position.set(0, 0.98, -0.95);
    this.group.add(dash);
    const dashTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.62), trim);
    dashTop.position.set(0, 1.15, -0.92);
    this.group.add(dashTop);

    // steering wheel (driver right)
    this.wheelG = new THREE.Group();
    this.wheelG.position.set(0.42, 0.95, -0.62);
    this.wheelG.rotation.x = -0.28;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 10, 28), trim);
    this.wheelG.add(rim);
    for (const a of [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 - 2.1]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.19, 0.03), trim);
      sp.position.set(Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0);
      sp.rotation.z = a - Math.PI / 2;
      this.wheelG.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), trim);
    hub.rotation.x = Math.PI / 2;
    this.wheelG.add(hub);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), trim);
    column.rotation.x = Math.PI / 2 - 0.28;
    column.position.set(0.42, 0.88, -0.78);
    this.group.add(column);
    this.spinG = new THREE.Group();
    // move rim+spokes+hub into spin group
    while (this.wheelG.children.length) this.spinG.add(this.wheelG.children[0]);
    this.wheelG.add(this.spinG);
    this.group.add(this.wheelG);

    // center console + shifter
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 1.0), trim);
    console_.position.set(0, 0.6, -0.3);
    this.group.add(console_);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), trim);
    stick.position.set(0, 0.88, -0.25);
    stick.rotation.x = 0.2;
    this.group.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), trim);
    knob.position.set(0, 0.97, -0.27);
    this.group.add(knob);

    // seats
    for (const sx of [-0.42, 0.42]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), fabric);
      base.position.set(sx, 0.52, 0.05);
      this.group.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.16), fabric);
      back.position.set(sx, 0.88, 0.36);
      back.rotation.x = 0.12;
      this.group.add(back);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), fabric);
      head.position.set(sx, 1.28, 0.41);
      this.group.add(head);
    }
    // rear bench (for look-back)
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), fabric);
    bench.position.set(0, 0.62, 1.15);
    this.group.add(bench);

    // roof + pillars
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 2.2), trim);
    roof.position.set(0, 1.47, 0.1);
    this.group.add(roof);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), trim);
      a.position.set(s * 0.76, 1.22, -0.88);
      a.rotation.x = 0.35;
      this.group.add(a);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), trim);
      c.position.set(s * 0.76, 1.2, 1.05);
      c.rotation.x = -0.3;
      this.group.add(c);
    }

    // pedals
    for (const px of [0.32, 0.52]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.16), trim);
      p.position.set(px, 0.42, -0.85);
      p.rotation.x = -0.5;
      this.group.add(p);
    }

    // dome light
    this.dome = new THREE.PointLight(0x8fa0ff, 0, 3.5, 2);
    this.dome.position.set(0, 1.4, 0.1);
    this.group.add(this.dome);
    const domeLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.03, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x2a3050 })
    );
    domeLens.position.set(0, 1.43, 0.1);
    this.group.add(domeLens);
    this.domeLensMat = domeLens.material;
  }

  buildGlass() {
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x0d1626, transparent: true, opacity: 0.22, depthWrite: false,
    });
    // windshield
    this.windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.78), glassMat);
    this.windshield.position.set(0, 1.2, -0.9);
    this.windshield.rotation.x = 0.35;
    this.group.add(this.windshield);
    // side windows
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.52), glassMat);
      w.position.set(s * 0.79, 1.2, 0.08);
      w.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(w);
    }
    // rear window
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), glassMat);
    rw.position.set(0, 1.2, 1.08);
    rw.rotation.x = -0.3;
    rw.rotation.y = Math.PI;
    this.group.add(rw);
  }

  buildWipers() {
    const armMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.7 });
    this.wipers = [];
    for (const px of [-0.35, 0.35]) {
      const pivot = new THREE.Group();
      pivot.position.set(px, 0.88, -1.06);
      pivot.rotation.x = 0.35;
      const inner = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.34, 0.02), armMat);
      arm.position.y = 0.17;
      inner.add(arm);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.025), armMat);
      blade.position.y = 0.5;
      inner.add(blade);
      inner.rotation.z = -0.9;
      pivot.add(inner);
      this.group.add(pivot);
      this.wipers.push({ pivot, inner, x: px });
    }
  }

  // rain drops overlay on the windshield (canvas)
  buildDrops() {
    const [c, ctx] = makeCanvas(256, 160);
    this.dropCanvas = c;
    this.dropCtx = ctx;
    this.dropTex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.78),
      new THREE.MeshBasicMaterial({ map: this.dropTex, transparent: true, depthWrite: false })
    );
    m.position.set(0, 1.2, -0.895);
    m.rotation.x = 0.35;
    this.group.add(m);
    this.drops = [];
    this.dropAcc = 0;
  }

  updateDrops(dt, wiperAngles) {
    // spawn
    this.dropAcc += dt * this.rainI * 90;
    while (this.dropAcc > 1) {
      this.dropAcc -= 1;
      if (this.drops.length < 420) {
        this.drops.push({
          x: Math.random() * 256, y: Math.random() * 160,
          r: 0.7 + Math.random() * 1.6, vy: 12 + Math.random() * 26,
          wob: Math.random() * 10,
        });
      }
    }
    const ctx = this.dropCtx;
    ctx.clearRect(0, 0, 256, 160);
    const slide = 1 + Math.abs(this.speedKmh) / 60;
    for (const d of this.drops) {
      d.y += d.vy * slide * dt;
      d.x += Math.sin(d.y * 0.05 + d.wob) * dt * 6;
      if (d.y > 162) {
        d.y = -2;
        d.x = Math.random() * 256;
      }
      ctx.fillStyle = 'rgba(175,195,235,0.5)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,240,255,0.5)';
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // wipers erase bands (pivot bottom area, blade angle from rotation.z)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    for (let i = 0; i < wiperAngles.length; i++) {
      const a = wiperAngles[i];
      const px = i === 0 ? 72 : 184;
      const py = 158;
      // blade direction: rotation.z=0 points up; canvas y is down
      const dx = Math.sin(-a);
      const dy = -Math.cos(-a);
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dx * 150, py + dy * 150);
      ctx.stroke();
    }
    ctx.restore();
    this.dropTex.needsUpdate = true;
  }

  // ---------------- gauges ----------------
  buildGauges() {
    // cluster
    const [cc, cx] = makeCanvas(512, 256);
    this.cluCanvas = cc;
    this.cluCtx = cx;
    this.cluTex = new THREE.CanvasTexture(cc);
    this.cluTex.colorSpace = THREE.SRGBColorSpace;
    const cluster = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.22),
      new THREE.MeshBasicMaterial({ map: this.cluTex, transparent: true })
    );
    cluster.position.set(0.42, 1.07, -0.7);
    cluster.rotation.x = -0.12;
    this.group.add(cluster);

    // radio display
    const [rc, rx] = makeCanvas(256, 64);
    this.radCtx = rx;
    this.radTex = new THREE.CanvasTexture(rc);
    this.radTex.colorSpace = THREE.SRGBColorSpace;
    const radio = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.075),
      new THREE.MeshBasicMaterial({ map: this.radTex })
    );
    radio.position.set(0, 0.94, -0.72);
    radio.rotation.x = -0.35;
    this.group.add(radio);
    this.radioDirty = true;

    // GPS strip
    const [gc, gx] = makeCanvas(512, 64);
    this.gpsCtx = gx;
    this.gpsTex = new THREE.CanvasTexture(gc);
    this.gpsTex.colorSpace = THREE.SRGBColorSpace;
    const gps = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.065),
      new THREE.MeshBasicMaterial({ map: this.gpsTex })
    );
    gps.position.set(0, 1.06, -0.7);
    gps.rotation.x = -0.3;
    this.group.add(gps);
  }

  drawCluster() {
    const ctx = this.cluCtx;
    const W = 512, H = 256;
    ctx.clearRect(0, 0, W, H);
    // dial helper
    const dial = (cx, cy, r, val, max, red, label, unit) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(140,160,220,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      // red zone
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * (0.75 + 1.5 * red), Math.PI * 2.25);
      ctx.stroke();
      // ticks
      ctx.fillStyle = '#aeb8e8';
      ctx.font = '700 20px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.75 + (1.5 * i) / (n - 1));
        const v = Math.round((max * i) / (n - 1));
        ctx.fillText(String(v), Math.cos(a) * (r - 26), Math.sin(a) * (r - 26));
        ctx.strokeStyle = '#7d8fd6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      // needle
      const na = Math.PI * (0.75 + 1.5 * clamp(val / max, 0, 1));
      ctx.strokeStyle = '#ff5d5d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(na) * (r - 12), Math.sin(na) * (r - 12));
      ctx.stroke();
      ctx.fillStyle = '#dfe4ff';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8f9bff';
      ctx.font = '600 17px Rajdhani, sans-serif';
      ctx.fillText(label, 0, 44);
      ctx.restore();
    };
    dial(110, 118, 88, this.speedKmh, 200, 1.01, 'km/h', '');
    dial(402, 118, 88, this.rpm01 * 8, 8, 0.78, 'rpm x1000', '');

    // center stack: fuel + temp + odo + gear + clock + warns
    const cx0 = 218;
    ctx.fillStyle = '#aeb8e8';
    ctx.font = '700 22px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.gear, 256, 42);
    ctx.font = '600 19px Rajdhani, sans-serif';
    ctx.fillStyle = '#7d8fd6';
    ctx.fillText(this.clockStr + '   ' + fmtKm(this.odoM).toUpperCase(), 256, 68);

    // fuel bar
    ctx.fillStyle = '#39406b';
    ctx.fillRect(cx0, 88, 76, 14);
    ctx.fillStyle = this.fuel01 < 0.15 ? '#ff5040' : '#ffb03d';
    ctx.fillRect(cx0, 88, 76 * clamp(this.fuel01, 0, 1), 14);
    ctx.fillStyle = '#8f9bff';
    ctx.font = '700 15px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', cx0, 118);
    // temp bar
    ctx.fillStyle = '#39406b';
    ctx.fillRect(cx0, 128, 76, 14);
    const tk = clamp((this.tempC - 70) / 70, 0, 1);
    ctx.fillStyle = tk > 0.8 ? '#ff5040' : '#4dc9ff';
    ctx.fillRect(cx0, 128, 76 * tk, 14);
    ctx.fillStyle = '#8f9bff';
    ctx.fillText(Math.round(this.tempC) + '°C', cx0, 158);

    // warn lights
    ctx.textAlign = 'center';
    ctx.font = '22px sans-serif';
    let wx = 226;
    const warns = [];
    if (this.fuel01 < 0.15) warns.push('⛽');
    if (this.health < 50) warns.push('🔧');
    if (this.tempC > 125) warns.push('🌡️');
    if (this.lightsOn) warns.push('💡');
    for (const w of warns) {
      ctx.fillText(w, wx, 200);
      wx += 30;
    }
    // health bar thin
    ctx.fillStyle = '#39406b';
    ctx.fillRect(cx0, 216, 76, 8);
    ctx.fillStyle = this.health > 50 ? '#7dff6a' : this.health > 25 ? '#ffb03d' : '#ff5040';
    ctx.fillRect(cx0, 216, 76 * clamp(this.health / 100, 0, 1), 8);
    this.cluTex.needsUpdate = true;
  }

  drawRadio() {
    const ctx = this.radCtx;
    ctx.fillStyle = '#0a0618';
    ctx.fillRect(0, 0, 256, 64);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9a3d';
    ctx.shadowColor = '#ff9a3d';
    ctx.shadowBlur = 10;
    ctx.font = '700 26px Orbitron, monospace';
    ctx.fillText(this.radioLine1, 128, 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c9b8ff';
    ctx.font = '600 17px Rajdhani, sans-serif';
    ctx.fillText(this.radioLine2, 128, 52);
    this.radTex.needsUpdate = true;
    this.radioDirty = false;
  }

  drawGPS() {
    const ctx = this.gpsCtx;
    ctx.fillStyle = '#04140a';
    ctx.fillRect(0, 0, 512, 64);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7dff9a';
    ctx.shadowColor = '#7dff9a';
    ctx.shadowBlur = 8;
    ctx.font = '700 25px Rajdhani, sans-serif';
    ctx.fillText(this.gpsLines[0] + '      ' + this.gpsLines[1], 256, 40);
    ctx.shadowBlur = 0;
    this.gpsTex.needsUpdate = true;
  }

  // ---------------- rear-view mirror ----------------
  buildMirror() {
    const [c, ctx] = makeCanvas(96, 32);
    this.mirCtx = ctx;
    this.mirTex = new THREE.CanvasTexture(c);
    this.mirTex.colorSpace = THREE.SRGBColorSpace;
    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.1, 0.04),
      new THREE.MeshStandardMaterial({ color: C.dark })
    );
    stem.position.set(0, 1.4, -0.55);
    this.group.add(stem);
    const mir = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.11),
      new THREE.MeshBasicMaterial({ map: this.mirTex })
    );
    mir.position.set(0, 1.33, -0.55);
    this.group.add(mir);
  }

  drawMirror() {
    const ctx = this.mirCtx;
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#0a0f22');
    g.addColorStop(1, '#04060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 32);
    for (const d of this.behindDots) {
      ctx.fillStyle = d.color || '#ff3030';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(48 + d.x * 40, 20, d.r || 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    this.mirTex.needsUpdate = true;
  }

  // ---------------- smoke ----------------
  buildSmoke() {
    const N = 50;
    this.smN = N;
    this.smPos = new Float32Array(N * 3);
    this.smCol = new Float32Array(N * 3);
    this.smLife = new Float32Array(N);
    this.smMax = new Float32Array(N);
    this.smVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.smLife[i] = 0;
      this.smPos[i * 3 + 1] = -99;
    }
    const geo = new THREE.BufferGeometry();
    this.smPosAttr = new THREE.BufferAttribute(this.smPos, 3);
    this.smColAttr = new THREE.BufferAttribute(this.smCol, 3);
    this.smPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.smColAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.smPosAttr);
    geo.setAttribute('color', this.smColAttr);
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.5, map: this.glowTex, transparent: true, opacity: 0.35,
      vertexColors: true, depthWrite: false, sizeAttenuation: true,
    }));
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke); // local space: follows car
    this.smHead = 0;
  }

  puff(x, y, z, spread, up, col, life) {
    const i = this.smHead;
    this.smHead = (this.smHead + 1) % this.smN;
    const i3 = i * 3;
    this.smPos[i3] = x + rnd(-spread, spread);
    this.smPos[i3 + 1] = y;
    this.smPos[i3 + 2] = z + rnd(-spread, spread);
    this.smVel[i3] = rnd(-0.3, 0.3);
    this.smVel[i3 + 1] = up * rnd(0.7, 1.3);
    this.smVel[i3 + 2] = rnd(0.5, 1.5); // trail behind
    this.smLife[i] = this.smMax[i] = life * rnd(0.7, 1.3);
    this.smCol[i3] = col[0];
    this.smCol[i3 + 1] = col[1];
    this.smCol[i3 + 2] = col[2];
  }

  updateSmoke(dt) {
    // exhaust (rate by throttle) + hood steam (damage)
    this.smokeAcc += dt * (2 + this.throttleVis * 14);
    while (this.smokeAcc > 1) {
      this.smokeAcc -= 1;
      if (this.engineOn) {
        this.puff(rnd() < 0.5 ? -0.3 : 0.3, 0.28, 2.45, 0.05, 0.5, [0.25, 0.27, 0.32], 0.9);
      }
    }
    if (this.health < 40 && this.engineOn) {
      if (Math.random() < dt * (this.health < 1 ? 30 : 6)) {
        this.puff(rnd(-0.4, 0.4), 1.0, -1.6, 0.2, 1.2, [0.5, 0.55, 0.6], 1.4);
      }
    }
    for (let i = 0; i < this.smN; i++) {
      if (this.smLife[i] <= 0) continue;
      this.smLife[i] -= dt;
      const i3 = i * 3;
      if (this.smLife[i] <= 0) {
        this.smPos[i3 + 1] = -99;
        continue;
      }
      this.smPos[i3] += this.smVel[i3] * dt;
      this.smPos[i3 + 1] += this.smVel[i3 + 1] * dt;
      this.smPos[i3 + 2] += (this.smVel[i3 + 2] + Math.abs(this.speedKmh) / 12) * dt;
    }
    this.smPosAttr.needsUpdate = true;
  }

  setRadio(l1, l2) {
    this.radioLine1 = l1;
    this.radioLine2 = l2;
    this.radioDirty = true;
  }

  // ---------------- per-frame ----------------
  update(dt, time) {
    // wheels
    this.wheelSpin += (this.speedKmh / 3.6 / 0.33) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const g of this.frontSteer) g.rotation.y = this.steerVis * 0.5;
    this.spinG.rotation.z = -this.steerVis * 2.1;

    // headlights
    const on = this.lightsOn;
    const hi = this.highBeam && on;
    const boost = 1 + this.beamLvl * 0.4;
    for (const sp of this.headSpots) {
      sp.intensity = !on ? 0 : hi ? 480 * boost : 220 * boost;
      sp.distance = (hi ? 140 : 80) + this.beamLvl * 25;
      sp.angle = hi ? 0.42 : 0.52;
    }
    this.headLensMat.color.setRGB(on ? 3 : 0.13, on ? 3 : 0.13, on ? 2.7 : 0.13);
    this.beamMat.opacity = !on ? 0 : hi ? 0.075 : 0.045;
    for (const b of this.beams) b.scale.y = hi ? 1.9 : 1.0;
    this.headGlowMat.opacity = on ? 0.75 : 0;
    this.tailMat.color.setRGB(this.brakeVis ? 3 : 0.6, this.brakeVis ? 0.25 : 0.05, 0.05);
    this.revMat.color.setRGB(this.reversing ? 2.5 : 0.07, this.reversing ? 2.5 : 0.07, this.reversing ? 2.5 : 0.07);

    // signals
    const blink = (time * 1.6) % 1 < 0.55;
    const left = (this.signal < 0 || this.hazards) && blink;
    const right = (this.signal > 0 || this.hazards) && blink;
    this.sigMats.fl.color.setRGB(left ? 3 : 0.12, left ? 1.2 : 0.07, 0.02);
    this.sigMats.rl.color.setRGB(left ? 3 : 0.12, left ? 1.2 : 0.07, 0.02);
    this.sigMats.fr.color.setRGB(right ? 3 : 0.12, right ? 1.2 : 0.07, 0.02);
    this.sigMats.rr.color.setRGB(right ? 3 : 0.12, right ? 1.2 : 0.07, 0.02);

    // wipers
    const period = this.wiperMode === 2 ? 0.7 : 1.6;
    if (this.wiperMode > 0 || this.washActive) {
      this.wiperT += dt / period;
      const ph = this.wiperT % 1;
      this.wiperAngle = -0.9 + 1.8 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
    } else {
      this.wiperAngle += (-0.9 - this.wiperAngle) * Math.min(1, dt * 6);
    }
    for (const w of this.wipers) w.inner.rotation.z = this.wiperAngle;

    // windshield drops
    this.updateDrops(dt, [this.wiperAngle, this.wiperAngle]);

    // dirt
    this.dirtMesh.material.opacity = this.dirt * 0.5;

    // hood
    this.hoodOpen += (this.hoodTarget - this.hoodOpen) * Math.min(1, dt * 3);
    this.hoodPivot.rotation.x = this.hoodOpen * 0.85;

    // dome
    const domeOn = this.domeTarget > 0;
    this.dome.intensity += ((domeOn ? 2.2 : 0) - this.dome.intensity) * Math.min(1, dt * 5);
    this.domeLensMat.color.setRGB(0.16 + this.dome.intensity * 0.2, 0.18 + this.dome.intensity * 0.2, 0.3 + this.dome.intensity * 0.25);

    // smoke
    this.updateSmoke(dt);

    // canvases (throttled)
    this.gaugeT -= dt;
    if (this.gaugeT <= 0) {
      this.gaugeT = 0.08;
      this.drawCluster();
    }
    this.mirrorT -= dt;
    if (this.mirrorT <= 0) {
      this.mirrorT = 0.2;
      this.drawMirror();
    }
    this.gpsT -= dt;
    if (this.gpsT <= 0) {
      this.gpsT = 0.5;
      this.drawGPS();
    }
    if (this.radioDirty) this.drawRadio();
  }
}
