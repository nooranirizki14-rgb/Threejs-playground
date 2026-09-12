import * as THREE from 'three';

// FIRST PERSON ON THE BASEPLATE — click to capture the mouse,
// WASD to walk, SPACE to jump. You stay on the plate.

const container = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1410, 0.9));
const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
key.position.set(2.5, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
scene.add(key);
const rim = new THREE.DirectionalLight(0x97ce4c, 1.1);
rim.position.set(-3, 1.5, -3);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x88aaff, 0.45);
fill.position.set(-2, 0, 3);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3.4, 40),
  new THREE.ShadowMaterial({ opacity: 0.3 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.42;
ground.receiveShadow = true;
scene.add(ground);

// the baseplate: dark disc, glowing green rim, short stem
const plateMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.65, roughness: 0.35 });
const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 0.14, 48), plateMat);
plate.position.y = -1.22;
plate.castShadow = true;
plate.receiveShadow = true;
scene.add(plate);
const rimRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.06, 0.025, 12, 64),
  new THREE.MeshStandardMaterial({ color: 0x0b0e15, emissive: 0x97ce4c, emissiveIntensity: 1.6 })
);
rimRing.rotation.x = Math.PI / 2;
rimRing.position.y = -1.16;
scene.add(rimRing);
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.14, 24), plateMat);
stem.position.y = -1.35;
stem.castShadow = true;
scene.add(stem);

// --- first-person player, standing on the plate ---
const EYE = 1.6;
const PLATE_TOP = -1.15;
const MAX_R = 0.8; // invisible edge: you stay on the plate
const SPEED = 2.6;
const player = { x: 0, z: 0, y: PLATE_TOP, vy: 0 };
let yaw = 0;
let pitch = -0.05;
let bobPhase = 0;
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
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
// touch devices: tap to dismiss, drag to look
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
  yaw -= e.movementX * 0.0023;
  pitch -= e.movementY * 0.0023;
  pitch = Math.max(-1.55, Math.min(1.55, pitch));
});
let lastT = null;
canvas.addEventListener('touchstart', (e) => {
  lastT = e.touches[0];
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (lastT) {
    yaw -= (t.clientX - lastT.clientX) * 0.005;
    pitch -= (t.clientY - lastT.clientY) * 0.005;
    pitch = Math.max(-1.55, Math.min(1.55, pitch));
  }
  lastT = t;
}, { passive: true });

function updatePlayer(dt) {
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let dx = -sin * f + cos * s;
  let dz = -cos * f - sin * s;
  const len = Math.hypot(dx, dz);
  if (len > 0.01) {
    dx = (dx / len) * SPEED * dt;
    dz = (dz / len) * SPEED * dt;
    player.x += dx;
    player.z += dz;
    bobPhase += dt * 9;
  }
  // stay on the plate
  const r = Math.hypot(player.x, player.z);
  if (r > MAX_R) {
    player.x *= MAX_R / r;
    player.z *= MAX_R / r;
  }
  // jump + gravity, landing back on the plate
  if (keys.Space && player.y <= PLATE_TOP + 0.001) player.vy = 4.2;
  player.vy -= 11 * dt;
  player.y += player.vy * dt;
  if (player.y <= PLATE_TOP) {
    player.y = PLATE_TOP;
    player.vy = 0;
  }
  const bob = len > 0.01 ? Math.sin(bobPhase) * 0.03 : 0;
  camera.position.set(player.x, player.y + EYE + bob, player.z);
  camera.rotation.set(pitch, yaw, 0);
}

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
  updatePlayer(dt);
  renderer.render(scene, camera);
  window.__bootOK = true;
}
requestAnimationFrame(frame);
