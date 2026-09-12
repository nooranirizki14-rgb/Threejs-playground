import * as THREE from 'three';

// Procedural tornado: type presets (rope/wedge/multi-vortex/...), full
// lifecycle (form -> mature -> dissipate), wandering path AI biased at
// the player, layered rotational/inflow wind field.
export interface TorTypeDef {
  id: string; name: string; width: number; height: number;
  peak: number; wander: number; speed: number; tint: number;
  subs: number; rainWrap: boolean; night: boolean;
}

export const TOR_TYPES: Record<string, TorTypeDef> = {
  rope: { id: 'rope', name: 'Rope', width: 0.42, height: 0.8, peak: 0.45, wander: 1.6, speed: 9, tint: 0x8a929c, subs: 0, rainWrap: false, night: false },
  classic: { id: 'classic', name: 'Classic', width: 1.0, height: 1.0, peak: 0.75, wander: 0.8, speed: 6, tint: 0x565e66, subs: 0, rainWrap: false, night: false },
  wedge: { id: 'wedge', name: 'Wedge', width: 2.3, height: 0.85, peak: 1.0, wander: 0.35, speed: 4, tint: 0x3a3f45, subs: 0, rainWrap: false, night: false },
  multi: { id: 'multi', name: 'Multi-vortex', width: 1.25, height: 1.0, peak: 0.9, wander: 0.7, speed: 5.5, tint: 0x6a5a52, subs: 2, rainWrap: false, night: false },
  rainwrap: { id: 'rainwrap', name: 'Rain-wrapped', width: 1.1, height: 1.0, peak: 0.8, wander: 0.9, speed: 6.5, tint: 0x4a5258, subs: 0, rainWrap: true, night: false },
  night: { id: 'night', name: 'Night', width: 1.0, height: 1.0, peak: 0.85, wander: 0.8, speed: 6, tint: 0x2c3138, subs: 0, rainWrap: false, night: true },
};

