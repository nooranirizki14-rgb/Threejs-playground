import * as THREE from 'three';

// Research vehicles: 3 selectable variants (paint + stats), full interior,
// live instruments, wipers, rain/crack windshield layers, pet + crew props.
export type CarVariant = 'interceptor' | 'tiv' | 'scout';

export interface CarStats {
  hull: number; mass: number; grip: number; sensors: number; power: number;
}

export const CAR_STATS: Record<CarVariant, CarStats> = {
  interceptor: { hull: 100, mass: 1.0, grip: 1.0, sensors: 1.0, power: 1.0 },
  tiv: { hull: 150, mass: 1.7, grip: 1.25, sensors: 0.8, power: 1.1 },
  scout: { hull: 75, mass: 0.75, grip: 0.9, sensors: 1.4, power: 0.9 },
};

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export class ResearchCar {
  group = new THREE.Group();
  wheels: THREE.Mesh[] = [];
  private frontL = new THREE.Group();
  private frontR = new THREE.Group();
  private spinner = new THREE.Group();
  private wiperL = new THREE.Group();
  private wiperR = new THREE.Group();
  wipersOn = true;
  private wiperPhase = 0;
  private lastSwish = false;
  onWiperPass: (() => void) | null = null;
  private beams: THREE.Object3D[] = [];
  private beaconMatA!: THREE.MeshStandardMaterial;
  private beaconMatB!: THREE.MeshStandardMaterial;
  private beaconLight!: THREE.PointLight;
    private anem!: THREE.Group;
  private dropMat!: THREE.MeshBasicMaterial;
  private dropCtx!: CanvasRenderingContext2D;
  private dropTex!: THREE.CanvasTexture;
  private dropTimer = 0;
  private crackCtx!: CanvasRenderingContext2D;
  private crackTex!: THREE.CanvasTexture;
  private crackDrawn = 0;
  private dialCtx!: CanvasRenderingContext2D;
  private dialTex!: THREE.CanvasTexture;
  private dialTimer = 0;
  private screenCtx!: CanvasRenderingContext2D;
  private screenTex!: THREE.CanvasTexture;
  private dialKmh = -1;

  constructor(scene: THREE.Scene, variant: CarVariant = 'interceptor') {
    const paint = variant === 'tiv' ? 0x3a4436 : variant === 'scout' ? 0x2a4a7a : 0xd8dce0;
    const trim = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.85 });
    const seat = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 1 });
    const dash = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8aa5bb, transparent: true, opacity: 0.1,
      roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const armor = new THREE.MeshStandardMaterial({ color: paint, metalness: 0.35, roughness: 0.5 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.7, roughness: 0.45 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xd86a1e, roughness: 0.6 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 });
    const mirror = new THREE.MeshStandardMaterial({ color: 0x0a0d14, metalness: 0.9, roughness: 0.25 });
    const tail = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 2 });
    const g = this.group;

    // shell
    box(2.0, 0.12, 2.6, trim, 0, 0.4, 0.05, g);
    box(2.0, 0.1, 2.5, armor, 0, 1.5, 0.05, g);
    box(1.9, 0.08, 0.1, armor, 0, 1.44, -1.16, g);
    box(0.1, 0.55, 2.4, armor, -1.0, 0.68, 0.05, g);
    box(0.1, 0.55, 2.4, armor, 1.0, 0.68, 0.05, g);
    box(0.02, 0.16, 2.4, stripe, -1.06, 0.72, 0.05, g);
    box(0.02, 0.16, 2.4, stripe, 1.06, 0.72, 0.05, g);
    box(0.06, 0.3, 2.2, darkMetal, -1.09, 0.55, 0.05, g);
    box(0.06, 0.3, 2.2, darkMetal, 1.09, 0.55, 0.05, g);
    // TIV gets extra plate armor
    if (variant === 'tiv') {
      box(0.05, 0.5, 2.0, darkMetal, -1.13, 0.68, 0.05, g);
      box(0.05, 0.5, 2.0, darkMetal, 1.13, 0.68, 0.05, g);
      box(2.1, 0.08, 2.6, darkMetal, 0, 1.58, 0.05, g);
    }
    for (const sx of [-0.98, 0.98]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.5), glass);
      win.rotation.y = Math.PI / 2;
      win.position.set(sx, 1.2, 0.05);
      g.add(win);
      box(0.07, 0.55, 0.09, armor, sx, 1.2, 0.3, g);
    }
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.68), glass);
    ws.rotation.x = -0.675;
    ws.position.set(0, 1.2, -0.95);
    g.add(ws);
    for (const sx of [-0.95, 0.95]) {
      const p = box(0.08, 0.72, 0.08, armor, sx, 1.2, -0.95, g);
      p.rotation.x = -0.675;
    }
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), glass);
    rg.position.set(0, 1.2, 1.28);
    g.add(rg);
    box(1.9, 0.55, 0.1, armor, 0, 0.68, 1.28, g);
    box(1.85, 0.14, 1.4, armor, 0, 0.75, -1.45, g);
    box(1.95, 0.32, 0.28, darkMetal, 0, 0.46, -2.2, g);
    box(1.85, 0.16, 0.9, armor, 0, 0.79, 1.7, g);
    box(1.95, 0.32, 0.28, darkMetal, 0, 0.46, 2.2, g);
    box(0.3, 0.1, 0.06, tail, -0.65, 0.72, 2.18, g);
    box(0.3, 0.1, 0.06, tail, 0.65, 0.72, 2.18, g);
    // bullbar
    const barG = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8);
    for (const bx of [-0.5, 0.5]) {
      const v = new THREE.Mesh(barG, darkMetal);
      v.position.set(bx, 0.75, -2.36);
      g.add(v);
    }
    const barH = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8);
    barH.rotateZ(Math.PI / 2);
    for (const by of [0.55, 1.0]) {
      const h = new THREE.Mesh(barH, darkMetal);
      h.position.set(0, by, -2.36);
      g.add(h);
    }
    for (const [fx, fz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 1.85], [0.95, 1.85]]) {
      box(0.06, 0.25, 0.3, trim, fx, 0.35, fz, g);
    }
    // tires (TIV: bigger)
    const tireR = variant === 'tiv' ? 0.46 : 0.4;
    const wg = new THREE.CylinderGeometry(tireR, tireR, 0.28, 16);
    wg.rotateZ(Math.PI / 2);
    const mkWheel = (x: number, z: number, steer: THREE.Group | null) => {
      const w = new THREE.Mesh(wg, tire);
      w.castShadow = true;
      if (steer) {
        steer.position.set(x, tireR, z);
        steer.add(w);
        g.add(steer);
      } else {
        w.position.set(x, tireR, z);
        g.add(w);
      }
      this.wheels.push(w);
    };
    mkWheel(-0.9, -1.4, this.frontL);
    mkWheel(0.9, -1.4, this.frontR);
    mkWheel(-0.9, 1.4, null);
    mkWheel(0.9, 1.4, null);

    // roof rack + science gear
    for (const rz of [-0.7, 0.7]) box(1.7, 0.05, 0.12, darkMetal, 0, 1.62, rz, g);
    for (const rx of [-0.7, 0.7]) box(0.12, 0.05, 1.5, darkMetal, rx, 1.62, 0, g);
    box(0.7, 0.28, 0.5, trim, -0.35, 1.78, 0.35, g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), armor);
    dome.position.set(0.45, 1.72, 0.4);
    g.add(dome);
    for (const cx of [-0.5, 0.5]) {
      box(0.14, 0.1, 0.2, trim, cx, 1.7, -0.62, g);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8),
        new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2222, emissiveIntensity: 0.8 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(cx, 1.7, -0.73);
      g.add(lens);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), darkMetal);
    mast.position.set(0.3, 1.85, -0.4);
    g.add(mast);
    this.anem = new THREE.Group();
    this.anem.position.set(0.3, 2.1, -0.4);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), darkMetal);
      arm.rotation.z = Math.PI / 2;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 3) * Math.PI * 2;
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), armor);
      cup.position.x = 0.11;
      holder.add(arm, cup);
      this.anem.add(holder);
    }
    g.add(this.anem);
    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.9, 6), darkMetal);
    whip.position.set(-0.6, 1.95, 0.9);
    g.add(whip);
    this.beaconMatA = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2222, emissiveIntensity: 3 });
    this.beaconMatB = new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 0.4 });
    box(0.14, 0.08, 0.1, this.beaconMatA, -0.25, 1.6, -0.85, g);
    box(0.14, 0.08, 0.1, this.beaconMatB, 0.25, 1.6, -0.85, g);
    this.beaconLight = new THREE.PointLight(0xff3333, 6, 14, 1.8);
    this.beaconLight.position.set(0, 1.9, -0.85);
    g.add(this.beaconLight);

    // interior
    box(1.9, 0.18, 0.35, dash, 0, 0.92, -0.575, g);
    box(1.9, 0.1, 0.3, dash, 0, 1.02, -0.62, g);
    const dc = document.createElement('canvas');
    dc.width = 256; dc.height = 128;
    this.dialCtx = dc.getContext('2d') as CanvasRenderingContext2D;
    this.dialTex = new THREE.CanvasTexture(dc);
    this.dialTex.colorSpace = THREE.SRGBColorSpace;
    const dials = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: this.dialTex }));
    dials.position.set(-0.4, 0.99, -0.395);
    g.add(dials);
    this.drawDials(0);
    const sc = document.createElement('canvas');
    sc.width = 256; sc.height = 160;
    this.screenCtx = sc.getContext('2d') as CanvasRenderingContext2D;
    this.screenTex = new THREE.CanvasTexture(sc);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), new THREE.MeshBasicMaterial({ map: this.screenTex }));
    screen.position.set(0.28, 0.98, -0.395);
    screen.rotation.y = -0.12;
    g.add(screen);
    this.setScreen(['WIND ---', 'TOR ---', 'PRES ---', 'DATA 0']);
    const steerGroup = new THREE.Group();
    steerGroup.position.set(-0.4, 0.95, -0.35);
    steerGroup.rotation.x = -0.45;
    g.add(steerGroup);
    steerGroup.add(this.spinner);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 10, 28), trim);
    this.spinner.add(wheel);
    const spokeG = new THREE.BoxGeometry(0.34, 0.035, 0.02);
    const s1 = new THREE.Mesh(spokeG, trim);
    const s2 = new THREE.Mesh(spokeG, trim);
    s2.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), trim);
    hub.rotation.x = Math.PI / 2;
    this.spinner.add(s1, s2, hub);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), trim);
    col.rotation.x = Math.PI / 2 - 0.45;
    col.position.set(-0.4, 0.88, -0.48);
    g.add(col);
    box(0.3, 0.32, 0.7, trim, 0, 0.6, 0.1, g);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), trim);
    sh.position.set(0, 0.82, -0.05);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), darkMetal);
    knob.position.set(0, 0.91, -0.05);
    g.add(sh, knob);
    const ext = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0xa01818, roughness: 0.5 })
    );
    ext.position.set(0.22, 0.62, 0.45);
    g.add(ext);
    const pedalG = new THREE.BoxGeometry(0.09, 0.03, 0.14);
    for (const px of [-0.48, -0.32]) {
      const p = new THREE.Mesh(pedalG, darkMetal);
      p.position.set(px, 0.52, -0.55);
      p.rotation.x = -0.5;
      g.add(p);
    }
    const mkSeat = (x: number, z: number) => {
      box(0.55, 0.18, 0.5, seat, x, 0.55, z, g);
      const back = box(0.55, 0.62, 0.16, seat, x, 0.92, z + 0.3, g);
      back.rotation.x = 0.12;
      box(0.24, 0.14, 0.1, seat, x, 1.28, z + 0.35, g);
    };
    mkSeat(-0.4, 0.35);
    mkSeat(0.4, 0.35);
    box(1.5, 0.18, 0.5, seat, 0, 0.55, 0.95, g);
    box(0.03, 0.08, 0.03, trim, 0, 1.4, -1.0, g);
    box(0.3, 0.11, 0.03, trim, 0, 1.33, -1.0, g);
    const mf = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.09), mirror);
    mf.position.set(0, 1.33, -0.983);
    g.add(mf);
    for (const sx of [-1, 1]) {
      box(0.12, 0.03, 0.03, trim, sx * 1.05, 1.0, -0.7, g);
      box(0.06, 0.12, 0.16, armor, sx * 1.12, 1.02, -0.7, g);
    }
    const cabinGlow = new THREE.PointLight(0xffe0b0, 1.2, 3.5, 1.6);
    cabinGlow.position.set(0, 1.35, 0.3);
    g.add(cabinGlow);

    // windshield rain + crack layers
    const drc = document.createElement('canvas');
    drc.width = 256; drc.height = 160;
    this.dropCtx = drc.getContext('2d') as CanvasRenderingContext2D;
    this.dropTex = new THREE.CanvasTexture(drc);
    this.dropTex.colorSpace = THREE.SRGBColorSpace;
    this.drawDrops();
    this.dropMat = new THREE.MeshBasicMaterial({ map: this.dropTex, transparent: true, opacity: 0.6, depthWrite: false });
    const drops = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.68), this.dropMat);
    drops.rotation.x = -0.675;
    drops.position.set(0, 1.2, -0.945);
    g.add(drops);
    const crc = document.createElement('canvas');
    crc.width = 256; crc.height = 160;
    this.crackCtx = crc.getContext('2d') as CanvasRenderingContext2D;
    this.crackTex = new THREE.CanvasTexture(crc);
    this.crackTex.colorSpace = THREE.SRGBColorSpace;
    const cracks = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.68),
      new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, opacity: 0.9, depthWrite: false })
    );
    cracks.rotation.x = -0.675;
    cracks.position.set(0, 1.2, -0.94);
    g.add(cracks);
    // wipers
    const armG = new THREE.BoxGeometry(0.025, 0.5, 0.02);
    const bladeG = new THREE.BoxGeometry(0.03, 0.42, 0.015);
    const bladeM = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const mkWiper = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.98, -0.76);
      const arm = new THREE.Mesh(armG, trim);
      arm.position.y = 0.22;
      const blade = new THREE.Mesh(bladeG, bladeM);
      blade.position.set(0.06, 0.42, 0.005);
      blade.rotation.z = -0.25;
      pivot.add(arm, blade);
      pivot.rotation.x = -0.35;
      g.add(pivot);
      return pivot;
    };
    this.wiperL = mkWiper(-0.45);
    this.wiperR = mkWiper(0.35);

    // headlights
    const mkBeam = (x: number) => {
      const s = new THREE.SpotLight(0xcfe6ff, 50, 70, 0.46, 0.55, 1.4);
      s.position.set(x, 0.7, -2.2);
      s.target.position.set(x * 1.6, 0, -25);
      g.add(s, s.target);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 9, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xbdd8ff, transparent: true, opacity: 0.04,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        })
      );
      cone.rotation.x = -Math.PI / 2 - 0.06;
      cone.position.set(x * 1.4, 0.45, -6.5);
      g.add(cone);
      this.beams.push(s, cone);
      return s;
    };
    const spotL = mkBeam(-0.65);
    mkBeam(0.65);
    spotL.castShadow = true;
    spotL.shadow.mapSize.set(512, 512);

    scene.add(g);
  }

  /** passenger torsos: maya rides shotgun, reyes in back */
  addCrew(maya: boolean, reyes: boolean) {
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 });
    const jacketM = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.9 });
    const jacketR = new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.9 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    const hairR = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1 });
    const mk = (x: number, z: number, jacket: THREE.Material, hair: THREE.Material) => {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), jacket);
      torso.position.set(x, 0.92, z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
      head.position.set(x, 1.28, z - 0.02);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, 1.2), hair);
      cap.position.copy(head.position);
      this.group.add(torso, head, cap);
    };
    if (maya) mk(0.4, 0.35, jacketM, hairM);
    if (reyes) mk(-0.45, 0.95, jacketR, hairR);
  }

  /** pet rides on the back seat, visible when you look back */
  addPet(kind: 'dog' | 'cat') {
    const fur = new THREE.MeshStandardMaterial({
      color: kind === 'dog' ? 0x8a5a2a : 0x2a2c30, roughness: 1,
    });
    const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fur);
    bodyM.scale.set(1, 0.9, 1.3);
    bodyM.position.set(0.45, 0.78, 0.95);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur);
    head.position.set(0.45, 0.95, 0.82);
    this.group.add(bodyM, head);
    if (kind === 'dog') {
      const earG = new THREE.ConeGeometry(0.035, 0.09, 6);
      for (const ex of [-0.06, 0.06]) {
        const ear = new THREE.Mesh(earG, fur);
        ear.position.set(0.45 + ex, 1.04, 0.84);
        this.group.add(ear);
      }
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.09), fur);
      snout.position.set(0.45, 0.92, 0.73);
      this.group.add(snout);
    } else {
      const earG = new THREE.ConeGeometry(0.03, 0.07, 4);
      for (const ex of [-0.055, 0.055]) {
        const ear = new THREE.Mesh(earG, fur);
        ear.position.set(0.45 + ex, 1.03, 0.82);
        this.group.add(ear);
      }
      const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 6), fur);
      tailM.position.set(0.45, 0.9, 1.08);
      tailM.rotation.x = 0.5;
      this.group.add(tailM);
    }
  }

  setLights(on: boolean) {
    for (const b of this.beams) b.visible = on;
  }

  setWet(alpha: number) {
    this.dropMat.opacity = alpha;
  }

  setCrack(level: number) {
    const want = Math.floor(Math.min(1, level) * 4.999);
    while (this.crackDrawn < want) {
      this.crackDrawn++;
      const x = this.crackCtx;
      const cx = 30 + Math.random() * 196;
      const cy = 30 + Math.random() * 100;
      x.strokeStyle = 'rgba(220,235,245,0.85)';
      x.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        x.beginPath();
        x.moveTo(cx, cy);
        let px = cx, py = cy;
        const len = 18 + Math.random() * 42;
        for (let k = 1; k <= 4; k++) {
          px += Math.cos(a + (Math.random() - 0.5) * 0.7) * (len / 4);
          py += Math.sin(a + (Math.random() - 0.5) * 0.7) * (len / 4);
          x.lineTo(px, py);
        }
        x.stroke();
      }
      this.crackTex.needsUpdate = true;
    }
  }

  setScreen(lines: string[]) {
    const x = this.screenCtx;
    x.fillStyle = '#04140a';
    x.fillRect(0, 0, 256, 160);
    x.font = 'bold 19px monospace';
    x.fillStyle = '#4ae08a';
    lines.forEach((L, i) => x.fillText(L, 14, 34 + i * 32));
    x.strokeStyle = '#4ae08a';
    x.lineWidth = 3;
    x.strokeRect(3, 3, 250, 154);
    this.screenTex.needsUpdate = true;
  }

  private drawDials(kmh: number) {
    const x = this.dialCtx;
    x.fillStyle = '#04060a';
    x.fillRect(0, 0, 256, 128);
    x.shadowColor = '#67e8f9';
    x.shadowBlur = 10;
    x.strokeStyle = '#67e8f9';
    x.lineWidth = 4;
    for (const cx of [64, 192]) {
      x.beginPath();
      x.arc(cx, 72, 44, Math.PI * 0.75, Math.PI * 2.25);
      x.stroke();
    }
    const frac = Math.min(1, kmh / 180);
    const a = Math.PI * 0.75 + Math.PI * 1.5 * frac;
    x.shadowColor = '#ff4444';
    x.strokeStyle = '#ff5555';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(64, 72);
    x.lineTo(64 + Math.cos(a) * 38, 72 + Math.sin(a) * 38);
    x.stroke();
    x.shadowBlur = 0;
    x.fillStyle = '#67e8f9';
    x.font = 'bold 24px monospace';
    x.textAlign = 'center';
    x.fillText('PARK', 192, 82);
    x.font = '11px monospace';
    x.fillText('brake set', 192, 98);
    this.dialTex.needsUpdate = true;
  }

  private drawDrops() {
    const x = this.dropCtx;
    x.clearRect(0, 0, 256, 160);
    for (let i = 0; i < 260; i++) {
      const r = 0.6 + Math.random() * 1.8;
      x.fillStyle = `rgba(200,220,235,${0.15 + Math.random() * 0.4})`;
      x.beginPath();
      x.arc(Math.random() * 256, Math.random() * 160, r, 0, 6.29);
      x.fill();
    }
    x.strokeStyle = 'rgba(200,220,235,0.3)';
    x.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * 256, sy = Math.random() * 160;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx - 3 - Math.random() * 5, sy + 8 + Math.random() * 14);
      x.stroke();
    }
    this.dropTex.needsUpdate = true;
  }

  update(dt: number, t: number, steer: number, speedKmh: number, windSpeed: number) {
    this.spinner.rotation.z = steer;
    this.frontL.rotation.y = steer * 0.45;
    this.frontR.rotation.y = steer * 0.45;
    for (const w of this.wheels) w.rotation.x -= (speedKmh / 3.6) * dt / 0.4;
    if (this.wipersOn) {
      this.wiperPhase += dt * 4.4;
      const a = Math.sin(this.wiperPhase) * 0.55;
      this.wiperL.rotation.z = -0.5 + a;
      this.wiperR.rotation.z = -0.5 + a;
      const passed = Math.sin(this.wiperPhase) > 0.92;
      if (passed && !this.lastSwish && this.onWiperPass) this.onWiperPass();
      this.lastSwish = passed;
    }
    const ph = Math.sin(t * 9) > 0;
    this.beaconMatA.emissiveIntensity = ph ? 3.2 : 0.3;
    this.beaconMatB.emissiveIntensity = ph ? 0.3 : 3.2;
    this.beaconLight.color.setHex(ph ? 0xff3333 : 0x3355ff);
    this.beaconLight.intensity = 4 + Math.abs(Math.sin(t * 9)) * 4;
    this.anem.rotation.y += dt * (1 + windSpeed * 0.35);
    this.dialTimer -= dt;
    if (this.dialTimer <= 0 && Math.abs(speedKmh - this.dialKmh) > 1.5) {
      this.dialTimer = 0.15;
      this.dialKmh = speedKmh;
      this.drawDials(speedKmh);
    }
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 0.4;
      this.drawDrops();
    }
  }
}
