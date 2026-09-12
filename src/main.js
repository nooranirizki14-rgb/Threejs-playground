import * as THREE from 'three';

// LOCKED IN THE CAR — night road, driver's seat, mouse look.
// A/D turns the wheel (visual), L toggles headlights, E tries the door. Locked.

const container = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  const el = document.getElementById('err');
  el.classList.remove('hidden');
  el.textContent = '🚫 WebGL unavailable in this browser — try Chrome or Edge.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 25, 110);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
const SEAT = new THREE.Vector3(-0.4, 1.18, 0.35);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0x2a3a5c, 0x0a0c10, 0.8));
const moon = new THREE.DirectionalLight(0x33415e, 0.6);
moon.position.set(-20, 30, -40);
scene.add(moon);
const cabinGlow = new THREE.PointLight(0xffe0b0, 1.6, 3.5, 1.6);
cabinGlow.position.set(0, 1.3, 0.3);
scene.add(cabinGlow);

// ---------- canvas textures ----------
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#202329';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  x.fillStyle = '#9aa0a8';
  x.fillRect(10, 0, 6, 256);
  x.fillRect(240, 0, 6, 256);
  x.fillStyle = '#c9a83c';
  x.fillRect(124, 40, 8, 80);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 30);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#04060a';
  x.fillRect(0, 0, 256, 128);
  x.shadowColor = '#67e8f9';
  x.shadowBlur = 12;
  x.strokeStyle = '#67e8f9';
  x.lineWidth = 4;
  for (const cx of [64, 192]) {
    x.beginPath();
    x.arc(cx, 72, 44, Math.PI * 0.75, Math.PI * 2.25);
    x.stroke();
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.75 + (Math.PI * 1.5 * i) / 8;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 36, 72 + Math.sin(a) * 36);
      x.lineTo(cx + Math.cos(a) * 44, 72 + Math.sin(a) * 44);
      x.stroke();
    }
  }
  x.shadowColor = '#ff4444';
  x.strokeStyle = '#ff5555';
  x.lineWidth = 3;
  x.beginPath(); x.moveTo(64, 72); x.lineTo(38, 96); x.stroke();
  x.beginPath(); x.moveTo(192, 72); x.lineTo(166, 96); x.stroke();
  x.shadowBlur = 0;
  x.fillStyle = '#67e8f9';
  x.font = 'bold 26px monospace';
  x.textAlign = 'center';
  x.fillText('0', 128, 60);
  x.font = '12px monospace';
  x.fillText('km/h', 128, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- materials ----------
const M = {
  trim: new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.85 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 1 }),
  dash: new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x8aa5bb, transparent: true, opacity: 0.08,
    roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  }),
  body: new THREE.MeshStandardMaterial({ color: 0x232a36, metalness: 0.7, roughness: 0.4 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0x0a0d14, metalness: 0.9, roughness: 0.25 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a1a, emissiveIntensity: 2 }),
  lampHead: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 3 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.8 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x0c140c, roughness: 1 }),
};

function box(w, h, d, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ---------- road + world ----------
// car faces -z. road under it.
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(7, 240),
  new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95 })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, -80);
road.receiveShadow = true;
scene.add(road);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0x0a0f0a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
scene.add(ground);

// street lamps (emissive heads, 2 real lights near the car)
{
  const headGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 5, 8);
  let li = 0;
  for (let z = 20; z >= -100; z -= 20) {
    const sx = (li % 2 === 0 ? 1 : -1) * 4.5;
    const pole = new THREE.Mesh(poleGeo, M.pole);
    pole.position.set(sx, 2.5, z);
    scene.add(pole);
    const head = new THREE.Mesh(headGeo, M.lampHead);
    head.position.set(sx * 0.92, 5.0, z);
    scene.add(head);
    if (li < 2) {
      const pl = new THREE.PointLight(0xffc98a, 10, 20, 1.8);
      pl.position.set(sx * 0.92, 4.8, z);
      scene.add(pl);
    }
    li++;
  }
}

// tree silhouettes
{
  const treeGeo = new THREE.ConeGeometry(1.8, 5, 7);
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Mesh(treeGeo, M.tree);
    const side = Math.random() < 0.5 ? -1 : 1;
    t.position.set(side * (6 + Math.random() * 14), 2.2, 30 - Math.random() * 140);
    t.scale.setScalar(0.7 + Math.random() * 0.8);
    scene.add(t);
  }
}

