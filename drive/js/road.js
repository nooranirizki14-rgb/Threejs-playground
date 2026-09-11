import * as THREE from 'three';
import { makeRoadBoard, makeGlowSprite } from './textures.js';
import { fmtKm, rnd } from './utils.js';

// Lane layout (left-hand traffic, driving toward -Z on x<0):
export const LANES_ME = [-5.35, -1.75];   // player direction
export const LANES_ON = [1.75, 5.35];     // oncoming
const SPAN = 600;   // recycled span
const BEHIND = 80;  // coverage behind player

// Generic wrap helper for span-recycled items.
function wrapZ(z, pz) {
  while (z - pz > BEHIND) z -= SPAN;
  while (z - pz < -(SPAN - BEHIND)) z += SPAN;
  return z;
}

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.dummy = new THREE.Object3D();
    this.signProvider = null; // game injects: () => ({fuel, motel, city})
    this.gaps = []; // [{z, side}] station entrance gaps

    this.buildDashes();
    this.buildEdges();
    this.buildMedian();
    this.buildRails();
    this.buildLamps();
    this.buildGantries();
    this.buildTrees();
  }

  // ---- lane divider dashes (instanced) ----
  buildDashes() {
    const geo = new THREE.BoxGeometry(0.15, 0.02, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfd4e8 });
    const perLine = Math.ceil(SPAN / 9);
    this.dashZ = [];
    const spots = [];
    for (const x of [-3.55, 3.55]) {
      for (let i = 0; i < perLine; i++) {
        spots.push({ x, z: -i * 9 });
        this.dashZ.push(-i * 9);
      }
    }
    this.dashes = new THREE.InstancedMesh(geo, mat, spots.length);
    this.dashSpots = spots;
    this.dashes.frustumCulled = false;
    this.scene.add(this.dashes);
    this.layoutDashes(0);
  }

  layoutDashes(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.dashSpots.length; i++) {
      const s = this.dashSpots[i];
      const z = wrapZ(this.dashZ[i], pz);
      this.dashZ[i] = z;
      d.position.set(s.x, 0.015, z);
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.dashes.setMatrixAt(i, d.matrix);
    }
    this.dashes.instanceMatrix.needsUpdate = true;
  }

  // ---- solid edge lines (long planes follow player) ----
  buildEdges() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8ecff });
    this.edges = [];
    for (const x of [-7.4, 7.4]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, SPAN), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.015, 0);
      this.scene.add(m);
      this.edges.push(m);
    }
  }

  // ---- median concrete barrier + reflector posts ----
  buildMedian() {
    const geo = new THREE.BoxGeometry(0.5, 0.9, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.9 });
    this.medZ = [];
    const n = Math.ceil(SPAN / 6);
    for (let i = 0; i < n; i++) this.medZ.push(-i * 6);
    this.median = new THREE.InstancedMesh(geo, mat, n);
    this.median.frustumCulled = false;
    this.scene.add(this.median);

    const pgeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
    const pmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.3) });
    this.postZ = [];
    const np = Math.ceil(SPAN / 30);
    for (let i = 0; i < np; i++) this.postZ.push(-i * 30);
    this.posts = new THREE.InstancedMesh(pgeo, pmat, np);
    this.posts.frustumCulled = false;
    this.scene.add(this.posts);
    this.layoutMedian(0);
  }

  layoutMedian(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.medZ.length; i++) {
      this.medZ[i] = wrapZ(this.medZ[i], pz);
      d.position.set(0, 0.45, this.medZ[i]);
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.median.setMatrixAt(i, d.matrix);
    }
    this.median.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.postZ.length; i++) {
      this.postZ[i] = wrapZ(this.postZ[i], pz);
      d.position.set(0, 1.1, this.postZ[i]);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.posts.setMatrixAt(i, d.matrix);
    }
    this.posts.instanceMatrix.needsUpdate = true;
  }

  // ---- side guard barriers with gaps at station entrances ----
  buildRails() {
    const geo = new THREE.BoxGeometry(0.45, 0.85, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.85 });
    this.railSpots = [];
    const n = Math.ceil(SPAN / 10);
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) this.railSpots.push({ side, z: -i * 10 });
    }
    this.rails = new THREE.InstancedMesh(geo, mat, this.railSpots.length);
    this.rails.frustumCulled = false;
    this.scene.add(this.rails);
    // reflective strip on top of rails
    const sgeo = new THREE.BoxGeometry(0.1, 0.08, 9.6);
    const smat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.8) });
    this.railStrips = new THREE.InstancedMesh(sgeo, smat, this.railSpots.length);
    this.railStrips.frustumCulled = false;
    this.scene.add(this.railStrips);
    this.layoutRails(0);
  }

  inGap(z, side) {
    for (const g of this.gaps) {
      if (g.side === side && Math.abs(z - g.z) < 58) return true;
    }
    return false;
  }

  layoutRails(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.railSpots.length; i++) {
      const s = this.railSpots[i];
      s.z = wrapZ(s.z, pz);
      const hidden = this.inGap(s.z, s.side);
      d.position.set(s.side * 8.9, hidden ? -5 : 0.42, s.z);
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.rails.setMatrixAt(i, d.matrix);
      d.position.y = hidden ? -5 : 0.88;
      d.updateMatrix();
      this.railStrips.setMatrixAt(i, d.matrix);
    }
    this.rails.instanceMatrix.needsUpdate = true;
    this.railStrips.instanceMatrix.needsUpdate = true;
  }

  setGaps(gaps) {
    this.gaps = gaps;
  }

  // drivable half-width at a given z (rails vs open lot entrance)
  xLimitAt(z) {
    for (const g of this.gaps) {
      if (Math.abs(z - g.z) < 55) return 30;
    }
    return 8.6;
  }

  gapSideAt(z) {
    for (const g of this.gaps) {
      if (Math.abs(z - g.z) < 55) return g.side;
    }
    return 0;
  }

  // ---- street lamps (instanced) + 2 pooled real spotlights ----
  buildLamps() {
    this.lampZ = [];
    this.lampSide = [];
    const n = 15;
    for (let i = 0; i < n; i++) {
      this.lampZ.push(-i * (SPAN / n));
      this.lampSide.push(i % 2 === 0 ? -1 : 1);
    }
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 9, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x11141f, roughness: 0.8 });
    this.poles = new THREE.InstancedMesh(poleGeo, poleMat, n);
    this.poles.frustumCulled = false;
    this.scene.add(this.poles);

    const headGeo = new THREE.BoxGeometry(1.6, 0.18, 0.5);
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.2) });
    this.lampHeads = new THREE.InstancedMesh(headGeo, headMat, n);
    this.lampHeads.frustumCulled = false;
    this.scene.add(this.lampHeads);

    // fake light pools on the road
    const poolGeo = new THREE.PlaneGeometry(13, 13);
    const poolMat = new THREE.MeshBasicMaterial({
      map: makeGlowSprite({}), color: 0xffc98a, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.pools = new THREE.InstancedMesh(poolGeo, poolMat, n);
    this.pools.frustumCulled = false;
    this.scene.add(this.pools);
    this.layoutLamps(0);

    // 2 real spotlights follow the nearest lamps ahead
    this.spots = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xffd9a0, 60, 42, 0.62, 0.6, 2);
      s.position.set(0, 9, 0);
      s.target.position.set(0, 0, 0);
      this.scene.add(s);
      this.scene.add(s.target);
      this.spots.push(s);
    }
  }

  layoutLamps(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.lampZ.length; i++) {
      this.lampZ[i] = wrapZ(this.lampZ[i], pz);
      const x = this.lampSide[i] * 9.6;
      d.position.set(x, 4.5, this.lampZ[i]);
      d.scale.set(1, 1, 1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.poles.setMatrixAt(i, d.matrix);
      d.position.set(x - this.lampSide[i] * 1.2, 9, this.lampZ[i]);
      d.updateMatrix();
      this.lampHeads.setMatrixAt(i, d.matrix);
      d.position.set(x - this.lampSide[i] * 1.5, 0.03, this.lampZ[i]);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.updateMatrix();
      this.pools.setMatrixAt(i, d.matrix);
    }
    this.poles.instanceMatrix.needsUpdate = true;
    this.lampHeads.instanceMatrix.needsUpdate = true;
    this.pools.instanceMatrix.needsUpdate = true;
  }

  updateSpots(pz) {
    // two nearest lamps ahead of the player
    const ahead = [];
    for (let i = 0; i < this.lampZ.length; i++) {
      const dz = pz - this.lampZ[i];
      if (dz > 8 && dz < 200) ahead.push({ dz, i });
    }
    ahead.sort((a, b) => a.dz - b.dz);
    for (let k = 0; k < 2; k++) {
      const s = this.spots[k];
      if (k < ahead.length) {
        const i = ahead[k].i;
        const x = this.lampSide[i] * 8.4;
        s.position.set(x, 9, this.lampZ[i]);
        s.target.position.set(x * 0.4, 0, this.lampZ[i]);
        s.visible = true;
      } else {
        s.visible = false;
      }
    }
  }

  // ---- overhead gantry signs ----
  buildGantries() {
    this.gantries = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      for (const px of [-8.2, 8.2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 7.5, 8), poleMat);
        pole.position.set(px, 3.75, 0);
        g.add(pole);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.7, 0.7), poleMat);
      beam.position.y = 7.2;
      g.add(beam);
      const boards = [];
      for (const bx of [-4.2, 4.2]) {
        const b = makeRoadBoard({});
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(7.4, 3.7),
          new THREE.MeshBasicMaterial({ map: b.tex })
        );
        m.material.color.setScalar(1.35);
        m.position.set(bx, 5.1, 0);
        g.add(m);
        boards.push(b);
      }
      g.position.z = -i * 100;
      this.scene.add(g);
      this.gantries.push({ g, boards, painted: -1 });
    }
  }

  updateGantries(pz) {
    for (const gt of this.gantries) {
      let z = gt.g.position.z;
      let wrapped = false;
      while (z - pz > 40) { z -= SPAN; wrapped = true; }
      while (z - pz < -(SPAN - 40)) { z += SPAN; wrapped = true; }
      gt.g.position.z = z;
      if ((wrapped || gt.painted < 0) && this.signProvider) {
        const info = this.signProvider(z);
        gt.boards[0].draw([
          { text: info.fuel ? `SPBU ${info.fuel.side < 0 ? '←' : '→'} ${fmtKm(info.fuel.dist)}` : 'SPBU —' },
          { text: info.motel ? `MOTEL ${info.motel.side < 0 ? '←' : '→'} ${fmtKm(info.motel.dist)}` : '—' },
        ]);
        gt.boards[1].draw([
          { text: info.city.name, big: true },
          { text: fmtKm(info.city.dist) + '   KM ' + info.km },
        ]);
        gt.painted = z;
      }
    }
  }

  // ---- roadside trees ----
  buildTrees() {
    const geo = new THREE.ConeGeometry(1, 1, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x02040a });
    const n = 170;
    this.treeData = [];
    for (let i = 0; i < n; i++) {
      this.treeData.push({
        side: Math.random() < 0.5 ? -1 : 1,
        x: rnd(13, 70),
        z: rnd(-SPAN, 0),
        w: rnd(3, 7),
        h: rnd(7, 15),
      });
    }
    this.trees = new THREE.InstancedMesh(geo, mat, n);
    this.trees.frustumCulled = false;
    this.scene.add(this.trees);
    this.layoutTrees(0);
  }

  layoutTrees(pz) {
    const d = this.dummy;
    for (let i = 0; i < this.treeData.length; i++) {
      const t = this.treeData[i];
      t.z = wrapZ(t.z, pz);
      d.position.set(t.side * t.x, t.h / 2 - 0.2, t.z);
      d.scale.set(t.w, t.h, t.w);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.trees.setMatrixAt(i, d.matrix);
    }
    this.trees.instanceMatrix.needsUpdate = true;
  }

  update(dt, pz) {
    this.layoutDashes(pz);
    this.layoutMedian(pz);
    this.layoutRails(pz);
    this.layoutLamps(pz);
    this.updateSpots(pz);
    this.updateGantries(pz);
    this.layoutTrees(pz);
    for (const e of this.edges) e.position.z = pz - 220;
  }
}
