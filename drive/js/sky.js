import * as THREE from 'three';
import { makeGlowSprite } from './textures.js';
import { rnd } from './utils.js';

// Infinite night sky: stars, moon, drifting clouds, horizon city glow, mountains.
export class Sky {
  constructor(scene) {
    this.scene = scene;
    const glowTex = makeGlowSprite({});

    // stars (follow camera => infinitely far)
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 320 + Math.random() * 160;
      const th = Math.random() * Math.PI * 2;
      const ph = 0.06 + Math.random() * 1.4;
      pos[i * 3] = r * Math.cos(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph);
      pos[i * 3 + 2] = r * Math.cos(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xcfd8ff, size: 1.5, sizeAttenuation: false,
      transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // moon + halo
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xe8eeff, transparent: true, opacity: 0.95,
      fog: false, depthWrite: false,
    }));
    this.moon.scale.set(26, 26, 1);
    scene.add(this.moon);
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x8fa0ff, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    }));
    this.moonHalo.scale.set(90, 90, 1);
    scene.add(this.moonHalo);

    // dark clouds drifting
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x0a0f24, transparent: true, opacity: 0.85,
        fog: false, depthWrite: false,
      }));
      const w = rnd(120, 260);
      s.scale.set(w, w * rnd(0.25, 0.4), 1);
      s.position.set(rnd(-300, 300), rnd(90, 170), rnd(-350, 100));
      s.userData.vx = rnd(0.5, 1.6);
      scene.add(s);
      this.clouds.push(s);
    }

    // horizon city glow
    this.glows = [];
    const glowCols = [0xff9a3d, 0xff5d8f, 0x4dc9ff, 0xff9a3d, 0xb537ff];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: glowCols[i], transparent: true, opacity: 0.32,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
      }));
      s.scale.set(rnd(150, 260), rnd(35, 60), 1);
      s.userData.x = -320 + i * 160 + rnd(-40, 40);
      s.userData.ahead = i !== 4;
      scene.add(s);
      this.glows.push(s);
    }

    // mountain silhouettes
    this.mountains = [];
    const mMat = new THREE.MeshBasicMaterial({ color: 0x05060f });
    for (let i = 0; i < 10; i++) {
      const r = rnd(60, 130);
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, rnd(60, 120), 5), mMat);
      m.userData.side = i % 2 === 0 ? -1 : 1;
      m.userData.off = i * 70;
      m.userData.x = m.userData.side * rnd(150, 280);
      scene.add(m);
      this.mountains.push(m);
    }
  }

  update(dt, cam) {
    this.stars.position.set(cam.position.x, 0, cam.position.z);
    this.moon.position.set(cam.position.x + 70, 110, cam.position.z - 260);
    this.moonHalo.position.copy(this.moon.position);
    for (const c of this.clouds) {
      c.position.x += c.userData.vx * dt;
      if (c.position.x - cam.position.x > 320) c.position.x -= 640;
      c.position.z = cam.position.z + ((c.position.z - cam.position.z + 450) % 450) - 350;
    }
    for (const g of this.glows) {
      g.position.set(
        cam.position.x * 0.3 + g.userData.x,
        10,
        cam.position.z + (g.userData.ahead ? -400 : 350)
      );
    }
    for (const m of this.mountains) {
      m.position.set(m.userData.x, 0, cam.position.z - 330 + m.userData.off);
    }
  }

  setFlash(f) {
    this.stars.material.opacity = 0.85 - f * 0.5;
    this.moon.material.opacity = 0.95 + f * 0.05;
  }
}
