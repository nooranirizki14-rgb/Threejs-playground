import * as THREE from 'three';
import { Tornado } from './tornado';
import { Weather } from './weather';
import { Debris } from './debris';
import { StormAudio } from './audio';
import { World } from './world';
import { ResearchCar, CAR_STATS } from './car';
import type { CarVariant } from './car';

// ============================== helpers ==============================
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const radio = (name: string): string =>
  (document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement)?.value ?? '';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ============================== save ==============================
interface Save { bank: number; up: Record<string, number> }
const SAVE_KEY = 'tornado-intercept-save-v1';
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (typeof s.bank === 'number' && s.up) return s;
    }
  } catch { /* fresh save */ }
  return { bank: 0, up: {} };
}
function storeSave(s: Save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
const save = loadSave();
const upLvl = (id: string) => save.up[id] ?? 0;

// ============================== upgrades ==============================
interface UpDef { id: string; name: string; desc: string; base: number }
const UPS: UpDef[] = [
  { id: 'armor', name: 'Hull Armor', desc: '+10 max hull / lvl', base: 80 },
  { id: 'plating', name: 'Debris Plating', desc: '−6% debris dmg / lvl', base: 90 },
  { id: 'sensors', name: 'Sensor Array', desc: '+8% data rate / lvl', base: 100 },
  { id: 'camera', name: 'Camera Body', desc: '+15% photo value / lvl', base: 70 },
  { id: 'probe', name: 'Probe Tech', desc: '+15% probe value / lvl', base: 70 },
  { id: 'anchors', name: 'Ground Anchors', desc: '−10% shake, −8% wind dmg / lvl', base: 85 },
  { id: 'radio', name: 'WX Receiver', desc: '+8% event warning / lvl', base: 60 },
  { id: 'lights', name: 'Floodlights', desc: '+18% beam power / lvl', base: 55 },
  { id: 'uplink', name: 'Data Uplink', desc: '+0.1× risk bonus / lvl', base: 110 },
  { id: 'hailguard', name: 'Hail Guards', desc: '−20% hail dmg / lvl', base: 65 },
];
const upCost = (d: UpDef) => (upLvl(d.id) + 1) * d.base;

function renderBank() {
  ($('bank').querySelector('b') as HTMLElement).textContent = String(Math.floor(save.bank));
}
function renderShop() {
  const el = $('upgrades');
  el.innerHTML = '';
  for (const d of UPS) {
    const lvl = upLvl(d.id);
    const maxed = lvl >= 5;
    const row = document.createElement('div');
    row.className = 'up';
    const pips = '●'.repeat(lvl) + '○'.repeat(5 - lvl);
    row.innerHTML = `<div><b>${d.name}</b> <span class="pips">${pips}</span><br/><span>${d.desc}</span></div>`;
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAX' : `⬆ ${upCost(d)}`;
    btn.disabled = maxed || save.bank < upCost(d);
    btn.onclick = () => {
      const c = upCost(d);
      if (save.bank >= c && upLvl(d.id) < 5) {
        save.bank -= c;
        save.up[d.id] = upLvl(d.id) + 1;
        storeSave(save);
        renderBank();
        renderShop();
      }
    };
    row.appendChild(btn);
    el.appendChild(row);
  }
}
renderBank();
renderShop();

// equipment: pick max 2
{
  const boxes = Array.from(document.querySelectorAll('#pick-eq input')) as HTMLInputElement[];
  for (const b of boxes) {
    b.addEventListener('change', () => {
      const on = boxes.filter((x) => x.checked);
      if (on.length > 2) {
        b.checked = false;
        toast('Pick only 2 equipment items!');
      }
    });
  }
}

// ============================== toast / warn ==============================
let toastTimer = 0;
function toast(msg: string, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
}
let warnTimer = 0;
function warn(msg: string, ms = 0) {
  const el = $('warn');
  el.textContent = msg;
  el.classList.remove('hidden');
  window.clearTimeout(warnTimer);
  if (ms > 0) warnTimer = window.setTimeout(() => el.classList.add('hidden'), ms);
}

// ============================== loadout ==============================
interface Loadout {
  car: CarVariant; tor: string; radioMode: 'off' | 'wx' | 'music';
  food: string; pet: string; maya: boolean; reyes: boolean; eq: Set<string>;
}
let loadout: Loadout | null = null;

// ============================== game ==============================
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let hemi: THREE.HemisphereLight;
let sun: THREE.DirectionalLight;
let car: ResearchCar;
let world: World;
let tornado: Tornado;
let weather: Weather;
let debris: Debris;
let audio: StormAudio;
let fogBase = 0.004;

let started = false;
let ended = false;
let yaw = 0;
let pitch = -0.04;
let t = 0;
let hull = 100;
let hullMax = 100;
let data = 0;
let peakWind = 0;
let photos = 0;
let encounters = 0;
let probesScored = 0;
let probesLeft = 1;
let photoCD = 0;
let reyesT = 18;
let wxT = 40;
let eventT = 20;
let pendingEvent = -1;
let glitchT = 0;
let shakeT = 0;
let endT = -1;
let endReason = '';
let probe: { x: number; z: number; mesh: THREE.Group } | null = null;
let trail: { x: number; z: number }[] = [];
let trailT = 0;
let blobs: { x: number; z: number; r: number }[] = [];
let hudT = 0;
let missionT = 0;
let dashT = 0;
let lastFlash = 0;
let mayaFlags = new Set<string>();
let peakPaid = [false, false, false];
let encounterCD = 0;
let tmpV = new THREE.Vector3();
let tmpV2 = new THREE.Vector3();

interface Mission { id: string; name: string; prog: string; pay: string; done: boolean }
const missions: Mission[] = [
  { id: 'probe', name: '🛰 Deploy probe in path (F)', prog: '0/1', pay: '150', done: false },
  { id: 'photos', name: '📷 Photograph tornado (P, aim!)', prog: '0/8', pay: '25 ea', done: false },
  { id: 'peak', name: '💨 Record peak wind 85+ m/s', prog: '0 m/s', pay: 'bonus', done: false },
  { id: 'encounter', name: '🌪 Survive a close encounter', prog: '0/1', pay: '200', done: false },
  { id: 'endure', name: '🏠 Endure until it dissipates', prog: '—', pay: '300', done: false },
];
const mission = (id: string) => missions.find((m) => m.id === id) as Mission;

function dataMult() {
  const L = loadout as Loadout;
  let m = CAR_STATS[L.car].sensors;
  if (L.eq.has('pod')) m *= 1.25;
  if (L.food === 'coffee') m *= 1.15;
  m *= 1 + upLvl('sensors') * 0.08;
  return m;
}
function dmgMult() {
  const L = loadout as Loadout;
  let m = 1;
  if (L.eq.has('glass')) m *= 0.75;
  if (L.food === 'donuts') m *= 0.85;
  if (L.pet === 'cat') m *= 0.95;
  m *= 1 - upLvl('plating') * 0.06;
  return m;
}
function riskMult(prox: number) {
  return 1 + prox * 2 + upLvl('uplink') * 0.1;
}
function riskLabel(prox: number) {
  if (prox > 0.75) return 'EXTREME';
  if (prox > 0.5) return 'HIGH';
  if (prox > 0.28) return 'GUARDED';
  return 'LOW';
}

function applyEnv(id: string) {
  const bg = new THREE.Color();
  let hemiSky = 0x9fb4c0, hemiGnd = 0x2a332a, hemiI = 0.65;
  let sunC = 0xdfe8ee, sunI = 1.1, hail = 0, rainBoost = 0;
  if (id === 'rope') { bg.setHex(0x46524c); fogBase = 0.0042; }
  else if (id === 'wedge') { bg.setHex(0x22262c); fogBase = 0.005; hemiI = 0.45; sunI = 0.7; hail = 0.6; rainBoost = 0.2; }
  else if (id === 'multi') { bg.setHex(0x58423a); fogBase = 0.0032; hemiSky = 0xd8a080; sunC = 0xffb070; sunI = 1.3; }
  else if (id === 'rainwrap') { bg.setHex(0x33383f); fogBase = 0.009; hemiI = 0.5; sunI = 0.6; hail = 0.25; rainBoost = 0.5; }
  else if (id === 'night') { bg.setHex(0x04060b); fogBase = 0.0045; hemiSky = 0x223048; hemiI = 0.18; sunC = 0x8fa8ff; sunI = 0.25; hail = 0.15; }
  else { bg.setHex(0x3d454e); fogBase = 0.0038; }
  scene.background = bg;
  scene.fog = new THREE.FogExp2(bg.clone(), fogBase);
  hemi.color.setHex(hemiSky);
  hemi.groundColor.setHex(hemiGnd);
  hemi.intensity = hemiI;
  sun.color.setHex(sunC);
  sun.intensity = sunI;
  weather.setHail(hail);
  car.setLights(id === 'night' || id === 'wedge');
  (weather as unknown as { baseBoost: number }).baseBoost = rainBoost;
}

function buildWorld() {
  const L = loadout as Loadout;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 900);
  camera.rotation.order = 'YXZ';
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('scene').appendChild(renderer.domElement);

  hemi = new THREE.HemisphereLight(0x9fb4c0, 0x2a332a, 0.65);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xdfe8ee, 1.1);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  world = new World(scene);
  tornado = new Tornado(scene);
  tornado.setType(L.tor);
  weather = new Weather(scene);
  debris = new Debris(scene);
  audio = new StormAudio();
  car = new ResearchCar(scene, L.car);
  car.addCrew(L.maya, L.reyes);
  if (L.pet === 'dog' || L.pet === 'cat') car.addPet(L.pet);
  car.group.position.set(0, 0, 0);
  camera.position.set(-0.4, 1.32, 0.15);
  car.group.add(camera);
  const lightMul = 1 + upLvl('lights') * 0.18;
  void lightMul;

  applyEnv(L.tor);
  (car as unknown as { lightsOn: boolean }).lightsOn = L.tor === 'night' || L.tor === 'wedge';
  audio.setRadio(L.radioMode);

  hullMax = CAR_STATS[L.car].hull + (L.food === 'sandwich' ? 20 : 0) + upLvl('armor') * 10;
  hull = hullMax;

  car.onWiperPass = () => audio.wiperSwish();
  world.onPowerFlash = () => {
    audio.crack();
    toast('⚡ Power flash! Lines are down.');
  };

  for (let i = 0; i < 10; i++) {
    blobs.push({ x: (Math.random() - 0.5) * 500, z: (Math.random() - 0.5) * 500, r: 20 + Math.random() * 40 });
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// ---------- input ----------
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement && started && !ended) {
    yaw = clamp(yaw - e.movementX * 0.0022, -2.4, 2.4);
    pitch = clamp(pitch - e.movementY * 0.0022, -0.9, 0.5);
  }
});
document.addEventListener('keydown', (e) => {
  if (!started || ended || !loadout) return;
  const k = e.key.toLowerCase();
  if (k === 'f') deployProbe();
  else if (k === 'p') takePhoto(false);
  else if (k === 'v') { car.wipersOn = !car.wipersOn; toast(car.wipersOn ? 'Wipers on' : 'Wipers off', 1200); }
  else if (k === 'l') {
    const on = !(car as unknown as { lightsOn: boolean }).lightsOn;
    (car as unknown as { lightsOn: boolean }).lightsOn = on;
    car.setLights(on);
  }
  else if (k === 'c') {
    const L = loadout as Loadout;
    L.radioMode = L.radioMode === 'off' ? 'wx' : L.radioMode === 'wx' ? 'music' : 'off';
    audio.setRadio(L.radioMode);
    toast(`📻 Radio: ${L.radioMode.toUpperCase()}`, 1500);
  }
  else if (k === 'm') {
    const muted = audio.toggleMute();
    toast(muted ? '🔇 Muted' : '🔊 Sound on', 1200);
  }
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && started && !ended) {
    $('play').classList.remove('hidden');
    ($('play').querySelector('h2') as HTMLElement).textContent = '⏸ PAUSED — CLICK TO RESUME';
  }
});
$('play').addEventListener('click', () => {
  audio.unlock();
  $('play').classList.add('hidden');
  renderer.domElement.requestPointerLock();
  if (!started) {
    started = true;
    toast('🌪 Intercept started — hold position!', 3000);
  }
});

