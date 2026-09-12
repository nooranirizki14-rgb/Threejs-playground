import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ElasticMesh } from './elastic.js';
import { buildMorty } from './morty.js';
import { Boing } from './boing.js';

// ELASTIC MORTY — grab his face and pull. He doesn't mind. Probably.

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
const CAM_HOME = new THREE.Vector3(0.4, 0.35, 4.4);
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.copy(CAM_HOME);

scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1410, 0.7));
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

// display base plate: dark disc, glowing green rim, short stem
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

const morty = buildMorty();
scene.add(morty.mesh, morty.pupilL, morty.pupilR);
const elastic = new ElasticMesh(morty.mesh);
const boing = new Boing();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.minDistance = 2.6;
controls.maxDistance = 8;
controls.maxPolarAngle = 1.7;
controls.autoRotateSpeed = 1.2;

function resetView() {
  camera.position.copy(CAM_HOME);
  controls.target.set(0, 0, 0);
  controls.update();
}

// --- pulling ---
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const grabPlane = new THREE.Plane();
const hitP = new THREE.Vector3();
let dragging = false;
let lastInteract = performance.now();

function setNDC(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

canvas.addEventListener('pointerdown', (e) => {
  boing.ensure();
  lastInteract = performance.now();
  setNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(morty.mesh, false)[0];
  if (hit) {
    dragging = true;
    controls.enabled = false;
    controls.autoRotate = false;
    elastic.grab(hit.point);
    const n = new THREE.Vector3();
    camera.getWorldDirection(n);
    grabPlane.setFromNormalAndCoplanarPoint(n, hit.point);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
});

canvas.addEventListener('pointermove', (e) => {
  lastInteract = performance.now();
  setNDC(e);
  if (!dragging) return;
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(grabPlane, hitP)) elastic.dragTo(hitP);
});

function endDrag() {
  if (!dragging) return;
  const pull = elastic.release();
  dragging = false;
  controls.enabled = true;
  lastInteract = performance.now();
  if (pull > 0.12) boing.boing(pull);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('dblclick', (e) => {
  boing.ensure();
  lastInteract = performance.now();
  setNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(morty.mesh, false)[0];
  if (hit) {
    elastic.poke(hit.point);
    boing.blip();
  }
});

// --- UI ---
document.getElementById('jelly').addEventListener('input', (e) => {
  elastic.stiffness = Number(e.target.value);
});
document.getElementById('btn-reset').addEventListener('click', () => {
  elastic.reset();
  resetView();
  lastInteract = performance.now();
});
document.getElementById('btn-poke').addEventListener('click', () => {
  boing.ensure();
  lastInteract = performance.now();
  const p = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() * 0.8 - 0.3,
    1
  ).normalize().multiplyScalar(0.95);
  elastic.poke(p, 3.5);
  boing.blip();
});

// --- pupils ride the deformed surface + follow your cursor ---
const aPos = new THREE.Vector3();
const aNrm = new THREE.Vector3();
const look = new THREE.Vector3();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();

function placePupil(pupil, anchorIdx) {
  elastic.anchor(anchorIdx, aPos, aNrm);
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const mx = Math.max(-1, Math.min(1, ndc.x));
  const my = Math.max(-1, Math.min(1, ndc.y));
  look.copy(camRight).multiplyScalar(mx * 0.05).addScaledVector(camUp, my * 0.05);
  look.addScaledVector(aNrm, -look.dot(aNrm)); // keep it on the tangent plane
  pupil.position.copy(aPos).addScaledVector(aNrm, 0.015).add(look);
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
  controls.autoRotate = !dragging && now - lastInteract > 6000;
  controls.update();
  elastic.update(dt);
  placePupil(morty.pupilL, morty.anchorL);
  placePupil(morty.pupilR, morty.anchorR);
  renderer.render(scene, camera);
  window.__mortyOK = true;
}
requestAnimationFrame(frame);
