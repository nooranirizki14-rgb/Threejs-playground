import * as THREE from 'three';
import {
  makeNeonSign, makeVerticalSign, makeTotem, makeRoadBoard,
  makePumpFace, makeGlowSprite, makeDetail,
} from './textures.js';
import { mulberry32, fmtRp } from './utils.js';

export const STATION_GAP = 1500;
const FLAVORS = ['mart', 'motel', 'diner']; // GAS+MART / GAS+MOTEL+GARAGE / DINER+REST
const BRANDS = ['NUSANTARA FUEL', 'GARUDA PETRO', 'BORNEO OIL', 'KHATULISTIWA'];
export const CITIES = [
  ['PENAJAM', 18000], ['BALIKPAPAN', 65000], ['SAMARINDA', 140000],
  ['BANJARMASIN', 400000], ['NUSANTARA', 900000],
];

// local->world: lot extends outward (-x) from road edge
const LOT_X = 8.6;
const wx = (lx) => -(LOT_X + lx);

class Station {
  constructor(scene, glowTex) {
    this.scene = scene;
    this.glowTex = glowTex;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.number = 0;
    this.flavor = 'mart';
    this.side = -1;
    this.z = 0;
    this.fuelPrice = 14000;
    this.brand = BRANDS[0];
    this.colliders = [];
    this.zones = [];
    this.washActive = false;
    this.washT = 0;
    this.flickerMats = [];
    this.buildStatic();
  }