function funnelTexture(base: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * 256;
    const w = 2 + Math.random() * 8;
    x.fillStyle = Math.random() < 0.5
      ? `rgba(12,14,17,${0.1 + Math.random() * 0.25})`
      : `rgba(200,210,220,${0.05 + Math.random() * 0.14})`;
    x.fillRect(px, 0, w, 256);
  }
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(10,12,14,${0.08 + Math.random() * 0.12})`;
    x.fillRect(0, Math.random() * 256, 256, 3 + Math.random() * 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
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
  pos = new THREE.Vector3(60, 0, -230);
  heading = 0;
  speed = 6;
  intensity = 0.25;
  radius = 24;
  ef = 1;
  maxWind = 50;
  dissipated = false;
  closest = Infinity;
  def: TorTypeDef = TOR_TYPES.classic;
  private outer!: THREE.Mesh;
  private inner!: THREE.Mesh;
  private outerTex!: THREE.CanvasTexture;
  private innerTex!: THREE.CanvasTexture;
  private subs: THREE.Mesh[] = [];
  private puffs: THREE.Sprite[] = [];
  private puffDat: { a: number; r: number; s: number }[] = [];
  private life = 0;
  private lifetime = 200;
  private flash = 0;
  private boost = 0;

  constructor(scene: THREE.Scene) {
    const H = 130;
    this.outerTex = funnelTexture('#565e66');
    this.outerTex.repeat.set(3, 2);
    this.outer = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 5, H, 26, 10, true),
      new THREE.MeshStandardMaterial({
        map: this.outerTex, transparent: true, opacity: 0.92,
        side: THREE.DoubleSide, depthWrite: false, roughness: 1,
      })
    );
    this.outer.position.y = H / 2;
    this.innerTex = funnelTexture('#22262b');
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
    // subvortices (multi-vortex type)
    for (let i = 0; i < 2; i++) {
      const sub = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 1.2, 70, 12, 6, true),
        new THREE.MeshStandardMaterial({
          map: this.innerTex, transparent: true, opacity: 0.9,
          side: THREE.DoubleSide, depthWrite: false, roughness: 1,
        })
      );
      sub.position.y = 35;
      sub.visible = false;
      this.group.add(sub);
      this.subs.push(sub);
    }
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
    this.setType('classic');
  }

  setType(id: string) {
    this.def = TOR_TYPES[id] || TOR_TYPES.classic;
    this.life = 0;
    this.dissipated = false;
    this.closest = Infinity;
    this.boost = 0;
    this.intensity = 0.22;
    this.lifetime = 170 + Math.random() * 70;
    // spawn upwind, biased so it tracks toward the player start
    const a = Math.random() * Math.PI * 2;
    this.pos.set(Math.sin(a) * 240, 0, -60 + Math.cos(a) * 240);
    this.heading = Math.atan2(-this.pos.x, -this.pos.z - 30);
    this.speed = this.def.speed;
    (this.outer.material as THREE.MeshStandardMaterial).color.setHex(this.def.tint);
    for (let i = 0; i < this.subs.length; i++) {
      this.subs[i].visible = i < this.def.subs;
    }
  }

  get efLabel(): string {
    return `EF${this.ef}`;
  }

  addBoost(v: number) {
    this.boost = Math.max(-0.4, Math.min(0.45, this.boost + v));
  }

  turn(d: number) {
    this.heading += d;
  }

  /** rotational + inflow wind field. Returns wind speed m/s. */
  windAt(x: number, z: number, out: THREE.Vector3, h = 0): number {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const r = Math.max(0.5, Math.hypot(dx, dz));
    const R = this.radius;
    const amb = 9 + this.intensity * 8;
    let wx = amb * 0.7;
    let wz = amb * 0.7;
    if (!this.dissipated && r < R * 4.5) {
      const prof = Math.exp(-Math.pow((r - R) / (R * 1.1), 2));
      const core = Math.exp(-Math.pow(r / (R * 0.55), 2));
      const tang = this.maxWind * prof * (1 - core * 0.75) * (1 + h * 0.004);
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
    // lifecycle: form -> peak -> rope out & dissipate
    const f = this.life / this.lifetime;
    let target: number;
    if (f < 0.25) target = 0.22 + (this.def.peak - 0.22) * (f / 0.25);
    else if (f < 0.7) target = this.def.peak + Math.sin(t * 0.05) * 0.06;
    else if (f < 1) target = this.def.peak * (1 - (f - 0.7) / 0.3) + 0.08;
    else target = 0;
    this.boost *= Math.max(0, 1 - dt * 0.05);
    this.intensity += (Math.min(1, Math.max(0, target + this.boost)) - this.intensity) * Math.min(1, dt * 0.5);
    if (f >= 1 && this.intensity < 0.05) this.dissipated = true;
    this.ef = Math.min(5, Math.floor(this.intensity * 5.999));
    const ropeOut = f > 0.7 ? 1 - (f - 0.7) / 0.3 * 0.7 : 1; // narrows as it ropes out
    this.radius = (14 + this.intensity * 40) * this.def.width * Math.max(0.15, ropeOut);
    this.maxWind = 34 + this.intensity * 78;
    this.speed = this.def.speed * (0.7 + this.intensity * 0.5);

    // path AI: biased at the player + wander + occasional veer
    const dx = playerX - this.pos.x;
    const dz = playerZ - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < this.closest) this.closest = dist;
    const want = Math.atan2(dx, dz);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const pull = dist > 200 ? 0.55 : dist > 90 ? 0.3 : 0.12;
    this.heading += (d * pull + Math.sin(t * 0.11) * 0.4 * this.def.wander + Math.sin(t * 0.031 + 2) * 0.3) * dt;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    if (Math.hypot(this.pos.x, this.pos.z) > 290) {
      this.heading = Math.atan2(-this.pos.x, -this.pos.z);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);

    // funnel visuals
    const vis = this.dissipated ? 0 : 1;
    this.group.visible = vis === 1;
    if (!vis) return;
    const wob = 1 + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 2.3 + 1) * 0.03;
    const wScale = (this.radius / 30) * wob;
    this.outer.scale.set(wScale, this.def.height, wScale);
    this.inner.scale.set(wScale * (0.9 + Math.sin(t * 1.7) * 0.08), this.def.height, wScale);
    this.group.rotation.z = Math.sin(t * 0.23) * 0.03;
    this.group.rotation.x = Math.cos(t * 0.19) * 0.025;
    const spin = (2 + this.intensity * 9) * dt;
    this.outerTex.offset.x += spin * 0.14;
    this.outerTex.offset.y -= spin * 0.05;
    this.innerTex.offset.x -= spin * 0.3;
    this.innerTex.offset.y -= spin * 0.12;
    this.flash = Math.max(0, this.flash - dt * 6);
    const fl = this.flash * 0.8;
    (this.outer.material as THREE.MeshStandardMaterial).emissive.setRGB(fl, fl, fl * 1.1);
    (this.inner.material as THREE.MeshStandardMaterial).emissive.setRGB(fl * 0.7, fl * 0.7, fl * 0.8);
    // subvortices orbit the core
    for (let i = 0; i < this.subs.length; i++) {
      if (!this.subs[i].visible) continue;
      const a = t * (1.2 + this.intensity * 2) + (i / this.def.subs) * Math.PI * 2;
      const rr = this.radius * 0.55;
      this.subs[i].position.set(Math.cos(a) * rr, 35 * this.def.height, Math.sin(a) * rr);
    }
    for (let i = 0; i < this.puffs.length; i++) {
      const P = this.puffDat[i];
      P.a += dt * (1.5 + this.intensity * 5) * P.s * (14 / Math.max(8, P.r));
      const rr = P.r * (this.radius / 30);
      this.puffs[i].position.set(Math.cos(P.a) * rr, 2 + (i % 5), Math.sin(P.a) * rr);
    }
  }
}