// stars + moon
{
  const n = 300;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.15 + Math.random() * 1.3;
    p[i * 3] = Math.cos(a) * Math.cos(e) * 250;
    p[i * 3 + 1] = Math.sin(e) * 250;
    p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 250;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xbfd0ff, size: 1.6, sizeAttenuation: false, fog: false,
  })));
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf5, fog: false })
  );
  moonDisc.position.set(-70, 80, -200);
  moonDisc.lookAt(0, 0, 0);
  scene.add(moonDisc);
}

// ---------- car exterior bits ----------
// hood + bumpers + trunk + taillights
box(1.8, 0.12, 1.4, M.body, 0, 0.74, -1.45);
box(1.9, 0.3, 0.25, M.body, 0, 0.45, -2.2);
box(1.8, 0.15, 0.9, M.body, 0, 0.78, 1.7);
box(1.9, 0.3, 0.25, M.body, 0, 0.45, 2.2);
box(0.3, 0.1, 0.06, M.tail, -0.65, 0.72, 2.18);
box(0.3, 0.1, 0.06, M.tail, 0.65, 0.72, 2.18);
// wheels (dark, barely visible)
{
  const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14);
  for (const [wx, wz] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) {
    const w = new THREE.Mesh(wg, M.tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.33, wz);
    scene.add(w);
  }
}

// headlights: 2 spots + visible cones
const beams = [];
function headlight(x) {
  const s = new THREE.SpotLight(0xcfe6ff, 60, 70, 0.46, 0.55, 1.4);
  s.position.set(x, 0.7, -2.2);
  s.target.position.set(x * 1.6, 0, -25);
  scene.add(s, s.target);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbdd8ff, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  cone.rotation.x = -Math.PI / 2 - 0.06;
  cone.position.set(x * 1.4, 0.45, -6.5);
  scene.add(cone);
  beams.push(s, cone);
  return s;
}
const spotL = headlight(-0.65);
headlight(0.65);
spotL.castShadow = true;
spotL.shadow.mapSize.set(512, 512);

// ---------- cabin (you are in here, no exit) ----------
box(2.0, 0.1, 2.6, M.trim, 0, 0.4, 0.05); // floor
box(2.0, 0.1, 2.5, M.trim, 0, 1.5, 0.05); // roof
box(1.9, 0.08, 0.1, M.trim, 0, 1.44, -1.16); // windshield header
// doors (lower) + side glass
box(0.08, 0.55, 2.4, M.trim, -0.98, 0.68, 0.05);
box(0.08, 0.55, 2.4, M.trim, 0.98, 0.68, 0.05);
for (const sx of [-0.98, 0.98]) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.5), M.glass);
  g.rotation.y = Math.PI / 2;
  g.position.set(sx, 1.2, 0.05);
  scene.add(g);
  box(0.07, 0.55, 0.09, M.trim, sx, 1.2, 0.3); // B-pillar
}
// windshield + A-pillars
{
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.68), M.glass);
  ws.rotation.x = -0.675;
  ws.position.set(0, 1.2, -0.95);
  scene.add(ws);
  for (const sx of [-0.95, 0.95]) {
    const p = box(0.07, 0.72, 0.07, M.trim, sx, 1.2, -0.95);
    p.rotation.x = -0.675;
  }
}
// rear glass + panel
{
  const rg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), M.glass);
  rg.position.set(0, 1.2, 1.28);
  scene.add(rg);
  box(1.9, 0.55, 0.08, M.trim, 0, 0.68, 1.28);
}
// dashboard + dials + wheel + console
box(1.9, 0.18, 0.35, M.dash, 0, 0.92, -0.575);
box(1.9, 0.1, 0.3, M.dash, 0, 1.02, -0.62);
{
  const dials = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshBasicMaterial({ map: dialTexture() })
  );
  dials.position.set(-0.4, 0.99, -0.395);
  scene.add(dials);
  box(0.25, 0.08, 0.02, new THREE.MeshStandardMaterial({
    color: 0x061208, emissive: 0x2a7a4a, emissiveIntensity: 1.2,
  }), 0.25, 0.94, -0.395);
}
const steerGroup = new THREE.Group();
steerGroup.position.set(-0.4, 0.95, -0.35);
steerGroup.rotation.x = -0.45;
scene.add(steerGroup);
const spinner = new THREE.Group();
steerGroup.add(spinner);
{
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 10, 28), M.trim);
  spinner.add(wheel);
  const spokeG = new THREE.BoxGeometry(0.34, 0.035, 0.02);
  const s1 = new THREE.Mesh(spokeG, M.trim);
  const s2 = new THREE.Mesh(spokeG, M.trim);
  s2.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), M.trim);
  hub.rotation.x = Math.PI / 2;
  spinner.add(s1, s2, hub);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), M.trim);
  col.rotation.x = Math.PI / 2 - 0.45;
  col.position.set(-0.4, 0.88, -0.48);
  scene.add(col);
}
box(0.3, 0.32, 0.7, M.trim, 0, 0.6, 0.1); // console
{
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), M.trim);
  sh.position.set(0, 0.82, -0.05);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.4 })
  );
  knob.position.set(0, 0.91, -0.05);
  scene.add(sh, knob);
}
// seats
function seat(x, z) {
  box(0.55, 0.18, 0.5, M.seat, x, 0.55, z);
  const back = box(0.55, 0.62, 0.16, M.seat, x, 0.92, z + 0.3);
  back.rotation.x = 0.12;
  box(0.24, 0.14, 0.1, M.seat, x, 1.28, z + 0.35);
}
seat(-0.4, 0.35);
seat(0.4, 0.35);
box(1.5, 0.18, 0.5, M.seat, 0, 0.55, 0.95); // back bench
// rear-view mirror
box(0.03, 0.08, 0.03, M.trim, 0, 1.4, -1.0);
box(0.3, 0.11, 0.03, M.trim, 0, 1.33, -1.0);
{
  const mf = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.09), M.mirror);
  mf.position.set(0, 1.33, -0.983);
  scene.add(mf);
}
// side mirrors on stalks
for (const sx of [-1, 1]) {
  box(0.12, 0.03, 0.03, M.trim, sx * 1.05, 1.0, -0.7);
  box(0.06, 0.12, 0.16, M.body, sx * 1.12, 1.02, -0.7);
}