  mat(color, rough = 0.9) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough });
  }

  neonBoost(mesh, v = 2.2) {
    mesh.material.color.setScalar(v);
    return mesh;
  }

  buildStatic() {
    const g = this.group;
    const dark = this.mat(0x0a0d16);
    const conc = this.mat(0x141821);

    // lot slab
    const lot = new THREE.Mesh(new THREE.BoxGeometry(26, 0.1, 96), conc);
    lot.position.set(wx(13), -0.05, 0);
    g.add(lot);

    // ---- canopy + pumps (hidden for diner) ----
    this.fuelGroup = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 26), dark);
    roof.position.set(wx(8), 5.2, 1);
    this.fuelGroup.add(roof);
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 5.2, 8);
    for (const [lx, lz] of [[3.6, -10], [12.4, -10], [3.6, 12], [12.4, 12]]) {
      const p = new THREE.Mesh(poleGeo, dark);
      p.position.set(wx(lx), 2.6, lz);
      this.fuelGroup.add(p);
    }
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(9.4, 25),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.2, 0.8) })
    );
    under.rotation.x = Math.PI / 2;
    under.position.set(wx(8), 4.98, 1);
    this.fuelGroup.add(under);
    this.canopySign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.1),
      new THREE.MeshBasicMaterial({ map: makeNeonSign({ text: 'BBM', color: '#00e5ff' }), transparent: true })
    ));
    this.canopySign.position.set(wx(3.05), 4.5, 1);
    this.canopySign.rotation.y = Math.PI / 2;
    this.fuelGroup.add(this.canopySign);

    // pump islands
    this.pumpFaceTex = makePumpFace({});
    this.pumpIslands = [];
    for (const lz of [-4, 6]) {
      const isl = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.4), conc);
      base.position.y = 0.12;
      isl.add(base);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.65),
        new THREE.MeshStandardMaterial({ color: 0xb03030, roughness: 0.5, metalness: 0.3 }));
      pump.position.y = 1.05;
      isl.add(pump);
      for (const s of [-1, 1]) {
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05),
          new THREE.MeshBasicMaterial({ map: this.pumpFaceTex }));
        face.material.color.setScalar(1.4);
        face.position.set(s * 0.46, 1.05, 0);
        face.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        isl.add(face);
      }
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 12, Math.PI), dark);
      hose.position.set(0, 0.9, 0.36);
      isl.add(hose);
      isl.position.set(wx(8), 0, lz);
      this.fuelGroup.add(isl);
      this.pumpIslands.push({ lx: 8, lz });
    }
    // canopy point light (toggled by distance)
    this.canopyLight = new THREE.PointLight(0xffd9a0, 50, 48, 2);
    this.canopyLight.position.set(wx(8), 4.6, 1);
    this.fuelGroup.add(this.canopyLight);
    g.add(this.fuelGroup);

    // ---- price totem ----
    this.totem = makeTotem({ brand: this.brand });
    const totemPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 3, 8), dark);
    totemPole.position.set(wx(2), 1.5, 40);
    g.add(totemPole);
    const totemBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 1.9), dark);
    totemBox.position.set(wx(2), 5.2, 40);
    g.add(totemBox);
    for (const s of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 4.2),
        new THREE.MeshBasicMaterial({ map: this.totem.tex }));
      face.material.color.setScalar(1.5);
      face.position.set(wx(2) + s * 0.26, 5.2, 40);
      face.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(face);
    }

    // ---- entrance road sign ----
    this.entryBoard = makeRoadBoard({ w: 512, h: 192 });
    const entryPole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 8), dark);
    entryPole.position.set(-9.6, 1.7, 72);
    g.add(entryPole);
    const entry = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9),
      new THREE.MeshBasicMaterial({ map: this.entryBoard.tex }));
    entry.material.color.setScalar(1.3);
    entry.position.set(-9.6, 4.2, 72);
    g.add(entry);

    // ---- shop (mart + motel lobbies share it) ----
    this.shopGroup = new THREE.Group();
    const shop = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), this.mat(0x101524));
    shop.position.set(wx(17), 2, -8);
    this.shopGroup.add(shop);
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.8) });
    for (const dz of [-10.5, -8, -5.5]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), winMat);
      win.position.set(wx(11.95), 1.9, dz);
      win.rotation.y = Math.PI / 2;
      this.shopGroup.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x1a2438 }));
    door.position.set(wx(11.95), 1.2, -8);
    door.rotation.y = Math.PI / 2;
    this.shopGroup.add(door);
    this.shopSign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.5),
      new THREE.MeshBasicMaterial({ map: makeNeonSign({ text: 'MART 24H', color: '#7dff6a' }), transparent: true })
    ));
    this.shopSign.position.set(wx(11.9), 4.6, -8);
    this.shopSign.rotation.y = Math.PI / 2;
    this.shopGroup.add(this.shopSign);
    g.add(this.shopGroup);

    // ---- motel block ----
    this.motelGroup = new THREE.Group();
    const motel = new THREE.Mesh(new THREE.BoxGeometry(14, 3.6, 7), this.mat(0x181226));
    motel.position.set(wx(16), 1.8, -30);
    this.motelGroup.add(motel);
    const litMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.1, 0.6) });
    const darkWin = new THREE.MeshBasicMaterial({ color: 0x0a0d18 });
    this.motelWindows = [];
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1),
        Math.random() < 0.5 ? litMat : darkWin);
      w.position.set(wx(8.9), 1.9, -33.4 + i * 1.7);
      w.rotation.y = Math.PI / 2;
      this.motelGroup.add(w);
      this.motelWindows.push(w);
    }
    this.motelSign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 4.2),
      new THREE.MeshBasicMaterial({
        map: makeVerticalSign({ text: 'MOTEL', color: '#ff2fd6' }), transparent: true,
      })
    ));
    this.motelSign.position.set(wx(8.7), 4.4, -27.5);
    this.motelSign.rotation.y = Math.PI / 2;
    this.motelGroup.add(this.motelSign);
    this.flickerMats.push(this.motelSign.material);
    const vac = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.9),
      new THREE.MeshBasicMaterial({
        map: makeNeonSign({ text: 'VACANCY', color: '#ffb03d', w: 512, h: 128 }), transparent: true,
      })
    ), 2.4);
    vac.position.set(wx(8.9), 3.4, -30);
    vac.rotation.y = Math.PI / 2;
    this.motelGroup.add(vac);
    g.add(this.motelGroup);

    // ---- garage ----
    this.garageGroup = new THREE.Group();
    const gar = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 8), this.mat(0x14202c));
    gar.position.set(wx(16), 2.25, 27);
    this.garageGroup.add(gar);
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.4, 1.6) }));
    opening.position.set(wx(10.9), 1.6, 27);
    opening.rotation.y = Math.PI / 2;
    this.garageGroup.add(opening);
    const garSign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 1.4),
      new THREE.MeshBasicMaterial({ map: makeNeonSign({ text: 'BENGKEL', color: '#4dc9ff' }), transparent: true })
    ));
    garSign.position.set(wx(10.85), 4.9, 27);
    garSign.rotation.y = Math.PI / 2;
    this.garageGroup.add(garSign);
    g.add(this.garageGroup);

    // ---- diner ----
    this.dinerGroup = new THREE.Group();
    const din = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 7), this.mat(0x241418));
    din.position.set(wx(16), 1.8, -5);
    this.dinerGroup.add(din);
    const dinWin = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.4), winMat);
    dinWin.position.set(wx(11.45), 1.9, -5);
    dinWin.rotation.y = Math.PI / 2;
    this.dinerGroup.add(dinWin);
    const dinSign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.5),
      new THREE.MeshBasicMaterial({ map: makeNeonSign({ text: 'WARKOP', sub: 'DINER · KOPI · MIE', color: '#ff9a3d' }), transparent: true })
    ));
    dinSign.position.set(wx(11.4), 4.3, -5);
    dinSign.rotation.y = Math.PI / 2;
    this.dinerGroup.add(dinSign);
    // picnic tables
    const tableMat = this.mat(0x2a1f14);
    for (const [lx, lz] of [[10, -18], [13, -21]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 10), tableMat);
      top.position.set(wx(lx), 0.8, lz);
      this.dinerGroup.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6), tableMat);
      leg.position.set(wx(lx), 0.4, lz);
      this.dinerGroup.add(leg);
    }
    g.add(this.dinerGroup);

    // ---- car wash ----
    this.washGroup = new THREE.Group();
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 0.4), dark);
      pole.position.set(wx(6) + s * 2.2, 1.7, 24);
      this.washGroup.add(pole);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 0.5), dark);
    beam.position.set(wx(6), 3.5, 24);
    this.washGroup.add(beam);
    const washSign = this.neonBoost(new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.0),
      new THREE.MeshBasicMaterial({ map: makeNeonSign({ text: 'CUCI MOBIL', color: '#00e5ff', w: 512, h: 128 }), transparent: true })
    ), 2.0);
    washSign.position.set(wx(6), 4.3, 24.2);
    this.washGroup.add(washSign);
    this.brushes = [];
    const brushMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 1 });
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.6, 10), brushMat);
      b.position.set(wx(6) + s * 1.7, 1.4, 24);
      this.washGroup.add(b);
      this.brushes.push(b);
    }
    g.add(this.washGroup);
    // soap particles
    const SN = 60;
    this.soapN = SN;
    this.soapPos = new Float32Array(SN * 3);
    this.soapLife = new Float32Array(SN);
    for (let i = 0; i < SN; i++) this.soapPos[i * 3 + 1] = -99;
    const sgeo = new THREE.BufferGeometry();
    this.soapAttr = new THREE.BufferAttribute(this.soapPos, 3);
    this.soapAttr.setUsage(THREE.DynamicDrawUsage);
    sgeo.setAttribute('position', this.soapAttr);
    this.soap = new THREE.Points(sgeo, new THREE.PointsMaterial({
      size: 0.22, map: this.glowTex, color: 0x9adcff, transparent: true, opacity: 0.8,
      depthWrite: false,
    }));
    this.soap.frustumCulled = false;
    this.washGroup.add(this.soap);
    this.soapHead = 0;

    // ---- lamps, cones, barrels ----
    for (const [lx, lz] of [[4, -28], [4, 28], [15, 0]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), dark);
      pole.position.set(wx(lx), 3.5, lz);
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 1.2) }));
      head.position.set(wx(lx), 7, lz);
      g.add(head);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11),
        new THREE.MeshBasicMaterial({
          map: this.glowTex, color: 0xffc98a, transparent: true, opacity: 0.2,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(wx(lx), 0.03, lz);
      g.add(pool);
    }
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xcc4400, roughness: 0.8 });
    for (const [lx, lz] of [[6, 18], [6, 20.5], [6, 30], [10, -14]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 8), coneMat);
      cone.position.set(wx(lx), 0.28, lz);
      g.add(cone);
    }
  }

  // configure pool slot as station number n
  assign(n) {
    this.number = n;
    this.z = -n * STATION_GAP;
    this.group.position.z = this.z;
    const rng = mulberry32(n * 2654435761);
    this.flavor = FLAVORS[n % 3];
    this.brand = BRANDS[Math.floor(rng() * BRANDS.length)];
    this.fuelPrice = 13000 + Math.floor(rng() * 9) * 250; // 13.000–15.000
    const hasFuel = this.flavor !== 'diner';
    const hasWash = this.flavor !== 'diner' && (this.flavor === 'motel' || rng() < 0.7);

    this.fuelGroup.visible = hasFuel;
    this.shopGroup.visible = this.flavor === 'mart';
    this.motelGroup.visible = this.flavor === 'motel';
    this.garageGroup.visible = this.flavor === 'motel';
    this.dinerGroup.visible = this.flavor === 'diner';
    this.washGroup.visible = hasWash;
    this.washActive = false;

    // repaint totem + entry board
    if (hasFuel) {
      this.totem.draw('Rp ' + this.fuelPrice.toLocaleString('id-ID'));
    }
    const entryLines = hasFuel
      ? [{ text: 'SPBU ' + this.brand }, { text: 'MASUK ← 200 m' }]
      : [{ text: 'WARKOP · REST AREA' }, { text: 'MASUK ← 200 m' }];
    this.entryBoard.draw(entryLines);
    // motel window randomization
    if (this.flavor === 'motel') {
      for (const w of this.motelWindows) {
        const lit = rng() < 0.5;
        w.material = lit
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.1, 0.6) })
          : new THREE.MeshBasicMaterial({ color: 0x0a0d18 });
      }
    }

    // colliders (world space)
    const C = [];
    const addC = (lx, lz, r) => C.push({ x: wx(lx), z: this.z + lz, r });
    if (hasFuel) {
      for (const p of this.pumpIslands) addC(p.lx, p.lz, 1.3);
      for (const [lx, lz] of [[3.6, -10], [12.4, -10], [3.6, 12], [12.4, 12]]) addC(lx, lz, 0.4);
    }
    addC(2, 40, 0.8);
    if (this.flavor === 'mart') {
      addC(14, -11, 2.4); addC(17, -8, 2.4); addC(20, -5, 2.4);
    }
    if (this.flavor === 'motel') {
      addC(11, -33, 2.2); addC(15, -30, 2.6); addC(19, -27, 2.2);
      addC(13, 24, 2.4); addC(17, 27, 2.6);
    }
    if (this.flavor === 'diner') {
      addC(13, -7, 2.2); addC(17, -5, 2.4);
      addC(10, -18, 0.9); addC(13, -21, 0.9);
    }
    if (hasWash) {
      addC(3.8, 24, 0.5); addC(8.2, 24, 0.5);
    }
    for (const [lx, lz] of [[4, -28], [4, 28], [15, 0]]) addC(lx, lz, 0.35);
    this.colliders = C;

    // interaction zones (world space)
    const Z = [];
    const addZ = (type, lx, lz, r, label) => Z.push({ type, x: wx(lx), z: this.z + lz, r, label, st: this });
    if (hasFuel) {
      for (const p of this.pumpIslands) addZ('pump', p.lx, p.lz, 3.2, 'Fuel pump');
    }
    if (this.flavor === 'mart') addZ('shop', 11, -8, 3, 'Mart 24H');
    if (this.flavor === 'motel') {
      addZ('motel', 9.5, -30, 3, 'Motel Melati');
      addZ('garage', 10.5, 27, 3.4, 'Bengkel');
    }
    if (this.flavor === 'diner') {
      addZ('diner', 11, -5, 3, 'Warkop Diner');
      addZ('rest', 11.5, -19.5, 3, 'Rest area');
    }
    this.zones = Z;
    this.pumpPoints = hasFuel ? this.pumpIslands.map((p) => ({ x: wx(p.lx), z: this.z + p.lz })) : [];
  }

  update(dt, time, activeWash) {
    // flicker motel sign
    for (const m of this.flickerMats) {
      if (!this.motelGroup.visible) break;
      const n = Math.sin(time * 29 + this.number) * Math.sin(time * 13.7 + this.number * 2);
      m.color.setScalar(n > -0.8 ? 2.2 : 0.4);
    }
    // wash brushes + soap
    this.washActive = !!activeWash;
    if (this.washActive && this.washGroup.visible) {
      for (const b of this.brushes) b.rotation.y += dt * 9;
      for (let i = 0; i < 3; i++) {
        const k = this.soapHead;
        this.soapHead = (this.soapHead + 1) % this.soapN;
        this.soapPos[k * 3] = wx(6) + (Math.random() - 0.5) * 3;
        this.soapPos[k * 3 + 1] = 0.3 + Math.random() * 2.2;
        this.soapPos[k * 3 + 2] = 24 + (Math.random() - 0.5) * 2;
        this.soapLife[k] = 0.7;
      }
    }
    let dirty = false;
    for (let i = 0; i < this.soapN; i++) {
      if (this.soapLife[i] <= 0) continue;
      this.soapLife[i] -= dt;
      if (this.soapLife[i] <= 0) {
        this.soapPos[i * 3 + 1] = -99;
      } else {
        this.soapPos[i * 3 + 1] -= dt * 1.5;
      }
      dirty = true;
    }
    if (dirty) this.soapAttr.needsUpdate = true;
  }
}