// ---------- actions ----------
function deployProbe() {
  if (!probe && probesLeft > 0) {
    probesLeft--;
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.7, 10),
      new THREE.MeshStandardMaterial({ color: 0xe06a1a, roughness: 0.6 })
    );
    cone.position.y = 0.35;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x888890 })
    );
    pole.position.y = 1.2;
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2222, emissiveIntensity: 3 })
    );
    tip.position.y = 1.85;
    g.add(cone, pole, tip);
    const px = (Math.random() - 0.5) * 6;
    const pz = -14 - Math.random() * 4;
    g.position.set(px, 0, pz);
    scene.add(g);
    probe = { x: px, z: pz, mesh: g };
    audio.beep(660);
    toast('🛰 Probe deployed ahead of the car!');
  } else if (probe) {
    toast('Probe already out!', 1500);
  } else {
    toast('No probes left!', 1500);
  }
}

function aimAngle(): number {
  camera.getWorldDirection(tmpV);
  tmpV2.set(tornado.pos.x - camera.getWorldPosition(new THREE.Vector3()).x, 0, tornado.pos.z - camera.getWorldPosition(new THREE.Vector3()).z).normalize();
  tmpV.y = 0;
  tmpV.normalize();
  return tmpV.angleTo(tmpV2);
}

function photoValue(riskM: number, auto: boolean): number {
  const L = loadout as Loadout;
  let v = 25 * (1 + upLvl('camera') * 0.15) * riskM;
  if (L.eq.has('cam')) v *= 1.5;
  if (auto) v *= 0.5;
  return v;
}

