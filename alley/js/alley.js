import * as THREE from 'three';
import {
  makeNeonSign, makeVerticalSign, makeArrowSign, makeWindows,
  makeShopGlow, makeVending, makeTicker, makeGlowSprite,
} from './signs.js';

const SEG_LEN = 20;
const SEG_COUNT = 14;
const SPAN = SEG_LEN * SEG_COUNT;

const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function flickerPattern(t, seed) {
  const n = Math.sin(t * 31 + seed * 12.9)
    * Math.sin(t * 17.3 + seed * 78.2)
    * Math.sin(t * 5.1 + seed * 3.7);
  const m = n > -0.72 ? 1 : 0.1;
  return m * (0.93 + 0.07 * Math.sin(t * 47 + seed));
}

// Endless recycling alley: buildings, neon signs, wires, lanterns,
// vending machines, hero lights, steam vents, flying traffic.
export class Alley {
  constructor(scene) {
    this.scene = scene;
    this.flickers = [];
    this.buildMaterials();
    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      this.buildSegment(g, i);
      g.position.z = 30 - i * SEG_LEN;
      scene.add(g);
      this.segments.push(g);
    }
    this.buildLights();
    this.buildSteam();
    this.buildVehicles();
  }

  buildMaterials() {
    // facades: 5 variants x 3 height classes (texture repeat per class)
    this.windowMats = [];
    for (let v = 0; v < 5; v++) {
      const { map, emissive } = makeWindows({ seed: v + 1, litRatio: 0.3 + v * 0.05 });
      const row = [];
      for (let hc = 0; hc < 3; hc++) {
        const m = map.clone();
        const e = emissive.clone();
        m.wrapS = m.wrapT = THREE.RepeatWrapping;
        e.wrapS = e.wrapT = THREE.RepeatWrapping;
        m.repeat.set(1, hc + 1);
        e.repeat.set(1, hc + 1);
        m.needsUpdate = true;
        e.needsUpdate = true;
        row.push(new THREE.MeshStandardMaterial({
          map: m, emissiveMap: e, emissive: 0xffffff,
          emissiveIntensity: 1.5, roughness: 0.92, metalness: 0.08,
        }));
      }
      this.windowMats.push(row);
    }

    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x070912, roughness: 0.95 });

    const catalog = [
      { tex: makeNeonSign({ text: 'ラーメン', sub: 'RAMEN · 24H', color: '#ff4d9e' }), w: 5.2, h: 2.6, boost: 2.2 },
      { tex: makeNeonSign({ text: 'カラオケ', sub: 'KARAOKE', color: '#00e5ff' }), w: 5.2, h: 2.6, boost: 2.2 },
      { tex: makeNeonSign({ text: '酒場', sub: 'SAKE BAR', color: '#ff9a3d' }), w: 4.6, h: 2.3, boost: 2.2 },
      { tex: makeNeonSign({ text: '寿司', sub: 'SUSHI', color: '#ff4040' }), w: 4.6, h: 2.3, boost: 2.2 },
      { tex: makeNeonSign({ text: '電脳', sub: 'CYBER CAFE', color: '#b537ff' }), w: 4.8, h: 2.4, boost: 2.2 },
      { tex: makeNeonSign({ text: 'ネオン', sub: 'NEON CITY', color: '#ff2fd6' }), w: 5.0, h: 2.5, boost: 2.2 },
      { tex: makeNeonSign({ text: 'OPEN', color: '#7dff6a' }), w: 3.4, h: 1.7, boost: 2.4 },
      { tex: makeVerticalSign({ text: 'ホテル', color: '#4dc9ff' }), w: 1.5, h: 4.0, boost: 2.2, v: true },
      { tex: makeVerticalSign({ text: '夢未来', color: '#ff2fd6' }), w: 1.4, h: 3.8, boost: 2.2, v: true },
      { tex: makeVerticalSign({ text: '喫茶店', color: '#ffb03d' }), w: 1.4, h: 3.8, boost: 2.2, v: true },
      { tex: makeArrowSign({ color: '#00e5ff', dir: 1 }), w: 3.6, h: 1.35, boost: 2.4 },
      { tex: makeArrowSign({ color: '#ff2fd6', dir: -1 }), w: 3.6, h: 1.35, boost: 2.4 },
    ];
    this.signMats = catalog.map((c) => {
      const mat = new THREE.MeshBasicMaterial({
        map: c.tex, transparent: true, side: THREE.DoubleSide,
      });
      mat.color.setScalar(c.boost);
      return { mat, w: c.w, h: c.h, boost: c.boost, v: !!c.v };
    });

    this.shopMats = ['#ffb46b', '#ff8fa3', '#9adcff'].map((c) => {
      const m = new THREE.MeshBasicMaterial({ map: makeShopGlow({ color: c }) });
      m.color.setScalar(1.8);
      return m;
    });

    this.vendMat = new THREE.MeshBasicMaterial({ map: makeVending({}) });
    this.vendMat.color.setScalar(1.7);

    this.ticker = makeTicker({
      text: 'ようこそ NEON RAIN ALLEY へ ★ 24時間営業 ★ WELCOME TO SECTOR 7 ★ MIND THE PUDDLES',
      color: '#ffb03d',
    });
    this.tickerMat = new THREE.MeshBasicMaterial({ map: this.ticker.tex });
    this.tickerMat.color.setScalar(1.7);

    this.glowTex = makeGlowSprite({});
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x11162a, transparent: true, opacity: 0.95 });
  }

  buildSegment(g, index) {
    for (const side of [-1, 1]) {
      // buildings
      for (let b = 0; b < 2; b++) {
        const w = rnd(7, 11);
        const h = rnd(13, 30);
        const d = rnd(15, 20);
        const hc = h < 17 ? 0 : h < 24 ? 1 : 2;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(this.windowMats)[hc]);
        mesh.position.set(
          side * (7 + w / 2 + rnd(0, 2.5)),
          h / 2 - 0.1,
          (b === 0 ? -5 : 5) + rnd(-2, 2)
        );
        g.add(mesh);
      }

      // glowing shop-front
      if (Math.random() < 0.62) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(rnd(2.6, 4.2), rnd(1.6, 2.2)),
          pick(this.shopMats)
        );
        m.position.set(side * 6.93, rnd(1.8, 2.4), rnd(-8, 8));
        m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(m);
      }

      // vending machine
      if (Math.random() < 0.5) {
        const vg = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.15, 0.75), this.darkMat);
        body.position.y = 1.08;
        vg.add(body);
        const front = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), this.vendMat);
        front.position.set(0, 1.08, 0.385);
        vg.add(front);
        vg.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        vg.position.set(side * rnd(5.9, 6.4), 0, rnd(-8, 8));
        g.add(vg);
      }

      // perpendicular neon signs (sticking out over the street)
      const nP = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < nP; i++) {
        const s = pick(this.signMats);
        const y = rnd(3.2, 8.6);
        const z = rnd(-8, 8);
        let mat = s.mat;
        if (Math.random() < 0.2) {
          mat = s.mat.clone(); // faulty flickering tube
          this.flickers.push({ mat, seed: Math.random() * 100, base: s.boost });
        }
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
        sign.rotation.y = Math.PI / 2;
        sign.position.set(side * 5.9, y, z);
        g.add(sign);
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, s.h + 0.25, s.w + 0.25), this.darkMat
        );
        back.position.set(side * 5.97, y, z);
        g.add(back);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.09, 0.09), this.darkMat);
        arm.position.set(side * 6.55, y + s.h / 2 + 0.1, z);
        g.add(arm);
      }

      // flat wall sign
      if (Math.random() < 0.55) {
        const s = pick(this.signMats);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.9, s.h * 0.9), s.mat);
        sign.position.set(side * 6.9, rnd(2.6, 7), rnd(-8, 8));
        sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(sign);
      }

      // AC units / pipes silhouettes
      if (Math.random() < 0.6) {
        const n = 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const b = new THREE.Mesh(
            new THREE.BoxGeometry(rnd(0.4, 0.9), rnd(0.4, 1.0), rnd(0.8, 1.8)),
            this.darkMat
          );
          b.position.set(side * rnd(6.5, 6.9), rnd(2.5, 9), rnd(-9, 9));
          g.add(b);
        }
      }
    }

    // sagging wires across the alley, sometimes with a hanging lantern
    const nW = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < nW; i++) {
      const z0 = rnd(-9, 9);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(rnd(-9, -7), rnd(8.5, 13), z0),
        new THREE.Vector3(rnd(-1, 1), rnd(6.5, 10), z0 + rnd(-2, 2)),
        new THREE.Vector3(rnd(7, 9), rnd(8.5, 13), z0 + rnd(-3, 3))
      );
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)),
        this.wireMat
      ));
      if (Math.random() < 0.55) {
        const p = curve.getPoint(0.5);
        const warm = Math.random() < 0.6;
        const lan = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 12, 10),
          new THREE.MeshBasicMaterial({
            color: warm ? new THREE.Color(2.2, 1.15, 0.45) : new THREE.Color(0.5, 1.6, 2.0),
          })
        );
        lan.position.set(p.x, p.y - 0.55, p.z);
        const cord = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            p, new THREE.Vector3(p.x, p.y - 0.45, p.z),
          ]),
          this.wireMat
        );
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTex, color: warm ? 0xff9a3d : 0x4dc9ff,
          transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        halo.scale.set(1.5, 1.5, 1);
        halo.position.copy(lan.position);
        g.add(lan, cord, halo);
      }
    }

    // overhead spanning sign
    if (Math.random() < 0.3) {
      const flat = this.signMats.filter((s) => !s.v);
      const s = pick(flat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, (9 * s.h) / s.w), s.mat);
      sign.position.set(0, rnd(6.2, 8), rnd(-6, 6));
      g.add(sign);
    }

    // scrolling LED ticker across the street (two segments)
    if (index === 2 || index === 8) {
      for (const r of [0, Math.PI]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), this.tickerMat);
        p.position.set(0, 5.4, r === 0 ? 0.18 : -0.18);
        p.rotation.y = r;
        g.add(p);
      }
      const housing = new THREE.Mesh(new THREE.BoxGeometry(8.3, 1.3, 0.3), this.darkMat);
      housing.position.set(0, 5.4, 0);
      g.add(housing);
    }
  }

  buildLights() {
    this.heroLights = [];
    const colors = [0xff2fd6, 0x00e5ff, 0xff9a3d, 0xb537ff, 0x00e5ff, 0xff4d6d];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(colors[i], 26, 36, 2);
      l.position.set(i % 2 === 0 ? -4.5 : 4.5, rnd(4.5, 6.5), 10 - i * 40);
      this.scene.add(l);
      this.heroLights.push(l);
    }
  }

  buildSteam() {
    this.emitters = [
      { x: -4.2, z: -10 },
      { x: 4.4, z: -90 },
      { x: -3.8, z: -170 },
    ];
    const N = 90;
    this.steamN = N;
    this.sPos = new Float32Array(N * 3);
    this.sCol = new Float32Array(N * 3);
    this.sVel = new Float32Array(N);
    this.sLife = new Float32Array(N);
    this.sMax = new Float32Array(N);
    this.sSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) this.respawnSteam(i, true);
    const geo = new THREE.BufferGeometry();
    this.sPosAttr = new THREE.BufferAttribute(this.sPos, 3);
    this.sColAttr = new THREE.BufferAttribute(this.sCol, 3);
    this.sPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.sColAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.sPosAttr);
    geo.setAttribute('color', this.sColAttr);
    this.steam = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 2.8, map: this.glowTex, transparent: true, opacity: 0.1,
      vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.steam.frustumCulled = false;
    this.steam.renderOrder = 4;
    this.scene.add(this.steam);
  }

  respawnSteam(i, randomAge = false) {
    const e = pick(this.emitters);
    this.sPos[i * 3] = e.x + rnd(-0.8, 0.8);
    this.sPos[i * 3 + 1] = rnd(0, 0.5);
    this.sPos[i * 3 + 2] = e.z + rnd(-1.5, 1.5);
    this.sVel[i] = rnd(0.7, 1.3);
    this.sMax[i] = rnd(2.5, 4.5);
    this.sLife[i] = randomAge ? Math.random() * this.sMax[i] : this.sMax[i];
    this.sSeed[i] = Math.random() * 100;
  }

  updateSteam(dt, time, pz) {
    for (const e of this.emitters) {
      if (e.z > pz + 20) e.z -= 260;
      else if (e.z < pz - 240) e.z += 260;
    }
    for (let i = 0; i < this.steamN; i++) {
      this.sLife[i] -= dt;
      if (this.sLife[i] <= 0) {
        this.respawnSteam(i);
        continue;
      }
      const i3 = i * 3;
      this.sPos[i3 + 1] += this.sVel[i] * dt;
      this.sPos[i3] += Math.sin(time * 0.8 + this.sSeed[i]) * dt * 0.35;
      const k = 1 - this.sLife[i] / this.sMax[i];
      const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
      this.sCol[i3] = 0.3 * fade;
      this.sCol[i3 + 1] = 0.36 * fade;
      this.sCol[i3 + 2] = 0.52 * fade;
    }
    this.sPosAttr.needsUpdate = true;
    this.sColAttr.needsUpdate = true;
  }

  buildVehicles() {
    this.vehicles = [];
    const mk = (dir, x, y, speed, color) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 4.2), this.darkMat));
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.12, 1.2),
        new THREE.MeshBasicMaterial({ color })
      );
      strip.position.y = 0.28;
      g.add(strip);
      const hlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) });
      for (const s of [-0.7, 0.7]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), hlMat);
        hl.position.set(s, 0, dir > 0 ? 2.12 : -2.12);
        g.add(hl);
      }
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.14, 0.1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.3) })
      );
      tail.position.set(0, 0.05, dir > 0 ? -2.12 : 2.12);
      g.add(tail);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0x3388ff, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(6, 3, 1);
      glow.position.y = -0.6;
      g.add(glow);
      const blink = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.3) })
      );
      blink.position.y = 0.45;
      g.add(blink);
      g.position.set(x, y, 0);
      this.scene.add(g);
      this.vehicles.push({ g, dir, speed, blink, phase: Math.random(), baseY: y });
    };
    mk(1, -6, 17, 30, new THREE.Color(0.4, 1.8, 2.2));
    mk(-1, 7.5, 22, 38, new THREE.Color(2.2, 0.5, 1.8));
    this.vehicles[0].g.position.z = -60;
    this.vehicles[1].g.position.z = -120;
  }

  updateVehicles(dt, time, pz) {
    for (const v of this.vehicles) {
      v.g.position.z += v.dir * v.speed * dt;
      if (v.g.position.z > pz + 40) v.g.position.z -= 320;
      else if (v.g.position.z < pz - 280) v.g.position.z += 320;
      v.g.position.y = v.baseY + Math.sin(time * 1.3 + v.phase * 9) * 0.35;
      v.blink.visible = ((time * 1.6 + v.phase) % 1) < 0.55;
    }
  }

  update(dt, time, pz) {
    for (const g of this.segments) {
      if (g.position.z - pz > SEG_LEN * 1.5) g.position.z -= SPAN;
      else if (g.position.z - pz < -(SPAN - SEG_LEN * 1.5)) g.position.z += SPAN;
    }
    for (const f of this.flickers) {
      f.mat.color.setScalar(f.base * flickerPattern(time, f.seed));
    }
    this.ticker.draw(dt);
    for (const l of this.heroLights) {
      if (l.position.z > pz + 25) l.position.z -= 240;
      else if (l.position.z < pz - 215) l.position.z += 240;
    }
    this.updateSteam(dt, time, pz);
    this.updateVehicles(dt, time, pz);
  }
}
