import * as THREE from 'three';

// Storm environment: fields, road cross, houses (roofs fly off), trees
// (flatten near the funnel), utility poles + power lines, road signs.
function fieldTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const cols = ['#2a3a24', '#31452a', '#3a4a2a', '#2e3d28', '#35402a'];
  const n = 8, s = 512 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      x.fillStyle = cols[(i * 7 + j * 3) % cols.length];
      x.fillRect(i * s, j * s, s, s);
    }
  }
  x.strokeStyle = 'rgba(20,26,16,0.8)';
  x.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke();
  }
  for (let i = 0; i < 2000; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function asphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#23262b';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  x.fillStyle = '#b8bcc2';
  x.fillRect(4, 0, 3, 128);
  x.fillRect(121, 0, 3, 128);
  x.fillStyle = '#c9a83c';
  x.fillRect(62, 20, 4, 40);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface House { group: THREE.Group; roof: THREE.Mesh; x: number; z: number; flying: boolean; vel: THREE.Vector3; ang: THREE.Vector3 }
interface Tree { x: number; z: number; s: number; phase: number; down: number; fallDir: number }
interface Pole { mesh: THREE.Mesh; x: number; z: number; tilt: number; tiltDir: number }
interface Sign { board: THREE.Mesh; x: number; z: number; flying: boolean; vel: THREE.Vector3; ang: number }

export class World {
  private houses: House[] = [];
  private trees: Tree[] = [];
  private trunkMesh!: THREE.InstancedMesh;
  private canopyMesh!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private poles: Pole[] = [];
  private signs: Sign[] = [];

  constructor(scene: THREE.Scene) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // road cross
    const at = asphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({ map: at, roughness: 0.95 });
    const roadMat2 = new THREE.MeshStandardMaterial({ map: at.clone(), roughness: 0.95 });
    (roadMat2.map as THREE.CanvasTexture).repeat.set(1, 40);
    roadMat.map?.repeat.set(1, 40);
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 600), roadMat);
    r1.rotation.x = -Math.PI / 2;
    r1.position.y = 0.02;
    r1.receiveShadow = true;
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(7, 600), roadMat2);
    r2.rotation.x = -Math.PI / 2;
    r2.rotation.z = Math.PI / 2;
    r2.position.y = 0.025;
    r2.receiveShadow = true;
    scene.add(r1, r2);

    // houses along the roads
    const wallCols = [0xb8a88e, 0x9a8a76, 0xc0b49a, 0x8e7a68, 0xa89880, 0xb0a08a];
    const spots: [number, number][] = [[14, 24], [-16, -34], [26, -10], [-22, 48], [42, 32], [-38, -58]];
    spots.forEach(([hx, hz], i) => {
      const g = new THREE.Group();
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3, 5),
        new THREE.MeshStandardMaterial({ color: wallCols[i], roughness: 0.9 })
      );
      walls.position.y = 1.5;
      walls.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 4.8, 2.4, 4, 1),
        new THREE.MeshStandardMaterial({ color: 0x4a3630, roughness: 0.9 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 4.2;
      roof.castShadow = true;
      g.add(walls, roof);
      // warm windows
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x201408, emissive: 0xffb45e, emissiveIntensity: 1.4,
      });
      for (const wx of [-1.8, 1.8]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), winMat);
        w.position.set(wx, 1.6, 2.51);
        g.add(w);
      }
      g.position.set(hx, 0, hz);
      g.rotation.y = (i % 2) * 0.4;
      scene.add(g);
      this.houses.push({ group: g, roof, x: hx, z: hz, flying: false, vel: new THREE.Vector3(), ang: new THREE.Vector3() });
    });

    // trees (instanced trunk + canopy)
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6);
    const canGeo = new THREE.IcosahedronGeometry(1.7, 0);
    let placed = 0;
    let guard = 0;
    while (placed < 110 && guard++ < 3000) {
      const tx = (Math.random() - 0.5) * 420;
      const tz = (Math.random() - 0.5) * 420;
      if (Math.abs(tx) < 5.5 || Math.abs(tz) < 5.5) continue; // keep roads clear
      let nearHouse = false;
      for (const h of this.houses) {
        if (Math.hypot(tx - h.x, tz - h.z) < 8) { nearHouse = true; break; }
      }
      if (nearHouse) continue;
      this.trees.push({ x: tx, z: tz, s: 0.7 + Math.random() * 0.9, phase: Math.random() * 6.28, down: 0, fallDir: Math.random() * 6.28 });
      placed++;
    }
    this.trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }), this.trees.length);
    this.canopyMesh = new THREE.InstancedMesh(canGeo, new THREE.MeshStandardMaterial({ color: 0x1d3320, roughness: 1 }), this.trees.length);
    this.trunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.canopyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.trunkMesh.frustumCulled = false;
    this.canopyMesh.frustumCulled = false;
    scene.add(this.trunkMesh, this.canopyMesh);

    // utility poles + power lines along the north road
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7.5, 7);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1 });
    const tops: THREE.Vector3[] = [];
    for (let z = -90; z <= 90; z += 20) {
      const m = new THREE.Mesh(poleGeo, poleMat);
      m.position.set(5.5, 3.75, z);
      m.castShadow = true;
      scene.add(m);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), poleMat);
      arm.position.set(5.5, 6.9, z);
      m.add(arm);
      arm.position.set(0, 3.15, 0);
      this.poles.push({ mesh: m, x: 5.5, z, tilt: 0, tiltDir: Math.random() * 6.28 });
      tops.push(new THREE.Vector3(5.5, 6.9, z));
    }
    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1];
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8;
        const sag = (tt: number) => Math.sin(tt * Math.PI) * -0.9;
        linePts.push(
          new THREE.Vector3().lerpVectors(a, b, t0).add(new THREE.Vector3(0, sag(t0), 0)),
          new THREE.Vector3().lerpVectors(a, b, t1).add(new THREE.Vector3(0, sag(t1), 0))
        );
      }
    }
    const lg = new THREE.BufferGeometry().setFromPoints(linePts);
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0a0a0a })));

    // road signs
    const signMat = new THREE.MeshStandardMaterial({ color: 0xc9a83c, roughness: 0.6, side: THREE.DoubleSide });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.6 });
    for (const [sx, sz] of [[4.5, 8], [-4.5, -14], [9, -4.5], [-9, 30]] as [number, number][]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), postMat);
      post.position.set(sx, 1.1, sz);
      scene.add(post);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), signMat);
      board.position.set(sx, 2.2, sz);
      board.rotation.z = Math.PI / 4;
      board.rotation.y = Math.random() * 3;
      scene.add(board);
      this.signs.push({ board, x: sx, z: sz, flying: false, vel: new THREE.Vector3(), ang: 0 });
    }
  }

  onRoad(x: number, z: number): boolean {
    return Math.abs(x) < 3.5 || Math.abs(z) < 3.5;
  }

  update(dt: number, t: number, torX: number, torZ: number, radius: number, windSpeed: number) {
    // houses: roofs tear off
    for (const h of this.houses) {
      const d = Math.hypot(h.x - torX, h.z - torZ);
      if (!h.flying && d < radius + 14) {
        h.flying = true;
        const a = Math.atan2(h.z - torZ, h.x - torX) + Math.PI / 2;
        h.vel.set(Math.cos(a) * 22 + (Math.random() - 0.5) * 8, 13 + Math.random() * 6, Math.sin(a) * 22);
        h.ang.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      }
      if (h.flying) {
        h.vel.y -= 22 * dt;
        h.roof.position.addScaledVector(h.vel, dt);
        h.roof.rotation.x += h.ang.x * dt;
        h.roof.rotation.y += h.ang.y * dt;
        h.roof.rotation.z += h.ang.z * dt;
        const wy = h.roof.position.y; // roof local == world offset (group at y 0)
        if (wy < 0.6) {
          h.roof.position.y = 0.6;
          h.vel.set(0, 0, 0);
          h.ang.set(0, 0, 0);
        }
      }
    }
    // trees: sway, shake, flatten
    for (let i = 0; i < this.trees.length; i++) {
      const tr = this.trees[i];
      const d = Math.hypot(tr.x - torX, tr.z - torZ);
      if (tr.down < 1 && d < radius * 1.15) tr.down = Math.min(1, tr.down + dt * 1.5);
      const sway = Math.sin(t * 2 + tr.phase) * 0.02 * Math.min(3, windSpeed / 12);
      const shake = d < radius * 2.5 ? Math.sin(t * 17 + tr.phase) * 0.06 : 0;
      const lean = tr.down * 1.35;
      const s = tr.s;
      // trunk
      this.dummy.position.set(tr.x, 1.2 * s * (1 - tr.down * 0.55), tr.z);
      this.dummy.rotation.set(Math.cos(tr.fallDir) * lean, 0, Math.sin(tr.fallDir) * lean + sway + shake);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.trunkMesh.setMatrixAt(i, this.dummy.matrix);
      // canopy rides the lean
      this.dummy.position.set(
        tr.x + Math.sin(tr.fallDir) * lean * 1.6 * s,
        (2.4 + 1.2) * s * (1 - tr.down * 0.62),
        tr.z + Math.cos(tr.fallDir) * lean * 1.6 * s
      );
      this.dummy.rotation.set(Math.cos(tr.fallDir) * lean, tr.phase, Math.sin(tr.fallDir) * lean + sway * 1.5 + shake);
      this.dummy.scale.setScalar(s * (1 - tr.down * 0.25));
      this.dummy.updateMatrix();
      this.canopyMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.canopyMesh.instanceMatrix.needsUpdate = true;
    // poles: tilt permanently when the core passes
    for (const p of this.poles) {
      const d = Math.hypot(p.x - torX, p.z - torZ);
      if (p.tilt < 1 && d < radius * 1.1) p.tilt = Math.min(1, p.tilt + dt * 2);
      p.mesh.rotation.set(Math.cos(p.tiltDir) * p.tilt * 1.2, 0, Math.sin(p.tiltDir) * p.tilt * 1.2);
    }
    // signs: boards fly
    for (const s of this.signs) {
      const d = Math.hypot(s.x - torX, s.z - torZ);
      if (!s.flying && d < radius + 20) {
        s.flying = true;
        s.vel.set((Math.random() - 0.5) * 30, 10 + Math.random() * 8, (Math.random() - 0.5) * 30);
        s.ang = (Math.random() - 0.5) * 12;
      }
      if (s.flying) {
        s.vel.y -= 18 * dt;
        s.board.position.addScaledVector(s.vel, dt);
        s.board.rotation.z += s.ang * dt;
        if (s.board.position.y < 0.1) {
          s.board.position.y = 0.1;
          s.vel.set(0, 0, 0);
          s.ang = 0;
        }
      }
    }
  }
}