// ---------- look around (no exit — E just rattles the handle) ----------
let yaw = 0;
let pitch = -0.02;
let steer = 0;
let lightsOn = true;
const keys = {};
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  toastTimer = 2;
}

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE' || e.code === 'KeyF') toast('doors are locked 🔒');
  if (e.code === 'KeyL') {
    lightsOn = !lightsOn;
    for (const b of beams) b.visible = lightsOn;
    toast(lightsOn ? 'headlights on 💡' : 'headlights off');
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

const overlay = document.getElementById('play');
let locked = false;
overlay.addEventListener('click', () => {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
});
overlay.addEventListener('touchstart', () => overlay.classList.add('hidden'), { passive: true });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.classList.toggle('hidden', locked);
});
document.addEventListener('pointerlockerror', () => {
  overlay.querySelector('p').textContent = 'pointer lock blocked — try Chrome on desktop';
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  yaw -= e.movementX * 0.0021;
  pitch -= e.movementY * 0.0021;
  yaw = Math.max(-2.8, Math.min(2.8, yaw));
  pitch = Math.max(-1.1, Math.min(0.6, pitch));
});
let lastT = null;
canvas.addEventListener('touchstart', (e) => {
  lastT = e.touches[0];
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (lastT) {
    yaw = Math.max(-2.8, Math.min(2.8, yaw - (t.clientX - lastT.clientX) * 0.005));
    pitch = Math.max(-1.1, Math.min(0.6, pitch - (t.clientY - lastT.clientY) * 0.005));
  }
  lastT = t;
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  // steering visual: A/D or arrows
  const sIn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  steer += ((sIn * 0.7) - steer) * Math.min(1, dt * 8);
  spinner.rotation.z = steer;
  // idle engine tremble, pinned to the seat
  camera.position.set(
    SEAT.x + Math.sin(t * 27 + 1) * 0.0025,
    SEAT.y + Math.sin(t * 31) * 0.0035,
    SEAT.z
  );
  camera.rotation.set(pitch, yaw, 0);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastEl.classList.add('hidden');
  }
  renderer.render(scene, camera);
  window.__bootOK = true;
}
requestAnimationFrame(frame);