export class Stations {
  constructor(scene) {
    this.scene = scene;
    this.glowTex = makeGlowSprite({});
    this.pool = [];
    for (let i = 0; i < 5; i++) this.pool.push(new Station(scene, this.glowTex));
    this.maxNum = 0;
    this.layoutFor(20);
  }

  layoutFor(pz) {
    const cur = Math.floor(-pz / STATION_GAP);
    const start = Math.max(1, cur - 1);
    this.maxNum = start + this.pool.length - 1;
    this.pool.forEach((s, i) => s.assign(start + i));
  }

  update(dt, time, pz, washStation) {
    for (const s of this.pool) {
      if (s.z - pz > 300) {
        this.maxNum += 1;
        s.assign(this.maxNum);
      }
      s.update(dt, time, washStation === s);
      // only nearest 2 canopy lights on (perf)
      const dz = Math.abs(s.z - pz);
      s.canopyLight.visible = dz < 2200;
    }
    // gaps for road rails
    return this.pool.map((s) => ({ z: s.z, side: -1 }));
  }

  // nearest pump island to a world position
  nearestPump(x, z) {
    let best = null;
    let bd = 1e9;
    for (const s of this.pool) {
      for (const p of s.pumpPoints) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bd) {
          bd = d;
          best = { d, st: s, x: p.x, z: p.z };
        }
      }
    }
    return best;
  }

  zonesNear(x, z) {
    const out = [];
    for (const s of this.pool) {
      for (const zn of s.zones) {
        if (Math.hypot(x - zn.x, z - zn.z) < zn.r) out.push(zn);
      }
    }
    return out;
  }

  collidersNear(x, z, radius) {
    const out = [];
    for (const s of this.pool) {
      if (Math.abs(s.z - z) > 120) continue;
      for (const c of s.colliders) {
        if (Math.hypot(x - c.x, z - c.z) < radius + c.r) out.push(c);
      }
    }
    return out;
  }

  // next station ahead matching filter: 'fuel' | 'rest' | 'garage' | 'any'
  ahead(pz, filter = 'any') {
    let best = null;
    for (const s of this.pool) {
      const dz = pz - s.z; // >0 means ahead
      if (dz < 20) continue;
      if (filter === 'fuel' && s.flavor === 'diner') continue;
      if (filter === 'rest' && s.flavor === 'mart') continue;
      if (filter === 'garage' && s.flavor !== 'motel') continue;
      if (!best || dz < best.dz) best = { dz, st: s };
    }
    return best;
  }

  // next N stations ahead, nearest first (minimap, hitchhikers)
  aheadList(pz, n = 4) {
    return this.pool
      .map((s) => ({
        dz: pz - s.z,
        z: s.z,
        flavor: s.flavor,
        fuel: s.pumpIslands.length > 0,
      }))
      .filter((s) => s.dz > 20)
      .sort((a, b) => a.dz - b.dz)
      .slice(0, n);
  }

  signInfo(boardZ) {
    const pz = boardZ;
    const fuel = this.ahead(pz, 'fuel');
    const rest = this.ahead(pz, 'rest');
    const traveled = Math.max(0, 20 - pz);
    let city = { name: CITIES[CITIES.length - 1][0], dist: 0 };
    for (const [name, at] of CITIES) {
      if (at > traveled) {
        city = { name, dist: at - traveled };
        break;
      }
    }
    return {
      fuel: fuel ? { dist: fuel.dz, side: -1 } : null,
      motel: rest ? { dist: rest.dz, side: -1 } : null,
      city,
      km: Math.floor(traveled / 1000),
    };
  }

  washTrigger(x, z) {
    // inside a wash arch?
    for (const s of this.pool) {
      if (!s.washGroup.visible) continue;
      if (Math.abs(x - wx(6)) < 1.9 && Math.abs(z - (s.z + 24)) < 2.2) return s;
    }
    return null;
  }

  garageForTow(pz) {
    return this.ahead(pz, 'garage') || this.ahead(pz, 'any');
  }

  serializeCrew() {
    return { maxNum: this.maxNum };
  }
}
