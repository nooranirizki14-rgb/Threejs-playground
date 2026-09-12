import * as THREE from 'three';

// Storm weather: wind-slanted rain, hail, lightning bolts from believable
// positions, outbreak + visibility-drop events.
const RAIN_COUNT = 1300;
const RAIN_BOX = 55;
const HAIL_COUNT = 350;

export class Weather {
  rainIntensity = 0.7;
  hailLevel = 0;
  flashLight: THREE.DirectionalLight;
  private rainGeo = new THREE.BufferGeometry();
  private rainPos: Float32Array;
  private vel: Float32Array;
  private hailGeo = new THREE.BufferGeometry();
  private hailPos: Float32Array;
  private bolt: THREE.Line | null = null;
  private boltTimer = 0;
  private strikeTimer = 5;
  private outbreakT = 0;
  private visT = 0;
  onThunder: ((delay: number, gain: number) => void) | null = null;
  onFlash: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.rainPos = new Float32Array(RAIN_COUNT * 6);
    this.vel = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainPos.set([
        (Math.random() - 0.5) * RAIN_BOX, Math.random() * 35, (Math.random() - 0.5) * RAIN_BOX,
        0, 0.7, 0,
      ], i * 6);
      this.vel[i] = 22 + Math.random() * 8;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    const rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({
      color: 0x9fb4c8, transparent: true, opacity: 0.45,
    }));
    rain.frustumCulled = false;
    scene.add(rain);
    this.hailPos = new Float32Array(HAIL_COUNT * 3);
    for (let i = 0; i < HAIL_COUNT; i++) {
      this.hailPos.set([(Math.random() - 0.5) * RAIN_BOX, Math.random() * 35, (Math.random() - 0.5) * RAIN_BOX], i * 3);
    }
    this.hailGeo.setAttribute('position', new THREE.BufferAttribute(this.hailPos, 3));
    const hail = new THREE.Points(this.hailGeo, new THREE.PointsMaterial({
      color: 0xe8f2ff, size: 0.14, transparent: true, opacity: 0.9,
    }));
    hail.frustumCulled = false;
    hail.visible = false;
    scene.add(hail);
    this.hailPts = hail;
    this.flashLight = new THREE.DirectionalLight(0xcfe0ff, 0);
    this.flashLight.position.set(30, 60, -20);
    scene.add(this.flashLight);
  }

  private hailPts!: THREE.Points;

  startOutbreak(sec: number) {
    this.outbreakT = sec;
  }

  setVisDrop(sec: number) {
    this.visT = sec;
  }

  visDropping(): boolean {
    return this.visT > 0;
  }

  setHail(v: number) {
    this.hailLevel = Math.max(0, Math.min(1, v));
    this.hailPts.visible = this.hailLevel > 0.02;
  }

  private strike(scene: THREE.Scene, cx: number, cz: number) {
    if (this.bolt) {
      scene.remove(this.bolt);
      this.bolt.geometry.dispose();
    }
    const pts: THREE.Vector3[] = [];
    let bx = cx, bz = cz;
    for (let y = 90; y > 0; y -= 7 + Math.random() * 6) {
      pts.push(new THREE.Vector3(bx, y, bz));
      bx += (Math.random() - 0.5) * 14;
      bz += (Math.random() - 0.5) * 14;
    }
    pts.push(new THREE.Vector3(bx, 0, bz));
    this.bolt = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 1, fog: false })
    );
    this.bolt.frustumCulled = false;
    scene.add(this.bolt);
    this.boltTimer = 0.14;
  }

  update(
    dt: number, scene: THREE.Scene, camPos: THREE.Vector3,
    windX: number, windZ: number, intensity: number,
    torX: number, torZ: number, rainBoost = 0
  ) {
    this.rainIntensity = Math.min(1.2, 0.45 + intensity * 0.55 + rainBoost);
    this.outbreakT = Math.max(0, this.outbreakT - dt);
    this.visT = Math.max(0, this.visT - dt);
    const p = this.rainPos;
    const slant = 0.028;
    const n = Math.min(RAIN_COUNT, Math.floor(RAIN_COUNT * this.rainIntensity));
    for (let i = 0; i < RAIN_COUNT; i++) {
      const o = i * 6;
      if (i >= n) {
        p[o + 1] = -100; p[o + 4] = -100;
        continue;
      }
      let y = p[o + 1] - this.vel[i] * dt;
      let x = p[o] + windX * slant * this.vel[i] * dt;
      let z = p[o + 2] + windZ * slant * this.vel[i] * dt;
      if (y < 0) y += 35;
      const hx = RAIN_BOX / 2;
      if (x - camPos.x > hx) x -= RAIN_BOX; else if (x - camPos.x < -hx) x += RAIN_BOX;
      if (z - camPos.z > hx) z -= RAIN_BOX; else if (z - camPos.z < -hx) z += RAIN_BOX;
      p[o] = x; p[o + 1] = y; p[o + 2] = z;
      p[o + 3] = x - windX * 0.02;
      p[o + 4] = y + 0.7;
      p[o + 5] = z - windZ * 0.02;
    }
    this.rainGeo.attributes.position.needsUpdate = true;

    // hail: fast white pellets
    if (this.hailLevel > 0.02) {
      const hp = this.hailPos;
      const hn = Math.floor(HAIL_COUNT * this.hailLevel);
      for (let i = 0; i < HAIL_COUNT; i++) {
        const o = i * 3;
        if (i >= hn) { hp[o + 1] = -100; continue; }
        let y = hp[o + 1] - 34 * dt;
        let x = hp[o] + windX * 0.4 * dt;
        let z = hp[o + 2] + windZ * 0.4 * dt;
        if (y < 0) y += 35;
        const hx = RAIN_BOX / 2;
        if (x - camPos.x > hx) x -= RAIN_BOX; else if (x - camPos.x < -hx) x += RAIN_BOX;
        if (z - camPos.z > hx) z -= RAIN_BOX; else if (z - camPos.z < -hx) z += RAIN_BOX;
        hp[o] = x; hp[o + 1] = y; hp[o + 2] = z;
      }
      this.hailGeo.attributes.position.needsUpdate = true;
    }

    // lightning scheduling
    this.strikeTimer -= dt;
    if (this.strikeTimer <= 0) {
      this.strikeTimer = this.outbreakT > 0
        ? 0.4 + Math.random() * 1.2
        : 3 + Math.random() * (14 - intensity * 10);
      const nearTor = Math.random() < 0.6;
      const sx = nearTor ? torX + (Math.random() - 0.5) * 120 : camPos.x + (Math.random() - 0.5) * 300;
      const sz = nearTor ? torZ + (Math.random() - 0.5) * 120 : camPos.z + (Math.random() - 0.5) * 300;
      this.strike(scene, sx, sz);
      this.flashLight.position.set(sx, 60, sz);
      this.flashLight.intensity = 4 + Math.random() * 4;
      if (this.onFlash) this.onFlash();
      const dist = Math.hypot(sx - camPos.x, sz - camPos.z);
      if (this.onThunder) this.onThunder(dist / 343, Math.max(0.15, 1 - dist / 400));
    }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 22);
    if (this.bolt) {
      this.boltTimer -= dt;
      (this.bolt.material as THREE.LineBasicMaterial).opacity = Math.max(0, this.boltTimer / 0.14);
      if (this.boltTimer <= 0) {
        scene.remove(this.bolt);
        this.bolt.geometry.dispose();
        this.bolt = null;
      }
    }
  }
}