function takePhoto(auto: boolean) {
  if (photoCD > 0 || tornado.dissipated) return;
  const L = loadout as Loadout;
  const dist = Math.hypot(tornado.pos.x, tornado.pos.z);
  const range = L.eq.has('cam') ? 380 : 300;
  if (dist > range) {
    if (!auto) toast('Too far for a photo — wait for it to close in.', 2000);
    return;
  }
  if (!auto && aimAngle() > 0.13) {
    toast('🎯 Aim the camera at the tornado first! (mouse to look)', 2200);
    return;
  }
  photoCD = 2.5;
  photos++;
  const prox = clamp(1 - dist / 300, 0, 1);
  const v = photoValue(riskMult(prox), auto);
  data += v;
  audio.shutter();
  const m = mission('photos');
  m.prog = `${Math.min(8, photos)}/8`;
  if (photos === 8) {
    m.done = true;
    data += 100;
    toast('📷 Photo series complete! +100 bonus', 2500);
  } else if (!auto) {
    toast(`📷 Photo +${Math.floor(v)}`, 1400);
  }
  if (L.maya && photos === 1) toast('Maya: "Great shot! Keep them coming!"', 2400);
}

// ---------- events ----------
const EVENTS = ['turn', 'strengthen', 'weaken', 'debrisburst', 'outbreak', 'visdrop', 'powerflash', 'glitch'] as const;
function fireEvent() {
  const L = loadout as Loadout;
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  if (L.pet === 'dog' && pendingEvent < 0) {
    audio.bark();
    toast('🐕 Biscuit is barking — something\'s coming!', 2000);
    pendingEvent = 2;
    (fireEvent as unknown as { queued: string }).queued = ev;
    return;
  }
  applyEvent(ev);
}
function applyEvent(ev: string) {
  const L = loadout as Loadout;
  if (ev === 'turn') {
    tornado.turn((Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5));
    toast('🌪️ The tornado turns!');
    if (L.maya) setTimeout(() => toast('Maya: "It\'s changing direction — heads up!"', 2500), 1200);
  } else if (ev === 'strengthen') {
    tornado.addBoost(30);
    warn('⚠ TORNADO STRENGTHENING', 3000);
  } else if (ev === 'weaken') {
    tornado.addBoost(-25);
    toast('📉 The tornado is weakening… for now.', 2500);
  } else if (ev === 'debrisburst') {
    debris.burst(12);
    toast('🌀 Debris burst incoming!', 2500);
  } else if (ev === 'outbreak') {
    weather.startOutbreak(10);
    toast('⚡ Lightning outbreak!', 2500);
  } else if (ev === 'visdrop') {
    weather.setVisDrop(12);
    toast('🌧 Visibility dropping!', 2500);
  } else if (ev === 'powerflash') {
    audio.boom();
    shakeT = 0.8;
    warn('⚡ TRANSFORMER EXPLOSION', 2500);
  } else if (ev === 'glitch') {
    glitchT = 8;
    toast('📡 Sensors glitching!', 2500);
  }
  eventT = (16 + Math.random() * 14) * (1 + upLvl('radio') * 0.08);
}

