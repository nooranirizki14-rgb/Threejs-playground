import * as THREE from 'three';
import { ResearchCar } from './car';
import { Tornado } from './tornado';
import { Weather } from './weather';
import { Debris } from './debris';
import { World } from './world';
import { StormAudio } from './audio';

// TORNADO INTERCEPT — drive the research car, chase the tornado,
// collect data, survive. Wind + drag + lift + torque act on the car.

const container = document.getElementById('scene') as HTMLElement;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  const el = document.getElementById('err') as HTMLElement;
  el.classList.remove('hidden');
  el.textContent = '🚫 WebGL unavailable in this browser — try Chrome or Edge.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11150f);
scene.fog = new THREE.Fog(0x11150f, 30, 220);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0x5a6a7a, 0x1a1c14, 0.9));
const sun = new THREE.DirectionalLight(0x8a94a8, 0.55);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 200;
scene.add(sun, sun.target);

const car = new ResearchCar(scene);
const tornado = new Tornado(scene);
const weather = new Weather(scene);
const debris = new Debris(scene);
const world = new World(scene);
const audio = new StormAudio();
weather.onThunder = (d, g) => audio.thunder(d, g);
weather.onFlash = () => tornado.lightningFlash();
car.onWiperPass = () => audio.wiperSwish();

// ---------- player / car state ----------
const SEAT = new THREE.Vector3(-0.4, 1.18, 0.35);
const pos = new THREE.Vector3(0, 0, -30); // start on the road, tornado ahead
const vel = new THREE.Vector3();
let heading = 0;
let steer = 0;
let airY = 0;
let vy = 0;
let lookYaw = 0;
let lookPitch = -0.02;
let damage = 0;
let data = 0;
let wrecked = false;
let lightsOn = true;
let shakeImp = 0;
let lastAlarm = 0;
let hitCooldown = 0;
const keys: Record<string, boolean> = {};
const windVec = new THREE.Vector3();
const camWorld = new THREE.Vector3();
const prevVel = new THREE.Vector3();

camera.position.copy(SEAT);
car.group.add(camera);

// ---------- HUD ----------
const el = (id: string) => document.getElementById(id) as HTMLElement;
const hud = {
  speed: el('d-speed'), wind: el('d-wind'), pres: el('d-pres'),
  temp: el('d-temp'), tor: el('d-tor'), data: el('d-data'),
  dmg: el('dmgfill'), warn: el('warn'), toast: el('toast'),
};
const radar = document.getElementById('radar') as HTMLCanvasElement;
const rctx = radar.getContext('2d') as CanvasRenderingContext2D;
let sweep = 0;
let toastTimer = 0;
let hudTimer = 0;
function toast(text: string) {
  hud.toast.textContent = text;
  hud.toast.classList.remove('hidden');
  toastTimer = 2.2;
}

function drawRadar() {
  const W = 150, C = 75, R = 70, RANGE = 400;
  sweep += 0.03;
  rctx.fillStyle = 'rgba(4,12,6,0.9)';
  rctx.fillRect(0, 0, W, W);
  rctx.strokeStyle = 'rgba(74,224,138,0.35)';
  rctx.lineWidth = 1;
  for (const rr of [R / 3, (R * 2) / 3, R]) {
    rctx.beginPath();
    rctx.arc(C, C, rr, 0, 6.29);
    rctx.stroke();
  }
  // sweep
  rctx.strokeStyle = 'rgba(74,224,138,0.8)';
  rctx.beginPath();
  rctx.moveTo(C, C);
  rctx.lineTo(C + Math.cos(sweep) * R, C + Math.sin(sweep) * R);
  rctx.stroke();
  // tornado blip, heading-up
  const dx = tornado.pos.x - pos.x;
  const dz = tornado.pos.z - pos.z;
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  const rx = Math.cos(heading), rz = -Math.sin(heading);
  const fwd = dx * fx + dz * fz;
  const rgt = dx * rx + dz * rz;
  let px = C + (rgt / RANGE) * R;
  let py = C - (fwd / RANGE) * R;
  const dc = Math.hypot(px - C, py - C);
  if (dc > R - 4) {
    px = C + ((px - C) / dc) * (R - 4);
    py = C + ((py - C) / dc) * (R - 4);
  }
  const tr = 3 + tornado.intensity * 5;
  const grad = rctx.createRadialGradient(px, py, 0, px, py, tr * 2.5);
  grad.addColorStop(0, 'rgba(255,60,60,1)');
  grad.addColorStop(1, 'rgba(255,60,60,0)');
  rctx.fillStyle = grad;
  rctx.beginPath();
  rctx.arc(px, py, tr * 2.5, 0, 6.29);
  rctx.fill();
  // own car triangle
  rctx.fillStyle = '#fff';
  rctx.beginPath();
  rctx.moveTo(C, C - 6);
  rctx.lineTo(C - 4, C + 5);
  rctx.lineTo(C + 4, C + 5);
  rctx.closePath();
  rctx.fill();
}

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE') toast('Stay inside! 🌪');
  if (e.code === 'KeyV') {
    car.wipersOn = !car.wipersOn;
    toast(car.wipersOn ? 'wipers on' : 'wipers off');
  }
  if (e.code === 'KeyL') {
    lightsOn = !lightsOn;
    car.setLights(lightsOn);
    toast(lightsOn ? 'headlights on 💡' : 'headlights off');
  }
  if (e.code === 'KeyM') {
    const m = audio.toggleMute();
    toast(m ? 'muted 🔇' : 'sound on 🔊');
  }
  if (e.code === 'KeyR' && wrecked) location.reload();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

