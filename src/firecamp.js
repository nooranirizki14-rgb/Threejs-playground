import * as THREE from 'three';
import { rnd, makeCanvas } from './utils.js';

// Campfire clearing: stone ring, fuel logs, layered flames, sparks,
// embers, smoke, flickering shadow-casting light, sittable log seats.
export const FIRE_POS = new THREE.Vector3(-8.5, 0, -13);

function glowTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,150,60,0.95)');
  grad.addColorStop(0.4, 'rgba(255,120,40,0.35)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function smokeTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(160,160,170,0.5)');
  grad.addColorStop(1, 'rgba(160,160,170,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class FireCamp {
  constructor(scene) {
    const g = new THREE.Group();
    g.position.copy(FIRE_POS);
    scene.add(g);
    this.group = g;

    // ash bed + stone ring + fuel logs
    const ash = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 })
    );
    ash.rotation.x = -Math.PI / 2;
    ash.position.y = 0.02;
    ash.receiveShadow = true;
    g.add(ash);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 1 });
    const stoneGeo = new THREE.DodecahedronGeometry(0.13, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = new THREE.Mesh(stoneGeo, stoneMat);
      s.position.set(Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75);
      s.rotation.set(rnd(0, 3), rnd(0, 3), 0);
      s.castShadow = true;
      g.add(s);
    }
    const charMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 });
    const fuelGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.1, 7);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const log = new THREE.Mesh(fuelGeo, charMat);
      log.position.set(Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25);
      log.rotation.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5 + Math.PI / 2.3);
      log.castShadow = true;
      g.add(log);
    }

    // layered flames (bloom makes them glow)
    const flame = (r, h, color, opacity, y) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      );
      m.position.y = y;
      g.add(m);
      return m;
    };
    this.fOuter = flame(0.35, 1.0, 0xff4400, 0.75, 0.6);
    this.fMid = flame(0.22, 0.75, 0xff8800, 0.85, 0.5);
    this.fInner = flame(0.12, 0.5, 0xffcc55, 0.95, 0.38);

    this.glowMat = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.set(3.2, 3.2, 1);
    this.glow.position.y = 0.7;
    g.add(this.glow);

    // faint volumetric uplift above the flames
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 3.2, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff8033, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    cone.position.y = 2.2;
    g.add(cone);

    // the fire light — flickers and casts moving shadows
    this.light = new THREE.PointLight(0xff8033, 30, 26, 2);
    this.light.position.set(0, 0.9, 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.camera.near = 0.15;
    this.light.shadow.camera.far = 20;
    this.light.shadow.bias = -0.005;
    g.add(this.light);

    // sparks + embers (CPU loop)
    this.sparks = this.makePoints(g, 36, 0xffaa44, 0.05, 2.2);
    this.embers = this.makePoints(g, 16, 0xff3300, 0.04, 3.4);

    // smoke wisps
    const smokeTex = smokeTexture();
    this.smokes = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.SpriteMaterial({
        map: smokeTex, color: 0x888890, transparent: true,
        opacity: 0.1, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.userData.p = i / 6;
      g.add(s);
      this.smokes.push(s);
    }

    // sittable log seats (world coords = group + local)
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1 });
    const seatGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.7, 10);
    const logEast = new THREE.Mesh(seatGeo, barkMat);
    logEast.rotation.x = Math.PI / 2;
    logEast.position.set(1.8, 0.22, 0);
    logEast.castShadow = true;
    const logNorth = new THREE.Mesh(seatGeo, barkMat);
    logNorth.rotation.z = Math.PI / 2;
    logNorth.position.set(0, 0.22, 1.8);
    logNorth.castShadow = true;
    g.add(logEast, logNorth);

    this.t = rnd(0, 100);
  }

  makePoints(g, n, color, size, height) {
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    const life = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      seed[i * 2] = rnd(0, 20);
      seed[i * 2 + 1] = rnd(0.7, 1.4);
      life[i] = Math.random();
      pos[i * 3] = rnd(-0.2, 0.2);
      pos[i * 3 + 1] = life[i] * height;
      pos[i * 3 + 2] = rnd(-0.2, 0.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pts.frustumCulled = false;
    g.add(pts);
    return { pts, seed, life, height };
  }

  updatePoints(p, dt, t) {
    const attr = p.pts.geometry.getAttribute('position');
    const a = attr.array;
    for (let i = 0; i < p.life.length; i++) {
      p.life[i] -= dt * 0.55 * p.seed[i * 2 + 1];
      if (p.life[i] <= 0) {
        p.life[i] = 1;
        a[i * 3] = rnd(-0.2, 0.2);
        a[i * 3 + 2] = rnd(-0.2, 0.2);
      }
      const k = 1 - p.life[i];
      a[i * 3 + 1] = 0.4 + k * p.height;
      a[i * 3] += Math.sin(t * 3 + p.seed[i * 2]) * 0.35 * dt;
    }
    attr.needsUpdate = true;
  }

  update(dt, t) {
    this.t += dt;
    const n = Math.sin(t * 9.3) * 0.5 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 4.1) * 0.2;
    this.light.intensity = 30 + n * 7;
    this.light.position.x = Math.sin(t * 7.7) * 0.05;
    this.light.position.z = Math.cos(t * 6.3) * 0.05;

    this.fOuter.scale.set(1 + n * 0.08, 1 + n * 0.15, 1 + n * 0.08);
    this.fMid.scale.set(1 - n * 0.06, 1 + n * 0.18, 1 - n * 0.06);
    this.fInner.scale.y = 1 + n * 0.22;
    this.fOuter.rotation.y += dt * 1.2;
    this.fMid.rotation.y -= dt * 1.7;

    this.glowMat.opacity = 0.62 + n * 0.1;
    const gs = 3.1 + n * 0.35;
    this.glow.scale.set(gs, gs, 1);

    this.updatePoints(this.sparks, dt, t);
    this.updatePoints(this.embers, dt, t * 0.7);

    for (const s of this.smokes) {
      s.userData.p += dt * 0.16;
      if (s.userData.p > 1) s.userData.p -= 1;
      const p = s.userData.p;
      s.position.set(0.3 + p * 1.4, 1.3 + p * 3.6, p * 0.5);
      const sc = 1 + p * 2.6;
      s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(p * Math.PI) * 0.13;
    }
  }

  distTo(pos) {
    return Math.hypot(pos.x - FIRE_POS.x, pos.z - FIRE_POS.z);
  }
}
