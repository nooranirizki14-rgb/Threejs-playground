import * as THREE from 'three';

// Tornado: layered rotating funnel, dust skirt, wandering path AI with a
// loose attraction to the player, and a radial/rotational wind field.
// intensity 0..1 -> EF0..EF5, radius, wind speed, debris density.
function funnelTexture(dark: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = dark ? '#2b3138' : '#565e66';
  x.fillRect(0, 0, 256, 256);
  // vertical turbulent streaks
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * 256;
    const w = 2 + Math.random() * 8;
    const shade = Math.random();
    x.fillStyle = shade < 0.5
      ? `rgba(12,14,17,${0.1 + Math.random() * 0.25})`
      : `rgba(200,210,220,${0.05 + Math.random() * 0.14})`;
    x.fillRect(px, 0, w, 256);
  }
  // horizontal churn bands
  for (let i = 0; i < 26; i++) {
    const py = Math.random() * 256;
    x.fillStyle = `rgba(10,12,14,${0.08 + Math.random() * 0.12})`;
    x.fillRect(0, py, 256, 3 + Math.random() * 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(150,140,120,0.55)');
  g.addColorStop(1, 'rgba(150,140,120,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Tornado {
  group = new THREE.Group();
  pos = new THREE.Vector3(180, 0, -140);
  heading = Math.PI * 0.75;
  speed = 6;
  intensity = 0.3;
  radius = 30;
  ef = 1;
  maxWind = 40;
  private outer!: THREE.Mesh;
  private inner!: THREE.Mesh;
  private outerTex!: THREE.CanvasTexture;
  private innerTex!: THREE.CanvasTexture;
  private puffs: THREE.Sprite[] = [];
  private puffDat: { a: number; r: number; s: number }[] = [];
  private life = 0;
  private flash = 0;

  constructor(scene: THREE.Scene) {
    const H = 130;
    this.outerTex = funnelTexture(false);
    this.outerTex.repeat.set(3, 2);
    this.outer = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 5, H, 26, 10, true),
      new THREE.MeshStandardMaterial({
        map: this.outerTex, transparent: true, opacity: 0.92,
        side: THREE.DoubleSide, depthWrite: false, roughness: 1,
      })
    );
    this.outer.position.y = H / 2;
    this.innerTex = funnelTexture(true);
    this.innerTex.repeat.set(2, 3);
    this.inner = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 3, H, 20, 8, true),
      new THREE.MeshStandardMaterial({
        map: this.innerTex, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false, roughness: 1,
      })
    );
    this.inner.position.y = H / 2;
    this.group.add(this.outer, this.inner);
    // dust skirt sprites orbiting the base
    const pt = puffTexture();
    for (let i = 0; i < 46; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: pt, transparent: true, opacity: 0.75, depthWrite: false,
      }));
      const s = 8 + Math.random() * 14;
      sp.scale.set(s, s * 0.6, 1);
      this.group.add(sp);
      this.puffs.push(sp);
      this.puffDat.push({ a: Math.random() * 6.28, r: 6 + Math.random() * 26, s: 0.6 + Math.random() });
    }
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  get efLabel(): string {
    return `EF${this.ef}`;
  }

  /** rotational + inflow wind field. Returns wind speed m/s. */
  windAt(x: number, z: number, out: THREE.Vector3): number {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const r = Math.max(0.5, Math.hypot(dx, dz));
    const R = this.radius;
    // ambient storm wind (gusty, mostly from the south-west)
    const amb = 9 + this.intensity * 8;
    let wx = amb * 0.7;
    let wz = amb * 0.7;
    if (r < R * 4.5) {
      // tangential (counter-clockwise) + inward suction, peaking at core edge
      const prof = Math.exp(-Math.pow((r - R) / (R * 1.1), 2));
      const core = Math.exp(-Math.pow(r / (R * 0.55), 2)); // weak eye
      const tang = this.maxWind * prof * (1 - core * 0.75);
      const inflow = this.maxWind * 0.35 * prof;
      const nx = dx / r, nz = dz / r;
      wx += -nz * tang - nx * inflow;
      wz += nx * tang - nz * inflow;
    }
    out.set(wx, 0, wz);
    return Math.hypot(wx, wz);
  }

  lightningFlash() {
    this.flash = 1;
  }

  update(dt: number, t: number, playerX: number, playerZ: number) {
    this.life += dt;
    // intensity lifecycle: build -> violent -> weaken -> rebuild (endless storm)
    const cyc = (Math.sin(this.life * 0.008) * 0.5 + 0.5) * 0.55
      + (Math.sin(this.life * 0.021 + 1.7) * 0.5 + 0.5) * 0.25
      + 0.2;
    this.intensity += (Math.min(1, Math.max(0.18, cyc)) - this.intensity) * Math.min(1, dt * 0.2);
    this.ef = Math.min(5, Math.floor(this.intensity * 5.999));
    this.radius = 16 + this.intensity * 42;
    this.maxWind = 34 + this.intensity * 78; // 34..112 m/s
    this.speed = 4.5 + this.intensity * 5;

    // path AI: wander + loose attraction to the player (keeps tension)
    const dx = playerX - this.pos.x;
    const dz = playerZ - this.pos.z;
    const want = Math.atan2(dx, dz);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const dist = Math.hypot(dx, dz);
    const pull = dist > 320 ? 0.5 : dist > 120 ? 0.22 : -0.12; // veer off at close range sometimes
    this.heading += (d * pull + Math.sin(t * 0.11) * 0.35 + Math.sin(t * 0.031 + 2) * 0.3) * dt;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // keep it in the world
    const pr = Math.hypot(this.pos.x, this.pos.z);
    if (pr > 260) {
      this.heading = Math.atan2(-this.pos.x, -this.pos.z);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);

    // funnel motion: uneven breathing width, tilt, fast inner spin
    const wob = 1 + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 2.3 + 1) * 0.03;
    const wScale = (this.radius / 30) * wob;
    this.outer.scale.set(wScale, 1, wScale);
    this.inner.scale.set(wScale * (0.9 + Math.sin(t * 1.7) * 0.08), 1, wScale);
    this.group.rotation.z = Math.sin(t * 0.23) * 0.03;
    this.group.rotation.x = Math.cos(t * 0.19) * 0.025;
    const spin = (2 + this.intensity * 9) * dt;
    this.outerTex.offset.x += spin * 0.14;
    this.outerTex.offset.y -= spin * 0.05;
    this.innerTex.offset.x -= spin * 0.3;
    this.innerTex.offset.y -= spin * 0.12;
    // lightning flash decay
    this.flash = Math.max(0, this.flash - dt * 6);
    const fl = this.flash * 0.8;
    (this.outer.material as THREE.MeshStandardMaterial).emissive.setRGB(fl, fl, fl * 1.1);
    (this.inner.material as THREE.MeshStandardMaterial).emissive.setRGB(fl * 0.7, fl * 0.7, fl * 0.8);
    // dust skirt orbit
    for (let i = 0; i < this.puffs.length; i++) {
      const P = this.puffDat[i];
      P.a += dt * (1.5 + this.intensity * 5) * P.s * (14 / Math.max(8, P.r));
      const rr = P.r * (this.radius / 30);
      this.puffs[i].position.set(Math.cos(P.a) * rr, 2 + (i % 5), Math.sin(P.a) * rr);
    }
  }
}