const overlay = el('play');
const playH = overlay.querySelector('h2') as HTMLElement;
const playP = overlay.querySelector('p') as HTMLElement;
let locked = false;
overlay.addEventListener('click', () => {
  if (wrecked) return;
  audio.unlock();
  try {
    const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
});
overlay.addEventListener('touchstart', () => {
  audio.unlock();
  if (!wrecked) overlay.classList.add('hidden');
}, { passive: true });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!wrecked) overlay.classList.toggle('hidden', locked);
  if (locked) el('hud').classList.remove('hidden');
});
document.addEventListener('pointerlockerror', () => {
  playP.textContent = 'pointer lock blocked — try Chrome on desktop';
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  lookYaw -= (e as MouseEvent).movementX * 0.0021;
  lookPitch -= (e as MouseEvent).movementY * 0.0021;
  lookYaw = Math.max(-2.8, Math.min(2.8, lookYaw));
  lookPitch = Math.max(-1.1, Math.min(0.6, lookPitch));
});
let lastT: Touch | null = null;
canvas.addEventListener('touchstart', (e) => {
  lastT = e.touches[0];
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (lastT) {
    lookYaw = Math.max(-2.8, Math.min(2.8, lookYaw - (t.clientX - lastT.clientX) * 0.005));
    lookPitch = Math.max(-1.1, Math.min(0.6, lookPitch - (t.clientY - lastT.clientY) * 0.005));
  }
  lastT = t;
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- main loop ----------
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const relWind = new THREE.Vector3();
let last = performance.now();
let started = false;

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;
  if (!started) {
    started = true;
    toast('Tornado on the ground — intercept! 🌪');
  }

  const distTor = Math.hypot(tornado.pos.x - pos.x, tornado.pos.z - pos.z);
  const windSpeed = tornado.windAt(pos.x, pos.z, windVec);

  if (!wrecked) {
    // --- drive input ---
    const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const steerTgt = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    steer += (steerTgt * 0.55 - steer) * Math.min(1, dt * 7);
    const onRoad = world.onRoad(pos.x, pos.z);
    fwd.set(-Math.sin(heading), 0, -Math.cos(heading));
    right.set(Math.cos(heading), 0, -Math.sin(heading));

    // --- wind force: F ~ v^2 (quadratic drag on the body) ---
    relWind.copy(windVec).sub(vel);
    const rw = relWind.length();
    vel.addScaledVector(relWind, rw * 0.0038 * dt * 10 * 0.1 + rw * rw * 0.000038 * dt * 10);
    void rw;

    // --- split velocity: forward + lateral, grip kills slide ---
    let speed = vel.dot(fwd);
    const latX = vel.x - fwd.x * speed;
    const latZ = vel.z - fwd.z * speed;
    const liftF = Math.max(0, Math.min(1, (windSpeed - 48) / 40));
    const gripBase = onRoad ? 5 : 3.2;
    const grip = gripBase * (1 - liftF * 0.85) * (1 - damage * 0.004) * (airY > 0.05 ? 0.25 : 1);
    const latDecay = Math.exp(-Math.max(0.2, grip) * dt);
    const nLatX = latX * latDecay;
    const nLatZ = latZ * latDecay;
    const accel = 9 * (1 - damage * 0.005);
    const drag = onRoad ? 0.35 : 1.4;
    if (throttle > 0) speed += accel * dt;
    else if (throttle < 0) speed -= (speed > 1 ? 14 : 6) * dt;
    speed -= speed * drag * dt;
    speed = Math.max(-8, Math.min(38, speed));
    vel.set(fwd.x * speed + nLatX, 0, fwd.z * speed + nLatZ);

    // --- steering + wind yaw torque ---
    const turn = steer * Math.max(-1, Math.min(1, speed / 9)) * 1.7 * Math.min(1, grip / 4);
    const windRight = windVec.dot(right);
    const torque = windRight * 0.0032 * (Math.abs(speed) < 3 ? 1.6 : 0.8)
      + Math.sin(t * 7.3) * windSpeed * 0.00045;
    heading += (turn + torque) * dt;

    // --- lift / airborne ---
    if (liftF > 0.12) vy += (liftF * 30 - 22) * dt;
    else vy -= 22 * dt;
    airY += vy * dt;
    if (airY <= 0) { airY = 0; vy = Math.min(0, vy) * -0.1; if (Math.abs(vy) < 0.5) vy = 0; }

    // --- extreme core: chaos, but survivable in bursts ---
    if (distTor < tornado.radius * 0.85 && tornado.intensity > 0.7) {
      const sa = Math.atan2(pos.z - tornado.pos.z, pos.x - tornado.pos.x) + Math.PI / 2;
      vel.x += Math.cos(sa) * 26 * dt;
      vel.z += Math.sin(sa) * 26 * dt;
      heading += 2.2 * dt;
      vy += 9 * dt;
      damage += 11 * dt;
      shakeImp = Math.min(1.2, shakeImp + 3 * dt);
    }

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    // soft world edge
    if (Math.abs(pos.x) > 270 || Math.abs(pos.z) > 270) {
      pos.x = Math.max(-270, Math.min(270, pos.x));
      pos.z = Math.max(-270, Math.min(270, pos.z));
      vel.multiplyScalar(0.9);
      toast('Turn back — open fields');
    }

    // --- body roll / pitch from real acceleration ---
    const ax = (vel.x - prevVel.x) / Math.max(dt, 0.001);
    const az = (vel.z - prevVel.z) / Math.max(dt, 0.001);
    prevVel.copy(vel);
    const latA = ax * right.x + az * right.z;
    const fwdA = ax * fwd.x + az * fwd.z;
    const rock = Math.sin(t * 6) * windSpeed * 0.0007 + Math.sin(t * 11.7) * windSpeed * 0.0004;
    const targetRoll = Math.max(-0.17, Math.min(0.17, -latA * 0.011 + rock));
    const targetPitch = Math.max(-0.1, Math.min(0.1, fwdA * 0.009 + Math.sin(t * 7.3) * windSpeed * 0.0004));
    car.group.rotation.z += (targetRoll - car.group.rotation.z) * Math.min(1, dt * 5);
    car.group.rotation.x += (targetPitch - car.group.rotation.x) * Math.min(1, dt * 5);

    // --- data collection ---
    if (distTor < 170) {
      data += dt * (2 + ((170 - distTor) / 170) * 18) * (damage < 70 ? 1 : 0.35);
    }

    // --- damage feedback ---
    hitCooldown = Math.max(0, hitCooldown - dt);
    if (damage >= 100) {
      wrecked = true;
      playH.textContent = '🔥 VEHICLE DESTROYED';
      playP.textContent = `data recovered: ${Math.floor(data)} — press R to deploy a new vehicle`;
      overlay.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    }
  } else {
    vel.multiplyScalar(Math.max(0, 1 - dt * 2));
    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
  }

  car.group.position.set(pos.x, airY, pos.z);
  car.group.rotation.y = heading;

  // --- layered, physical camera shake (not random jitter) ---
  shakeImp = Math.max(0, shakeImp - dt * 2.2);
  const spd = vel.length();
  const eng = Math.sin(t * 31) * 0.0022 * (wrecked ? 0.2 : 1);
  const roadR = spd > 2 ? Math.sin(t * 23) * 0.0022 * Math.min(1, spd / 20) : 0;
  const buffet = (windSpeed / 110) * (Math.sin(t * 13) + Math.sin(t * 29) * 0.5) * 0.012;
  const imp = shakeImp * Math.sin(t * 47) * 0.02;
  camera.position.set(
    SEAT.x + Math.sin(t * 27 + 1) * 0.002 + imp * 0.5,
    SEAT.y + eng + roadR + buffet + imp,
    SEAT.z
  );
  camera.rotation.set(
    lookPitch + buffet * 0.4 + eng * 0.5,
    lookYaw,
    Math.sin(t * 19) * (windSpeed / 110) * 0.008
  );

  // --- systems ---
  tornado.update(dt, t, pos.x, pos.z);
  camera.getWorldPosition(camWorld);
  weather.update(dt, scene, camWorld, windVec.x, windVec.z, tornado.intensity, tornado.pos.x, tornado.pos.z);
  debris.update(dt, tornado.pos.x, tornado.pos.z, tornado.radius, tornado.intensity,
    (x, z, out) => tornado.windAt(x, z, out), pos.x, pos.z, (s) => {
      if (wrecked || hitCooldown > 0) return;
      hitCooldown = 0.25;
      damage = Math.min(100, damage + 2 + s * 5);
      audio.thump(0.5 + s * 0.4);
      if (Math.random() < 0.6) audio.crack();
      car.setCrack(damage / 100);
      shakeImp = Math.min(1.2, shakeImp + 0.4 + s * 0.4);
      toast('⚠ DEBRIS IMPACT');
    });
  world.update(dt, t, tornado.pos.x, tornado.pos.z, tornado.radius, windSpeed);
  const kmh = Math.abs(vel.dot(fwd)) * 3.6;
  car.update(dt, t, steer, wrecked ? 0 : kmh, windSpeed);
  car.setWet(0.25 + weather.rainIntensity * 0.55);
  const prox = tornado.intensity * Math.exp(-distTor / 150) + (distTor < tornado.radius ? 0.4 : 0);
  audio.update(dt, {
    rain: weather.rainIntensity,
    wind: windSpeed / 70,
    roar: Math.min(1.2, prox * 1.4),
    rpm: Math.min(1, kmh / 110),
    engineOn: !wrecked,
  });
  // random interior rattles in high wind
  if (!wrecked && windSpeed > 42 && Math.random() < dt * 2) audio.thump(0.06 + Math.random() * 0.08);

  // sun shadow frustum follows the car
  sun.position.set(pos.x + 40, 60, pos.z + 20);
  sun.target.position.set(pos.x, 0, pos.z);
  sun.target.updateMatrixWorld();
  // visibility closes in as the storm strengthens
  const fog = scene.fog as THREE.Fog;
  fog.near = 30 - tornado.intensity * 18;
  fog.far = 220 - tornado.intensity * 130;

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hud.toast.classList.add('hidden');
  }

  // --- HUD @ ~8 Hz ---
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.12;
    const noisy = damage > 40;
    const nz = (v: number, amt: number) => v + (noisy ? (Math.random() - 0.5) * amt : 0);
    const pres = 1012 - tornado.intensity * 58 * Math.exp(-distTor / 130);
    const temp = 19 - tornado.intensity * 9 * Math.exp(-distTor / 150);
    hud.speed.textContent = `${Math.round(kmh)} km/h`;
    hud.wind.textContent = `${Math.round(nz(windSpeed, damage * 0.4))} m/s`;
    hud.pres.textContent = `${Math.round(nz(pres, damage * 0.15))} hPa`;
    hud.temp.textContent = `${temp.toFixed(1)}°C`;
    hud.tor.textContent = `${Math.round(distTor)} m ${tornado.efLabel}`;
    hud.data.textContent = String(Math.floor(data));
    hud.dmg.style.width = `${100 - damage}%`;
    hud.dmg.style.background = damage > 70 ? '#e03a3a' : damage > 35 ? '#e0a53a' : '';
    car.setScreen([
      `WIND ${Math.round(windSpeed)} m/s`,
      `TOR ${Math.round(distTor)}m ${tornado.efLabel}`,
      `PRES ${Math.round(pres)}`,
      `DATA ${Math.floor(data)}`,
    ]);
    // warnings
    let w = '';
    if (!wrecked && distTor < tornado.radius * 2.2) w = '🌪 TORNADO DANGER';
    else if (!wrecked && damage > 70) w = '🔥 CRITICAL DAMAGE';
    else if (!wrecked && tornado.intensity > 0.82) w = '🟥 VIOLENT TORNADO';
    if (w) {
      hud.warn.textContent = w;
      hud.warn.classList.remove('hidden');
      if (t - lastAlarm > 1.1) {
        lastAlarm = t;
        audio.beep(w.includes('DANGER') ? 660 : 880);
      }
    } else {
      hud.warn.classList.add('hidden');
    }
  }
  drawRadar();

  renderer.render(scene, camera);
  (window as unknown as { __bootOK: boolean }).__bootOK = true;
}
requestAnimationFrame(frame);