// ---------- radar ----------
const radarCtx = ($('radar') as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D;
let sweep = 0;
function drawRadar(dist: number) {
  const x = radarCtx;
  const W = 150, C = 75;
  x.fillStyle = '#031007';
  x.fillRect(0, 0, W, W);
  if (glitchT > 0) {
    for (let i = 0; i < 120; i++) {
      x.fillStyle = `rgba(${100 + Math.random() * 155},255,${100 + Math.random() * 155},0.5)`;
      x.fillRect(Math.random() * W, Math.random() * W, 3, 3);
    }
  }
  const scale = C / 300;
  x.strokeStyle = 'rgba(60,220,120,0.35)';
  x.lineWidth = 1;
  for (const r of [100, 200, 300]) {
    x.beginPath();
    x.arc(C, C, r * scale, 0, 6.29);
    x.stroke();
  }
  // rain blobs
  for (const b of blobs) {
    const bx = C + b.x * scale;
    const bz = C + b.z * scale;
    if (bx < -30 || bx > W + 30 || bz < -30 || bz > W + 30) continue;
    const g = x.createRadialGradient(bx, bz, 1, bx, bz, b.r * scale);
    g.addColorStop(0, 'rgba(60,200,90,0.5)');
    g.addColorStop(1, 'rgba(60,200,90,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(bx, bz, b.r * scale, 0, 6.29);
    x.fill();
  }
  // tornado trail
  x.fillStyle = 'rgba(255,255,255,0.5)';
  for (const p of trail) {
    x.fillRect(C + p.x * scale - 1, C + p.z * scale - 1, 2, 2);
  }
  // probe
  if (probe) {
    x.fillStyle = '#ffa040';
    x.fillRect(C + probe.x * scale - 2, C + probe.z * scale - 2, 4, 4);
  }
  // tornado
  if (!tornado.dissipated) {
    const tx = C + tornado.pos.x * scale;
    const tz = C + tornado.pos.z * scale;
    x.fillStyle = '#ff3333';
    x.beginPath();
    x.moveTo(tx, tz - 6);
    x.lineTo(tx + 5, tz + 4);
    x.lineTo(tx - 5, tz + 4);
    x.closePath();
    x.fill();
    x.strokeStyle = '#fff';
    x.beginPath();
    x.arc(tx, tz, 7, 0, 6.29);
    x.stroke();
  }
  // sweep
  sweep += 0.03;
  x.strokeStyle = 'rgba(80,255,140,0.6)';
  x.beginPath();
  x.moveTo(C, C);
  x.lineTo(C + Math.cos(sweep) * C, C + Math.sin(sweep) * C);
  x.stroke();
  // player
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(C, C, 3, 0, 6.29);
  x.fill();
  x.fillStyle = '#7dffb0';
  x.font = '9px monospace';
  x.fillText(`${Math.floor(dist)}m`, 4, 12);
}

// ---------- missions UI ----------
function renderMissions() {
  const el = $('missions');
  el.innerHTML = missions.map((m) =>
    `<div class="m${m.done ? ' done' : ''}"><span>${m.name}</span><b>${m.done ? '✓' : m.prog}</b></div>`
  ).join('');
}

// ---------- debrief ----------
function endRun(reason: string) {
  if (ended) return;
  ended = true;
  endReason = reason;
  endT = reason === 'WRECKED' ? 2 : 4;
}
function showDebrief() {
  document.exitPointerLock?.();
  const L = loadout as Loadout;
  const earned = Math.floor(data * (endReason === 'WRECKED' ? 0.5 : 1));
  save.bank += earned;
  storeSave(save);
  $('hud').classList.add('hidden');
  $('debrief').classList.remove('hidden');
  const win = endReason !== 'WRECKED';
  ($('db-title') as HTMLElement).textContent = win ? '⛅ STORM PASSED' : '💥 TRUCK WRECKED';
  ($('db-stats') as HTMLElement).innerHTML =
    `<div>Time in storm: <b>${Math.floor(t)}s</b></div>` +
    `<div>Peak wind: <b>${Math.floor(peakWind)} m/s</b></div>` +
    `<div>Closest approach: <b>${tornado.closest === Infinity ? '—' : Math.floor(tornado.closest) + ' m'}</b></div>` +
    `<div>Photos: <b>${photos}</b> · Encounters: <b>${encounters}</b> · Probes: <b>${probesScored}</b></div>` +
    `<div>Missions: <b>${missions.filter((m) => m.done).length}/5</b></div>` +
    `<div>Data earned: <b>${earned}</b>${win ? '' : ' (50% — wrecked)'}</div>` +
    `<div>Data bank: <b>${Math.floor(save.bank)}</b></div>` +
    `<div class="db-hint">Spend data on garage upgrades, then deploy again.</div>`;
  void L;
}
$('db-again').addEventListener('click', () => location.reload());

// ---------- deploy ----------
$('deploy').addEventListener('click', () => {
  const eq = new Set<string>();
  document.querySelectorAll('#pick-eq input:checked').forEach((b) =>
    eq.add((b as HTMLInputElement).value));
  loadout = {
    car: radio('car') as CarVariant,
    tor: radio('tor'),
    radioMode: radio('radio') as Loadout['radioMode'],
    food: radio('food'),
    pet: radio('pet'),
    maya: ($('crew-maya') as HTMLInputElement).checked,
    reyes: ($('crew-reyes') as HTMLInputElement).checked,
    eq,
  };
  $('setup').classList.add('hidden');
  buildWorld();
  $('hud').classList.remove('hidden');
  $('play').classList.remove('hidden');
  renderMissions();
  clock = new THREE.Clock();
  renderer.setAnimationLoop(loop);
});

// ============================== main loop ==============================
let clock = new THREE.Clock();
const WX_MSGS = [
  'TORNADO WARNING in effect for your area.',
  'Large hail and damaging winds reported nearby.',
  'Seek shelter — do NOT try to outrun the storm.',
  'Rotation tightening 3 miles southwest of you.',
  'Emergency management reports power flashes.',
];

function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (!started || ended && endT <= 0) {
    if (ended && endT <= 0) return;
  }
  if (!started) return;
  t += dt;
  const L = loadout as Loadout;
  const stats = CAR_STATS[L.car];

  // --- tornado + wind ---
  tornado.update(dt, t, 0, 0);
  const torDist = Math.hypot(tornado.pos.x, tornado.pos.z);
  tornado.windAt(0, 0, tmpV);
  const wind = tmpV.length();
  if (wind > peakWind) peakWind = wind;

  // --- world/weather/debris ---
  world.update(dt, t, tornado.pos.x, tornado.pos.z, tornado.radius, wind);
  camera.getWorldPosition(tmpV2);
  const rainBoost = ((weather as unknown as { baseBoost: number }).baseBoost ?? 0);
  weather.update(dt, scene, tmpV2, tmpV.x, tmpV.z, tornado.intensity, tornado.pos.x, tornado.pos.z, rainBoost);
  tornado.windAt(0, 0, tmpV);
  debris.update(dt, tornado.pos.x, tornado.pos.z, tornado.radius, tornado.intensity,
    (x, z, out) => tornado.windAt(x, z, out), 0, 0, (s) => damage(s * 7 * dmgMult() / stats.mass, true));

  // fog follows visibility events
  const fog = scene.fog as THREE.FogExp2;
  fog.density += (((weather.visDropping() ? 0.02 : fogBase)) - fog.density) * Math.min(1, dt * 2);

  // lightning thunder
  const fl = weather.flashLight.intensity;
  if (fl > 2 && lastFlash <= 2) {
    const delay = clamp(torDist / 340, 0.1, 3);
    audio.thunder(delay, clamp(1.2 - torDist / 400, 0.2, 1));
    if (torDist < 120) {
      shakeT = Math.max(shakeT, 0.5);
      toast('⚡ Close strike!', 1800);
    }
  }
  lastFlash = fl;

  // hail damage + ticks
  const hailImmune = L.eq.has('hail');
  const hailDmg = weather.hailLevel * (hailImmune ? 0 : 1) * (1 - upLvl('hailguard') * 0.2);
  if (hailDmg > 0 && hull > 0) {
    hull -= hailDmg * 1.6 * dmgMult() * dt;
    if (Math.random() < weather.hailLevel * dt * 8) audio.hailTick();
  }

  // core wind damage
  const R = tornado.radius;
  if (torDist < R + 10 && !tornado.dissipated) {
    const f = torDist < R ? 12 : 4;
    damage(f * (1 - upLvl('anchors') * 0.08) * dt / stats.mass, false);
  }

  // --- probe ---
  if (probe) {
    const pd = Math.hypot(tornado.pos.x - probe.x, tornado.pos.z - probe.z);
    probe.mesh.rotation.y += dt * 2;
    if (pd < 45) {
      const prox = clamp(1 - torDist / 300, 0, 1);
      const v = 150 * (1 + upLvl('probe') * 0.15) * riskMult(prox);
      data += v;
      probesScored++;
      const m = mission('probe');
      m.done = true;
      m.prog = '1/1';
      scene.remove(probe.mesh);
      probe = null;
      audio.beep(990);
      toast(`🛰 Probe scored a direct hit! +${Math.floor(v)}`, 3000);
      if (L.maya) setTimeout(() => toast('Maya: "That data is GOLD!"', 2400), 1500);
    }
  }

  // --- missions: peak wind tiers ---
  const tiers = [40, 60, 85];
  const pays = [60, 120, 200];
  for (let i = 0; i < 3; i++) {
    if (!peakPaid[i] && peakWind >= tiers[i]) {
      peakPaid[i] = true;
      data += pays[i];
      toast(`💨 Peak wind ${tiers[i]}+ m/s recorded! +${pays[i]}`, 2500);
    }
  }
  const pm = mission('peak');
  pm.prog = `${Math.floor(peakWind)} m/s`;
  if (peakWind >= 85) pm.done = true;

  // --- close encounter ---
  encounterCD = Math.max(0, encounterCD - dt);
  if (torDist < 28 && !tornado.dissipated && encounterCD <= 0 && hull > 0) {
    encounterCD = 12;
    encounters++;
    const prox = clamp(1 - torDist / 300, 0, 1);
    const v = (encounters === 1 ? 200 : 100) * riskMult(prox);
    data += v;
    shakeT = Math.max(shakeT, 1.2);
    audio.boom();
    const m = mission('encounter');
    if (encounters === 1) {
      m.done = true;
      m.prog = '1/1';
      toast(`🌪 CLOSE ENCOUNTER survived! +${Math.floor(v)}`, 3000);
      if (L.maya) setTimeout(() => toast('Maya: "WE\'RE INSIDE IT! STAY DOWN!"', 2600), 800);
    } else {
      toast(`🌪 Another pass through the core! +${Math.floor(v)}`, 2500);
    }
  }

  // --- passive data ---
  if (!tornado.dissipated && hull > 0) {
    const prox = clamp(1 - torDist / 300, 0, 1);
    data += (1 + prox * 7) * dataMult() * (0.7 + tornado.intensity * 0.6) * dt;
  }

  // --- maya callouts ---
  const maya = (id: string, msg: string) => {
    if (L.maya && !mayaFlags.has(id)) {
      mayaFlags.add(id);
      toast(`Maya: "${msg}"`, 2600);
    }
  };
  if (torDist < 150) maya('m150', 'I can see it! Hold her steady!');
  if (torDist < 80) maya('m80', 'It\'s coming right at us!');
  if (torDist < 40) maya('m40', 'BRACE! BRACE!');
  if (hull < hullMax * 0.35) maya('lowhull', 'She can\'t take much more of this!');

  // --- reyes auto-photos ---
  if (L.reyes && !tornado.dissipated) {
    reyesT -= dt;
    if (reyesT <= 0) {
      reyesT = 18;
      if (torDist < 280) {
        takePhoto(true);
        toast('📷 Reyes grabbed a shot for you.', 1600);
      }
    }
  }

  // --- WX band ---
  if (L.radioMode === 'wx') {
    wxT -= dt;
    if (wxT <= 0) {
      wxT = 45;
      toast(`📻 WX: ${WX_MSGS[Math.floor(Math.random() * WX_MSGS.length)]}`, 3600);
    }
  }

  // --- events ---
  if (!tornado.dissipated) {
    if (pendingEvent > 0) {
      pendingEvent -= dt;
      if (pendingEvent <= 0) {
        applyEvent((fireEvent as unknown as { queued: string }).queued ?? 'turn');
      }
    } else {
      eventT -= dt;
      if (eventT <= 0) fireEvent();
    }
  }
  glitchT = Math.max(0, glitchT - dt);

  // --- dissipate → endure mission + end ---
  if (tornado.dissipated && !mission('endure').done) {
    const m = mission('endure');
    m.done = true;
    m.prog = '✓';
    data += 300;
    if (probe) { // consolation for lost probe
      data += 25;
      scene.remove(probe.mesh);
      probe = null;
    }
    toast('⛅ It\'s dissipating — you endured! +300', 3200);
    endRun('PASSED');
  }

  // --- audio ---
  photoCD = Math.max(0, photoCD - dt);
  audio.update(dt, {
    rain: weather.rainIntensity,
    wind: clamp(wind / 60, 0, 1.5),
    roar: tornado.dissipated ? 0 : clamp(1.3 - torDist / 260, 0, 1.3),
    rpm: 0,
    engineOn: false,
  });
  if (L.pet === 'cat' && Math.random() < dt * 0.02) audio.meow();

  // --- car + camera ---
  car.update(dt, t, 0, 0, wind);
  car.setWet(clamp(weather.rainIntensity * 0.7, 0.1, 0.8));
  car.setCrack(1 - hull / hullMax);
  shakeT = Math.max(0, shakeT - dt);
  const shakeAmp = (wind * 0.0012 + shakeT * 0.25) * (1 - upLvl('anchors') * 0.1) / stats.mass;
  camera.position.set(
    -0.4 + (Math.random() - 0.5) * shakeAmp,
    1.32 + (Math.random() - 0.5) * shakeAmp,
    0.15
  );
  camera.rotation.set(pitch, yaw, (Math.random() - 0.5) * shakeAmp * 0.4);

  // trail sampling
  trailT -= dt;
  if (trailT <= 0 && !tornado.dissipated) {
    trailT = 0.4;
    trail.push({ x: tornado.pos.x, z: tornado.pos.z });
    if (trail.length > 120) trail.shift();
  }
  // blobs drift
  for (const b of blobs) {
    b.x += tmpV.x * dt * 0.4 + dt * 3;
    b.z += tmpV.z * dt * 0.4;
    if (b.x > 260) b.x = -260;
    if (b.x < -260) b.x = 260;
    if (b.z > 260) b.z = -260;
    if (b.z < -260) b.z = 260;
  }

  // --- HUD ---
  drawRadar(torDist);
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.12;
    const prox = clamp(1 - torDist / 300, 0, 1);
    $('d-wind').textContent = `${wind.toFixed(0)} m/s`;
    $('d-pres').textContent = `${(1010 - prox * 25 - tornado.intensity * 10).toFixed(0)} hPa`;
    $('d-tor').textContent = tornado.dissipated ? 'GONE' : `${Math.floor(torDist)}m EF${tornado.ef}`;
    $('d-risk').textContent = `${riskLabel(prox)} ×${riskMult(prox).toFixed(1)}`;
    $('d-data').textContent = String(Math.floor(data));
    ($('dmgfill') as HTMLElement).style.width = `${clamp(hull / hullMax * 100, 0, 100)}%`;
    if (torDist < 120 && !tornado.dissipated) warn('🌪 TORNADO WARNING — TAKE COVER IN VEHICLE');
    else if (weather.hailLevel > 0.4) warn('🧊 LARGE HAIL');
    else if (tornado.dissipated) warn('⛅ TORNADO DISSIPATED');
    else $('warn').classList.add('hidden');
  }
  missionT -= dt;
  if (missionT <= 0) {
    missionT = 0.25;
    renderMissions();
  }
  dashT -= dt;
  if (dashT <= 0) {
    dashT = 0.5;
    car.setScreen([
      `WIND ${wind.toFixed(0)}m/s`,
      `TOR ${tornado.dissipated ? 'GONE' : Math.floor(torDist) + 'm'}`,
      `HULL ${Math.floor(hull)}`,
      `DATA ${Math.floor(data)}`,
    ]);
  }

  // --- end of run ---
  if (hull <= 0 && !ended) {
    hull = 0;
    audio.boom();
    toast('💥 The truck is wrecked!', 2500);
    endRun('WRECKED');
  }
  if (ended) {
    endT -= dt;
    if (endT <= 0) {
      showDebrief();
      return;
    }
  }

  renderer.render(scene, camera);
}

function damage(amount: number, isDebris: boolean) {
  if (ended || hull <= 0) return;
  const L = loadout as Loadout;
  hull -= amount;
  if (isDebris && amount > 1.5) {
    shakeT = Math.max(shakeT, 0.4);
    audio.thump(clamp(amount / 8, 0.2, 1));
    if (L.pet === 'cat' && Math.random() < 0.3) audio.meow();
  }
}

(window as unknown as { __bootOK: boolean }).__bootOK = true;
