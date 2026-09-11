import * as THREE from 'three';
import { World } from './world.js';
import { Sky } from './sky.js';
import { Ground } from './ground.js';
import { Road, LANES_ME } from './road.js';
import { Car } from './car.js';
import { CarPhysics } from './physics.js';
import { Traffic } from './traffic.js';
import { Stations } from './stations.js';
import { Walker } from './player.js';
import { Needs } from './needs.js';
import { Engine } from './damage.js';
import { Weather } from './weather.js';
import { RainStreaks, SplashRings } from './rain.js';
import { Controls } from './controls.js';
import { GameAudio } from './audio.js';
import { Radio } from './radio.js';
import { Autopilot } from './autopilot.js';
import { HUD } from './hud.js';
import { Settings } from './settings.js';
import { UpgradeSet } from './upgrades.js';
import { Hitchhikers } from './hitchhiker.js';
import { Minimap } from './minimap.js';
import { PhotoMode } from './photo.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { clamp, fmtKm, fmtRp, fmtClock } from './utils.js';

const $ = (id) => document.getElementById(id);
const TOW_COST = 250000;
const WASH_COST = 8000;
const VLOG_PER_KM = 8000;

const SHOP_MART = [
  { key: 'can', icon: '🛢️', name: 'Jerry can', desc: '+15L fuel anywhere · key 1', price: 100000 },
  { key: 'kit', icon: '🔧', name: 'Repair kit', desc: 'patch engine at hood · key 2', price: 150000 },
  { key: 'snack', icon: '🍩', name: 'Snack', desc: '+45 food · key 3', price: 15000 },
  { key: 'coffee', icon: '☕', name: 'Coffee', desc: '+26 energy · key 4', price: 20000 },
];
const SHOP_DINER = [
  { key: 'meal', icon: '🍜', name: 'Mie + teh', desc: '+65 food, +10 energy · eat now', price: 45000 },
  { key: 'coffee', icon: '☕', name: 'Kopi tubruk', desc: '+26 energy · key 4', price: 18000 },
  { key: 'snack', icon: '🍩', name: 'Pisang goreng', desc: '+45 food · key 3', price: 15000 },
];
const INV_MAX = { kit: 3, can: 2, snack: 5, coffee: 4 };

export class Game {
  constructor() {
    this.world = new World($('scene-container'));
    this.scene = this.world.scene;
    this.camera = this.world.camera;
    this.sky = new Sky(this.scene);
    this.ground = new Ground(this.scene);
    this.road = new Road(this.scene);
    this.car = new Car(this.scene);
    this.phy = new CarPhysics();
    this.traffic = new Traffic(this.scene);
    this.stations = new Stations(this.scene);
    this.walker = new Walker();
    this.needs = new Needs();
    this.engine = new Engine();
    this.weather = new Weather();
    const lowQ = ('ontouchstart' in window) || Math.min(innerWidth, innerHeight) < 700;
    this.rain = new RainStreaks(this.scene, { count: lowQ ? 1300 : 2200 });
    this.rings = new SplashRings(this.scene, { count: lowQ ? 180 : 300 });
    this.controls = new Controls(this.world.renderer.domElement);
    this.audio = new GameAudio();
    this.radio = new Radio();
    this.auto = new Autopilot();
    this.hud = new HUD();
    this.settings = new Settings();
    this.upgrades = new UpgradeSet();
    this.hitch = new Hitchhikers(this.scene);
    this.minimap = new Minimap($('minimap'));
    this.photo = new PhotoMode();

    // settings <-> live systems sync
    this.settings.volume = this.audio.volume;
    this.controls.sensitivity = this.settings.sensitivity;

    this.road.signProvider = (z) => this.stations.signInfo(z);
    this.weather.onThunder = (i) => this.audio.thunder(i);

    // journey state
    this.state = 'intro'; // intro | drive | foot
    this.overlay = null;  // shop | rest | upgrades | settings | help | null
    this.cash = 500000;
    this.fuel = 12;
    this.odoM = 0;
    this.clockMin = 0;
    this.inv = { kit: 1, can: 0, snack: 2, coffee: 1 };
    this.dirt = 0.1;
    this.time = 0;

    // action state
    this.holdId = null;
    this.holdT = 0;
    this.fuelSession = 0;
    this.washSession = null;
    this.washCooldown = 0;
    this.pushing = false;
    this.lookBack = false;
    this.shake = 0;
    this.crashCd = 0;
    this.scrapeT = 0;
    this.nodT = 20;
    this.nodding = 0;
    this.growlT = 30;
    this.flagFuel = false;
    this.flagBroke = false;
    this.flagStarve = false;
    this.lastBlink = false;
    this.lockToastCd = 0;
    this.hudT = 0;
    this.gpsT = 0;
    this.gpsFuel = '⛽ —';
    this.gpsRest = '🛏️ —';
    this.lastRadio = '';
    this.lastPrompt = '@@none@@';
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.fpsChecked = false;
    this.degraded = false;

    this.car.lightsOn = true;
    this.car.wiperMode = 1;
    this.phy.reset(-1.75, 20);
    this.syncCarTransform();

    this.bindUI();
    this.controls.onLockChange = (locked) => {
      if (!locked && this.state !== 'intro' && !this.controls.isTouch && !this.overlay && this.lockToastCd <= 0) {
        this.hud.toast('👆 Click to look around');
        this.lockToastCd = 6;
      }
    };
    this.controls.onAux = (name) => {
      if (name === 'light') this.toggleLights();
      if (name === 'radio') this.cycleRadio();
    };
    this.hud.setMuteIcon(this.audio.muted);
    if (hasSave()) $('btn-continue').classList.remove('hidden');
  }

  tankCap() {
    return this.upgrades.tankCap();
  }

  // ================= UI =================
  bindUI() {
    $('btn-new').addEventListener('click', () => this.start(true));
    $('btn-continue').addEventListener('click', () => this.start(false));
    $('btn-shop-close').addEventListener('click', () => this.closeOverlay());
    $('btn-rest-close').addEventListener('click', () => this.closeOverlay());
    $('btn-upg-close').addEventListener('click', () => this.closeOverlay());
    $('btn-settings-close').addEventListener('click', () => this.closeOverlay());
    $('btn-help-close').addEventListener('click', () => this.closeOverlay());
    $('btn-mute').addEventListener('click', () => this.toggleMute());
    $('btn-help').addEventListener('click', () => {
      if (this.overlay === 'help') this.closeOverlay();
      else if (!this.overlay && this.state !== 'intro') {
        this.overlay = 'help';
        this.hud.showHelp(true);
      }
    });
    $('btn-cam').addEventListener('click', () => {
      this.lookBack = !this.lookBack;
    });
    $('btn-settings').addEventListener('click', () => this.openSettings());
    $('btn-photo').addEventListener('click', () => this.togglePhoto());
    this.world.renderer.domElement.addEventListener('click', () => {
      if (this.state !== 'intro') this.controls.requestLock();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.state === 'intro') this.start(true);
    });
  }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    this.hud.setMuteIcon(this.audio.muted);
  }

  toggleLights() {
    this.car.lightsOn = !this.car.lightsOn;
    this.audio.click();
  }

  cycleRadio() {
    this.audio.ensure();
    this.audio.staticBurst(0.22);
    const cur = this.radio.next();
    if (cur.name === 'OFF') {
      this.car.setRadio('OFF', 'radio silent…');
      this.hud.setRadio(null);
      this.lastRadio = '';
    } else {
      this.car.setRadio(cur.freq + ' FM', cur.name);
      this.hud.setRadio(cur.freq + ' · ' + cur.name);
      this.lastRadio = cur.freq;
    }
  }

  start(fresh) {
    if (this.state !== 'intro') return;
    if (document.activeElement) document.activeElement.blur();
    this.audio.ensure();
    this.audio.click();
    this.radio.attach(this.audio.ctx, this.audio.master);
    if (!fresh) {
      const d = loadGame();
      if (d) this.applySave(d);
    }
    this.applyQuality();
    this.state = 'drive';
    this.controls.mode = 'drive';
    $('intro').classList.add('hidden');
    this.hud.show();
    if (this.controls.isTouch) this.hud.setTouchMode('drive');
    this.controls.requestLock();
    this.hud.toast('🌙 Drive! SPBU is on your left — watch the fuel ⛽', 3600);
  }

  applySave(d) {
    this.cash = d.cash ?? 500000;
    this.fuel = d.fuel ?? 12;
    this.engine.load(d.engine);
    this.needs.load(d.needs);
    this.upgrades.load(d.upgrades);
    this.odoM = d.odo ?? 0;
    this.clockMin = d.clock ?? 0;
    this.inv = { kit: 1, can: 0, snack: 2, coffee: 1, ...(d.inv || {}) };
    this.dirt = d.dirt ?? 0.1;
    this.phy.reset(d.px ?? -1.75, d.pz ?? 20);
    this.stations.layoutFor(this.phy.z);
    this.syncCarTransform();
  }

  collectSave() {
    return {
      cash: this.cash,
      fuel: this.fuel,
      engine: this.engine.serialize(),
      needs: this.needs.serialize(),
      upgrades: this.upgrades.serialize(),
      odo: this.odoM,
      clock: this.clockMin,
      inv: { ...this.inv },
      dirt: this.dirt,
      px: this.phy.x,
      pz: this.phy.z,
    };
  }

  // ================= loop =================
  run() {
    window.__mdBooted = true;
    this.clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.world.render();
      if (this.photo.maybeCapture(this.world.renderer)) {
        this.hud.toast('📷 Saved to downloads!', 2400);
        this.audio.click();
      }
    };
    loop();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // weather + lightning
    const flash = this.weather.update(dt);
    this.world.hemi.intensity = 0.5 + flash * 2.4;
    this.world.moon.intensity = 0.35 + flash * 1.6;
    this.world.scene.fog.color.copy(this.world.baseFog);
    this.world.scene.fog.color.r += flash * 0.16;
    this.world.scene.fog.color.g += flash * 0.17;
    this.world.scene.fog.color.b += flash * 0.19;
    this.world.scene.background.copy(this.world.scene.fog.color);
    this.world.scene.fog.density = this.weather.fogDensity;
    this.world.grade.uniforms.uTime.value = t;
    this.world.grade.uniforms.uFlash.value = flash * 0.45;
    this.sky.setFlash(flash);
    this.rain.setIntensity(this.weather.intensity);
    this.rings.setIntensity(this.weather.intensity);
    // gusts slant the rain
    this.rain.uniforms.uSlant.value = 0.16 + this.weather.gust * 0.24 * this.weather.gustDir;
    this.rain.uniforms.uWindX.value = 1.4 + this.weather.gust * 7 * this.weather.gustDir;

    // focus point (camera anchor for world recycling)
    const focusZ = this.state === 'foot' ? this.walker.pos.z : this.phy.z;
    const focusX = this.state === 'foot' ? this.walker.pos.x : this.phy.x;

    // stations + road gaps
    const washSt = this.washSession ? this.washSession.st : null;
    const gaps = this.stations.update(dt, t, focusZ, washSt);
    this.road.setGaps(gaps);
    this.road.update(dt, focusZ);
    this.ground.update(t, focusX, focusZ);
    this.sky.update(dt, this.camera);
    this.hitch.update(dt, focusZ, this.stations);

    // traffic always flows
    const traff = this.traffic.update(dt, focusZ, {
      x: this.phy.x, z: this.phy.z, speed: this.phy.speed,
    });
    this.trafficList = traff.list;
    if (traff.honk) this.audio.trafficHorn();

    if (this.state === 'intro') {
      this.updateIntro(dt, t);
    } else if (!this.overlay) {
      if (this.state === 'drive') this.updateDrive(dt, t);
      else this.updateFoot(dt, t);
    } else {
      // E / Escape closes menus
      if (this.controls.justPressed.has('KeyE') || this.controls.justPressed.has('Escape')) {
        this.closeOverlay();
      }
      // overlays: coast the car, freeze the walker
      if (this.state === 'drive') {
        this.phy.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: false }, this.carEnv());
        this.syncCarTransform();
      }
      this.updateCamera(dt);
    }

    // rain follows camera
    this.rain.update(t, this.camera.position);
    this.rings.update(t, this.camera.position);

    // car visuals always animate (wipers, drops, smoke)
    this.syncCarVisuals();
    this.car.update(dt, t);

    // audio beds
    const kmh = Math.abs(this.phy.speed) * 3.6;
    this.audio.updateBeds(kmh, this.weather.intensity, Math.abs(this.phy.slide) > 1.6);
    this.audio.updateEngine(this.rpm01 || 0, this.throttleVis || 0, this.engineRunning());

    // HUD @10Hz
    this.hudT -= dt;
    if (this.hudT <= 0 && this.state !== 'intro') {
      this.hudT = 0.1;
      this.refreshHUD();
    }
    this.lockToastCd -= dt;
    this.fpsWatch(dt);
    this.controls.lateUpdate();
  }

  updateIntro(dt, t) {
    const cx = this.phy.x + Math.sin(t * 0.14) * 7.5;
    const cz = this.phy.z + Math.cos(t * 0.14) * 7.5;
    this.camera.position.set(cx, 2.6 + Math.sin(t * 0.3) * 0.4, cz);
    this.camera.lookAt(this.phy.x, 1, this.phy.z);
    this.car.rainI = this.weather.intensity;
  }

  // ================= driving =================
  carEnv() {
    const surf = this.surfaceAt(this.phy.x, this.phy.z);
    return {
      engineOn: this.engineRunning(),
      health01: this.engine.health01,
      surface: surf,
      power: this.upgrades.power(),
      topBoost: this.upgrades.topBoost(),
      gripBoost: this.upgrades.gripBoost(),
    };
  }

  engineRunning() {
    return this.state === 'drive' && this.fuel > 0 && !this.engine.broken;
  }

  surfaceAt(x, z) {
    if (Math.abs(x) < 8.6) return 'road';
    if (this.road.gapSideAt(z) === -1 && x < -8.6 && x > -26) return 'lot';
    return 'dirt';
  }

  updateDrive(dt, t) {
    const k = this.controls.keys;
    const jp = this.controls.justPressed;
    const td = this.controls.drive;

    // toggles
    if (jp.has('KeyL')) this.toggleLights();
    if (jp.has('KeyH')) {
      this.car.highBeam = !this.car.highBeam;
      this.audio.click();
    }
    if (jp.has('KeyK')) this.audio.horn();
    if (jp.has('KeyV')) {
      this.car.wiperMode = (this.car.wiperMode + 1) % 3;
      this.audio.click();
      this.hud.toast(['Wipers OFF', 'Wipers SLOW 💧', 'Wipers FAST 🌧️'][this.car.wiperMode], 1400);
    }
    if (jp.has('KeyR')) this.cycleRadio();
    if (jp.has('KeyM')) this.toggleMute();
    if (jp.has('KeyG')) this.setAuto(!this.auto.on);
    if (jp.has('KeyT')) this.doTow();
    if (jp.has('KeyP')) this.togglePhoto();
    if (jp.has('KeyZ')) {
      this.car.signal = this.car.signal === -1 ? 0 : -1;
      this.audio.blinker();
    }
    if (jp.has('KeyX')) {
      this.car.signal = this.car.signal === 1 ? 0 : 1;
      this.audio.blinker();
    }
    if (jp.has('Digit1')) this.useItem(1);
    if (jp.has('Digit2')) this.useItem(2);
    if (jp.has('Digit3')) this.useItem(3);
    if (jp.has('Digit4')) this.useItem(4);

    // hazards auto-on when stranded
    this.car.hazards = this.engine.broken || this.fuel <= 0;
    // blinker clicks
    const blinkOn = (this.car.signal !== 0 || this.car.hazards) && (t * 1.6) % 1 < 0.55;
    if (blinkOn && !this.lastBlink) this.audio.blinker();
    this.lastBlink = blinkOn;

    // input (manual vs autopilot)
    let throttle = (k.has('KeyW') || k.has('ArrowUp') || td.gas) ? 1 : 0;
    let brake = (k.has('KeyS') || k.has('ArrowDown') || td.brk) ? 1 : 0;
    let steer = ((k.has('KeyA') || k.has('ArrowLeft') || td.left) ? -1 : 0)
      + ((k.has('KeyD') || k.has('ArrowRight') || td.right) ? 1 : 0);
    const handbrake = k.has('Space');
    const manual = throttle > 0 || brake > 0 || steer !== 0 || handbrake;
    if (manual && this.auto.on) this.setAuto(false);

    let input = { throttle, brake, steer, handbrake };
    if (this.auto.on) {
      const laneX = Math.abs(this.phy.x - LANES_ME[0]) < Math.abs(this.phy.x - LANES_ME[1])
        ? LANES_ME[0] : LANES_ME[1];
      const auto = this.auto.drive({
        x: this.phy.x,
        heading: this.phy.heading,
        speed: this.phy.speed,
        laneX,
        trafficAhead: this.trafficAhead(),
        canDrive: this.engineRunning(),
      });
      if (auto) {
        input = auto;
        throttle = auto.throttle;
        brake = auto.brake;
        steer = auto.steer;
      } else if (this.auto.on) {
        this.setAuto(false);
        this.hud.toast('Auto-drive unavailable ⚠️', 2200);
      }
      if (this.weather.intensity > 0.55 && this.car.wiperMode === 0) this.car.wiperMode = 1;
    }

    // fatigue wobble
    const fat = this.needs.fatigue;
    if (fat > 0 && !this.auto.on) {
      steer += Math.sin(t * 1.7) * 0.14 * fat + Math.sin(t * 0.9) * 0.1 * fat;
      input.steer = clamp(steer, -1, 1);
    }

    // engine power (misfires)
    const kmhPre = Math.abs(this.phy.speed) * 3.6;
    const power = this.engine.update(dt, {
      rpm01: this.rpm01 || 0,
      throttle,
      speedKmh: kmhPre,
      offroad: this.surfaceAt(this.phy.x, this.phy.z) === 'dirt',
      running: this.engineRunning(),
    });
    input.throttle = throttle * power;

    // physics
    this.phy.update(dt, input, this.carEnv());
    // wind gusts shove the car sideways
    const gust = this.weather.gust;
    if (gust > 0.02) {
      this.phy.x += this.weather.gustDir * gust * (0.35 + kmhPre / 55) * dt;
      if (!this.auto.on) this.shake = Math.max(this.shake, gust * 0.1);
    }
    this.throttleVis = input.throttle;
    this.brakeVis = brake > 0 || handbrake;

    // rails / median collision
    this.collideRails();

    // station prop collision
    this.collideProps();

    // traffic collision
    this.collideTraffic();

    // fuel burn
    const kmh = Math.abs(this.phy.speed) * 3.6;
    if (this.engineRunning()) {
      const distKm = (kmh * dt) / 3600;
      const rate = (8 + throttle * 14 + (kmh > 100 ? 6 : 0)) * this.upgrades.ecoMult();
      this.fuel = Math.max(0, this.fuel - (distKm * rate) / 100 - dt * 0.0002);
      this.odoM += Math.abs(this.phy.speed) * dt;
      this.cash += distKm * VLOG_PER_KM;
      if (this.fuel <= 0) {
        this.fuel = 0;
        this.hud.toast('⛽ Out of fuel! Jerry can [1], push, or tow (T)', 4200);
        this.audio.deny();
      }
    } else {
      this.odoM += Math.abs(this.phy.speed) * dt;
    }
    const cap = this.tankCap();
    if (this.fuel < cap * 0.15 && !this.flagFuel && this.fuel > 0) {
      this.flagFuel = true;
      this.hud.toast('⛽ Low fuel — find an SPBU soon!', 3200);
    }
    if (this.fuel >= cap * 0.2) this.flagFuel = false;

    // broken toast
    if (this.engine.broken && !this.flagBroke) {
      this.flagBroke = true;
      this.hud.toast('🔧 ENGINE DEAD! Kit [2]/hood · push it · garage · tow (T)', 5200);
    }
    if (!this.engine.broken) this.flagBroke = false;

    // dirt
    const surf = this.surfaceAt(this.phy.x, this.phy.z);
    this.dirt = clamp(this.dirt + dt * (surf === 'dirt' ? 0.02 : kmh > 5 ? 0.0006 : 0), 0, 1);

    // clock + needs
    this.clockMin += dt * (10 / 60);
    this.needs.update(dt, true);
    this.updateNeedsFx(dt);

    // car wash trigger
    this.updateWash(dt);

    // hitchhiker drop-off
    if (this.hitch.nearDrop(this.phy.x, this.phy.z) && Math.abs(this.phy.speed) < 3) {
      const tip = this.hitch.dropOff();
      if (tip > 0) {
        this.cash += tip;
        this.audio.chaching();
        this.hud.toast(`🏁 Dropped off! +${fmtRp(tip)} 🧍`, 3200);
      }
    }

    // rpm / gear
    this.computeRev(throttle);

    // exit car
    if (Math.abs(this.phy.speed) < 3) {
      this.setPrompt('<b>E</b> — Get out');
      if (jp.has('KeyE')) this.exitCar();
    } else {
      this.setPrompt(null);
    }

    // camera + shake
    this.shake = Math.max(0, this.shake - dt * 2.4);
    if (surf === 'dirt' && kmh > 10) this.shake = Math.max(this.shake, 0.18);
    this.updateCamera(dt);

    this.syncCarTransform();
    this.crashCd -= dt;
    this.scrapeT -= dt;
  }

  trafficAhead() {
    let best = null;
    for (const c of this.trafficList || []) {
      if (!c.same) continue;
      if (Math.abs(c.x - this.phy.x) > 1.8) continue;
      const dz = this.phy.z - c.z;
      if (dz > 4 && dz < 60 && (!best || dz < best.dist)) {
        best = { dist: dz, speed: c.speed };
      }
    }
    return best;
  }

  collideRails() {
    const inGap = this.road.gapSideAt(this.phy.z) === -1;
    const xMin = inGap ? -30 : -8.6;
    const xMax = 8.6;
    let hit = false;
    if (this.phy.x < xMin) {
      this.phy.x = xMin;
      hit = true;
    } else if (this.phy.x > xMax) {
      this.phy.x = xMax;
      hit = true;
    }
    if (this.phy.x > -0.8) {
      this.phy.x = -0.8; // median barrier
      hit = true;
    }
    const kmh = Math.abs(this.phy.speed) * 3.6;
    if (hit) {
      this.phy.slide *= 0.4;
      if (kmh > 6 && this.scrapeT <= 0) {
        this.scrapeT = 0.35;
        this.audio.scrape();
        this.shake = Math.max(this.shake, 0.3);
        if (kmh > 40) {
          this.engine.crashDamage(kmh * 0.25);
          this.phy.speed *= 0.94;
        }
      }
    }
  }

  carCircles() {
    const f = this.phy.forward();
    return [
      { x: this.phy.x + f.x * 1.5, z: this.phy.z + f.z * 1.5, r: 1.25 },
      { x: this.phy.x - f.x * 1.5, z: this.phy.z - f.z * 1.5, r: 1.25 },
    ];
  }

  collideProps() {
    if (this.crashCd > 0) return;
    const circles = this.carCircles();
    const cols = this.stations.collidersNear(this.phy.x, this.phy.z, 3);
    for (const cc of circles) {
      for (const c of cols) {
        const dx = cc.x - c.x;
        const dz = cc.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = cc.r + c.r;
        if (d < min && d > 0.001) {
          const kmh = Math.abs(this.phy.speed) * 3.6;
          this.phy.x = c.x + (dx / d) * min;
          this.phy.z = c.z + (dz / d) * min;
          if (kmh > 9) {
            this.engine.crashDamage(kmh);
            this.audio.crash(clamp(kmh / 60, 0.3, 1));
            this.shake = 1.2;
            this.phy.speed *= -0.12;
            this.crashCd = 1;
            this.hud.toast('💥 Crash! Engine ' + Math.round(this.engine.health) + '%', 2400);
          } else {
            this.phy.speed *= 0.6;
          }
          return;
        }
      }
    }
  }

  collideTraffic() {
    if (this.crashCd > 0) return;
    for (const c of this.trafficList || []) {
      if (Math.abs(c.x - this.phy.x) < 2.0 && Math.abs(c.z - this.phy.z) < 4.7) {
        const v2 = c.same ? c.speed : -c.speed;
        const impact = Math.abs(this.phy.speed - v2) * 3.6;
        this.engine.crashDamage(impact);
        this.audio.crash(clamp(impact / 70, 0.4, 1.2));
        this.audio.trafficHorn();
        this.shake = 1.4;
        this.phy.speed = (this.phy.speed + v2) * 0.25;
        this.phy.x += this.phy.x < c.x ? -0.8 : 0.8;
        this.crashCd = 1.2;
        this.hud.toast('💥 Crash! Engine ' + Math.round(this.engine.health) + '%', 2400);
        return;
      }
    }
  }

  computeRev(throttle) {
    const kmh = Math.abs(this.phy.speed) * 3.6;
    const bands = [[0, 25], [25, 45], [45, 70], [70, 105], [105, 175]];
    if (!this.engineRunning()) {
      this.gearStr = 'N';
      this.rpm01 = 0;
      return;
    }
    if (this.phy.reversing && this.phy.speed < 0.5) {
      this.gearStr = 'R';
      this.rpm01 = 0.25 + throttle * 0.4;
      return;
    }
    let gi = 0;
    for (let i = 0; i < bands.length; i++) {
      if (kmh >= bands[i][0]) gi = i;
    }
    const [lo, hi] = bands[gi];
    const pos = clamp((kmh - lo) / (hi - lo), 0, 1);
    this.gearStr = String(gi + 1);
    this.rpm01 = kmh < 2 && throttle === 0 ? 0.12 : clamp(0.22 + 0.6 * pos + throttle * 0.2, 0.1, 1.0);
  }

  updateWash(dt) {
    this.washCooldown -= dt;
    const st = this.stations.washTrigger(this.phy.x, this.phy.z);
    const speed = Math.abs(this.phy.speed);
    if (this.washSession) {
      const s = this.washSession;
      if (!st || st !== s.st || speed > 4) {
        this.washSession = null;
        this.car.washActive = false;
        this.hud.toast('Wash cancelled', 1800);
        this.hud.progress(null);
        return;
      }
      s.t -= dt;
      this.car.washActive = true;
      this.hud.progress(1 - s.t / 6, '🧼 Washing… stay put!');
      if (s.t <= 0) {
        this.washSession = null;
        this.car.washActive = false;
        this.dirt = 0;
        this.hud.progress(null);
        this.hud.toast('✨ Sparkling clean!', 2600);
        this.audio.chaching();
      }
      return;
    }
    this.car.washActive = false;
    if (st && speed < 3 && this.dirt > 0.12 && this.washCooldown <= 0) {
      if (this.cash >= WASH_COST) {
        this.cash -= WASH_COST;
        this.washSession = { st, t: 6 };
        this.hud.toast('🧼 Car wash! ' + fmtRp(WASH_COST), 2200);
      } else {
        this.washCooldown = 12;
        this.hud.toast('Need ' + fmtRp(WASH_COST) + ' for the wash', 2600);
        this.audio.deny();
      }
    }
  }

  setAuto(on) {
    if (on && !this.engineRunning()) {
      this.hud.toast('Auto-drive needs a running engine ⚠️', 2200);
      return;
    }
    this.auto.set(on);
    this.hud.setAuto(on);
    this.hud.toast(on ? '🚗 Auto-drive ON — sit back!' : '🚗 Auto-drive OFF', 1800);
    this.audio.click();
  }

  // ================= on foot =================
  exitCar() {
    const r = this.phy.right();
    const f = this.phy.forward();
    this.state = 'foot';
    this.controls.mode = 'foot';
    this.setAutoSilent(false);
    this.walker.place(
      this.phy.x + r.x * 1.7 + f.x * 0.3,
      this.phy.z + r.z * 1.7 + f.z * 0.3,
      this.phy.heading
    );
    this.controls.lookYaw = this.phy.heading;
    this.controls.lookPitch = 0;
    if (this.controls.isTouch) this.hud.setTouchMode('foot');
    this.audio.door();
    this.hud.toast('🚶 On foot — E to interact', 2000);
  }

  enterCar() {
    this.state = 'drive';
    this.controls.mode = 'drive';
    this.pushing = false;
    this.controls.lookYaw = 0;
    this.controls.lookPitch = 0;
    if (this.controls.isTouch) this.hud.setTouchMode('drive');
    this.audio.door();
    if (this.fuel <= 0) this.hud.toast('⛽ No fuel! Find some or tow (T)', 2600);
    else if (this.engine.broken) this.hud.toast('🔧 Engine is dead — repair, push, or tow', 2600);
  }

  setAutoSilent(on) {
    this.auto.set(on);
    this.hud.setAuto(on);
  }

  carPoints() {
    const f = this.phy.forward();
    const r = this.phy.right();
    const at = (rf, rr) => ({
      x: this.phy.x + f.x * rf + r.x * rr,
      z: this.phy.z + f.z * rf + r.z * rr,
    });
    return {
      door: at(0.3, 1.3),
      flap: at(-2.35, 0.55),
      hood: at(2.4, 0),
      push: at(-3.3, 0),
    };
  }

  updateFoot(dt, t) {
    const k = this.controls.keys;
    const jp = this.controls.justPressed;
    if (jp.has('KeyM')) this.toggleMute();
    if (jp.has('KeyT')) this.doTow();
    if (jp.has('KeyP')) this.togglePhoto();
    if (jp.has('Digit1')) this.useItem(1);
    if (jp.has('Digit2')) this.useItem(2);
    if (jp.has('Digit3')) this.useItem(3);
    if (jp.has('Digit4')) this.useItem(4);
    if (jp.has('KeyR')) this.cycleRadio();

    // movement (frozen while pushing — pinned to car)
    let mf = 0;
    let ms = 0;
    if (!this.pushing) {
      mf = ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0);
      ms = ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0);
      if (this.controls.joy.active) {
        mf += -this.controls.joy.y;
        ms += this.controls.joy.x;
      }
    }
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    this.walker.yaw = this.controls.lookYaw;
    this.walker.pitch = this.controls.lookPitch;
    const inGap = this.road.gapSideAt(this.walker.pos.z) === -1;
    const xLimit = inGap ? 30 : 8.6;
    if (!this.pushing) {
      this.walker.update(dt, { f: mf, s: ms, run },
        this.stations.collidersNear(this.walker.pos.x, this.walker.pos.z, 3),
        this.carCircles(), xLimit);
    }

    this.clockMin += dt * (10 / 60);
    this.needs.update(dt, false);
    this.updateNeedsFx(dt);

    // interactions
    this.updateInteract(dt);

    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.updateCamera(dt);
  }

  updateInteract(dt) {
    const k = this.controls.keys;
    const jp = this.controls.justPressed;
    const eHeld = k.has('KeyE') || this.controls.actHeld;
    const px = this.walker.pos.x;
    const pz = this.walker.pos.z;
    const pts = this.carPoints();

    const cands = [];
    const dDoor = Math.hypot(px - pts.door.x, pz - pts.door.z);
    if (dDoor < 2.3) cands.push({ id: 'door', d: dDoor });
    const dFlap = Math.hypot(px - pts.flap.x, pz - pts.flap.z);
    if (dFlap < 2.6) cands.push({ id: 'flap', d: dFlap });
    const dHood = Math.hypot(px - pts.hood.x, pz - pts.hood.z);
    if (dHood < 2.6) cands.push({ id: 'hood', d: dHood });
    const dPush = Math.hypot(px - pts.push.x, pz - pts.push.z);
    const canPush = Math.abs(this.phy.speed) < 0.6 && (this.engine.broken || this.fuel <= 0);
    if (dPush < 2.6 && canPush) cands.push({ id: 'push', d: dPush });
    const hi = this.hitch.info();
    if (hi.state === 'waiting') {
      const dH = Math.hypot(px - hi.x, pz - hi.z);
      if (dH < 3) cands.push({ id: 'hitch', d: dH });
    }
    for (const zn of this.stations.zonesNear(px, pz)) {
      cands.push({ id: 'zone:' + zn.type, d: Math.hypot(px - zn.x, pz - zn.z), zn });
    }
    cands.sort((a, b) => a.d - b.d);
    const cur = cands[0] || null;
    const curId = cur ? cur.id : null;

    // reset hold when target changes or E released
    if (curId !== this.holdId || !eHeld) {
      if (this.holdId === 'flap') this.audio.stopFuel();
      if (this.holdId === 'hood') this.car.hoodTarget = 0;
      if (this.pushing) {
        this.pushing = false;
        this.hud.progress(null);
      }
      this.holdId = eHeld ? curId : null;
      this.holdT = 0;
      this.fuelSession = 0;
    }

    if (!cur) {
      this.setPrompt(null);
      this.hud.progress(null);
      return;
    }

    // ---- instant actions ----
    if (cur.id === 'door') {
      this.setPrompt('<b>E</b> — Get in');
      if (jp.has('KeyE')) this.enterCar();
      return;
    }
    if (cur.id === 'hitch') {
      const carD = Math.hypot(px - this.phy.x, pz - this.phy.z);
      if (carD > 16 || Math.abs(this.phy.speed) > 0.5) {
        this.setPrompt('Park the car closer to pick them up 🚗');
        return;
      }
      this.setPrompt('<b>E</b> — Pick up hitchhiker 🧍');
      if (jp.has('KeyE')) {
        const res = this.hitch.pickUp(pz, this.stations);
        if (res) {
          this.audio.chaching();
          this.hud.toast(`🧍 → ${res.destName}! Tip ${fmtRp(res.tip)}`, 3400);
        } else {
          this.audio.deny();
        }
      }
      return;
    }
    if (cur.id.startsWith('zone:')) {
      const zn = cur.zn;
      if (zn.type === 'shop') {
        this.setPrompt('<b>E</b> — Mart 24H');
        if (jp.has('KeyE')) this.openShop('🏪 MART 24H', SHOP_MART);
      } else if (zn.type === 'diner') {
        this.setPrompt('<b>E</b> — Warkop Diner');
        if (jp.has('KeyE')) this.openShop('🍜 WARKOP DINER', SHOP_DINER);
      } else if (zn.type === 'motel') {
        this.setPrompt('<b>E</b> — Motel Melati (rest & save)');
        if (jp.has('KeyE')) this.openRest('motel');
      } else if (zn.type === 'rest') {
        this.setPrompt('<b>E</b> — Rest area (free doze)');
        if (jp.has('KeyE')) this.openRest('doze');
      } else if (zn.type === 'garage') {
        this.setPrompt('<b>E</b> — Bengkel (service + upgrades)');
        if (jp.has('KeyE')) this.openUpgrades();
      } else if (zn.type === 'pump') {
        this.setPrompt('Pump — refuel at the <b>rear of the car</b> ⛽');
      }
      return;
    }

    // ---- hold actions ----
    if (cur.id === 'flap') {
      this.flapHold(dt, eHeld);
      return;
    }
    if (cur.id === 'hood') {
      this.hoodHold(dt, eHeld, jp);
      return;
    }
    if (cur.id === 'push') {
      this.pushHold(dt, eHeld);
      return;
    }
    this.setPrompt(null);
  }

  flapHold(dt, eHeld) {
    const cap = this.tankCap();
    const pump = this.stations.nearestPump(this.phy.x, this.phy.z);
    const nearPump = pump && pump.d < 8;
    if (this.fuel >= cap - 0.01) {
      this.setPrompt('Tank is full ✨');
      this.hud.progress(null);
      return;
    }
    if (!nearPump) {
      const hasCan = this.inv.can > 0;
      this.setPrompt(hasCan
        ? 'No pump nearby — press <b>1</b> for jerry can 🛢️'
        : 'No pump nearby — push to SPBU or tow (<b>T</b>)');
      this.hud.progress(null);
      return;
    }
    const price = pump.st.fuelPrice;
    this.setPrompt(`<b>HOLD E</b> — Refuel · ${fmtRp(price)}/L`);
    if (!eHeld) {
      this.hud.progress(null);
      return;
    }
    if (this.holdT === 0) {
      this.audio.startFuel();
      this.holdT = 0.0001;
    }
    const rate = 1.5; // L/s
    const add = Math.min(rate * dt, cap - this.fuel);
    const cost = add * price;
    if (this.cash < cost) {
      this.hud.toast("Not enough cash! 💸", 2200);
      this.audio.deny();
      this.audio.stopFuel();
      this.holdId = '@@broke@@';
      this.hud.progress(null);
      return;
    }
    this.fuel += add;
    this.cash -= cost;
    this.fuelSession += cost;
    this.hud.progress(this.fuel / cap,
      `${this.fuel.toFixed(1)} L · ${fmtRp(this.fuelSession)} (release to stop)`);
    if (this.fuel >= cap - 0.01) {
      this.fuel = cap;
      this.audio.stopFuel();
      this.audio.click();
      this.hud.toast('Tank full! ' + fmtRp(this.fuelSession) + ' ⛽', 2600);
      this.holdId = '@@done@@';
      this.hud.progress(null);
    }
  }

  hoodHold(dt, eHeld, jp) {
    if (Math.abs(this.phy.speed) > 0.5) {
      this.setPrompt('Stop the car first!');
      return;
    }
    if (this.engine.health >= 99.5) {
      this.setPrompt('Engine is healthy ✨');
      return;
    }
    if (this.inv.kit <= 0) {
      this.setPrompt('Need a <b>repair kit</b> — buy at MART 🔧');
      if (jp.has('KeyE')) this.audio.deny();
      return;
    }
    this.setPrompt('<b>HOLD E</b> — Repair engine (uses 1 kit)');
    if (!eHeld) {
      this.hud.progress(null);
      return;
    }
    this.car.hoodTarget = 1;
    this.holdT += dt;
    if (Math.random() < dt * 3) this.audio.clank();
    this.hud.progress(this.holdT / 7, '🔧 Repairing…');
    if (this.holdT >= 7) {
      this.inv.kit -= 1;
      this.engine.repairSelf();
      this.car.hoodTarget = 0;
      this.audio.repairDone();
      this.hud.toast('Engine patched! ' + Math.round(this.engine.health) + '% 🔧', 2800);
      this.holdId = '@@done@@';
      this.hud.progress(null);
    }
  }

  pushHold(dt, eHeld) {
    this.setPrompt('<b>HOLD E</b> — Push the car 💪');
    if (!eHeld) {
      this.hud.progress(null);
      return;
    }
    this.pushing = true;
    // steer slightly while pushing
    const k = this.controls.keys;
    const steer = ((k.has('KeyA') || k.has('ArrowLeft')) ? -1 : 0)
      + ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0);
    this.phy.heading += steer * 0.3 * dt;
    this.phy.speed += (1.5 - this.phy.speed) * Math.min(1, dt * 1.5);
    const f = this.phy.forward();
    this.phy.x += f.x * this.phy.speed * dt;
    this.phy.z += f.z * this.phy.speed * dt;
    // rails clamp while pushing
    const inGap = this.road.gapSideAt(this.phy.z) === -1;
    this.phy.x = clamp(this.phy.x, inGap ? -30 : -8.6, -0.8);
    // pin walker behind car
    this.walker.pos.set(this.phy.x - f.x * 3.1, 0, this.phy.z - f.z * 3.1);
    this.walker.yaw = this.controls.lookYaw = this.phy.heading;
    this.needs.pushDrain(dt);
    this.odoM += this.phy.speed * dt;
    this.syncCarTransform();
    this.car.hazards = true;
    this.hud.progress(null);
    const pump = this.stations.nearestPump(this.phy.x, this.phy.z);
    if (pump && pump.d < 9) {
      this.setPrompt('<b>HOLD E</b> — Pushing… pump nearby! ⛽');
    }
  }

  // ================= shops / rest / upgrades / tow =================
  openShop(title, stock) {
    this.overlay = 'shop';
    this.audio.click();
    const items = stock.map((it) => ({
      ...it,
      can: it.key === 'meal' ? this.cash >= it.price : this.cash >= it.price && (this.inv[it.key] ?? 0) < (INV_MAX[it.key] ?? 9),
      cb: () => this.buy(title, stock, it),
    }));
    this.hud.openShop(title, this.cash, items);
  }

  buy(title, stock, it) {
    if (this.cash < it.price) {
      this.audio.deny();
      return;
    }
    this.cash -= it.price;
    if (it.key === 'meal') {
      this.needs.eat(65);
      this.needs.energy = clamp(this.needs.energy + 10, 0, 100);
      this.audio.gulp();
      this.hud.toast('🍜 Slurps! Delicious.', 2200);
    } else {
      this.inv[it.key] = Math.min((this.inv[it.key] ?? 0) + 1, INV_MAX[it.key] ?? 9);
      this.audio.chaching();
    }
    this.openShop(title, stock); // refresh
  }

  openRest(kind) {
    this.overlay = 'rest';
    this.audio.click();
    if (kind === 'motel') {
      this.hud.openRest(this.cash, [
        {
          icon: '😴', name: 'Quick nap (2h)', desc: '+energy · saves game', price: 60000,
          can: this.cash >= 60000, cb: () => this.doRest(2, 60000),
        },
        {
          icon: '🛏️', name: 'Sleep night (8h)', desc: 'full rest · saves game', price: 180000,
          can: this.cash >= 180000, cb: () => this.doRest(8, 180000),
        },
      ]);
    } else {
      this.hud.openRest(this.cash, [
        {
          icon: '💤', name: 'Doze in car (1h)', desc: '+35 energy · FREE · saves', price: 0,
          can: true, cb: () => this.doRest(1, 0),
        },
      ]);
    }
  }

  doRest(hours, cost) {
    this.cash -= cost;
    this.closeOverlay();
    this.audio.snore();
    this.hud.fade(true, 900);
    setTimeout(() => {
      this.clockMin += hours * 60;
      this.needs.rest(hours);
      if (hours >= 8) {
        this.needs.energy = 100;
      }
      const ok = saveGame(this.collectSave());
      this.hud.fade(false, 900);
      this.hud.toast(ok ? `Rested + game saved 💾 (${fmtClock(this.clockMin)})` : 'Rested 😌', 3000);
    }, 950);
  }

  openUpgrades() {
    this.overlay = 'upgrades';
    this.audio.click();
    const svcCost = Math.max(25000, Math.round((100 - this.engine.health) * 2500));
    this.hud.openUpgrades(this.cash, this.upgrades, this.engine.health, svcCost, (kind) => {
      if (kind === 'service') this.doService(svcCost);
      else this.buyUpgrade(kind);
    });
  }

  buyUpgrade(key) {
    const cost = this.upgrades.costOf(key);
    if (this.upgrades.maxed(key) || this.cash < cost) {
      this.audio.deny();
      return;
    }
    this.cash -= cost;
    this.upgrades.buy(key);
    this.audio.chaching();
    const def = UpgradeSet.def(key);
    this.hud.toast(`${def.icon} ${def.name} installed! ${this.upgrades.pips(key)}`, 2600);
    this.openUpgrades(); // refresh
  }

  doService(cost) {
    if (this.engine.health >= 99.5 || this.cash < cost) {
      this.audio.deny();
      return;
    }
    this.cash -= cost;
    this.engine.repairGarage();
    this.audio.repairDone();
    this.hud.toast('Full service done! Engine 100% ✨', 2600);
    this.openUpgrades(); // refresh
  }

  openSettings() {
    if (this.state === 'intro' || this.overlay) return;
    this.overlay = 'settings';
    this.audio.click();
    this.renderSettings();
  }

  renderSettings() {
    this.hud.openSettings(this.settings, (what, delta) => {
      if (what === 'vol') {
        this.settings.volume = clamp(this.settings.volume + delta, 0, 1);
        this.audio.setVolume(this.settings.volume);
      } else if (what === 'quality') {
        const order = ['auto', 'high', 'low'];
        const i = (order.indexOf(this.settings.quality) + (delta > 0 ? 1 : order.length - 1)) % order.length;
        this.settings.quality = order[i];
        this.applyQuality();
      } else if (what === 'sens') {
        this.settings.sensitivity = clamp(this.settings.sensitivity + delta, 0.2, 3);
        this.controls.sensitivity = this.settings.sensitivity;
      }
      this.settings.save();
      this.audio.click();
      this.renderSettings(); // refresh
    });
  }

  applyQuality() {
    const q = this.settings.quality;
    if (q === 'low') {
      this.world.setQuality('low');
      this.degraded = true;
      this.fpsChecked = true;
    } else {
      this.world.setQuality('high');
      this.degraded = false;
      if (q === 'auto') {
        // re-arm the auto watchdog
        this.fpsChecked = false;
        this.fpsAcc = 0;
        this.fpsN = 0;
      } else {
        this.fpsChecked = true;
      }
    }
  }

  togglePhoto() {
    if (this.state === 'intro' || this.overlay) return;
    if (!this.photo.active) {
      this.photo.toggle();
      this.hud.setPhotoMode(true);
      this.hud.toast('📷 Photo mode — look around, P again to snap!', 2600);
      this.audio.click();
    } else {
      this.photo.snap();
      this.photo.exit();
      this.hud.setPhotoMode(false);
    }
  }

  doTow() {
    if (this.overlay) return;
    if (this.cash < TOW_COST) {
      this.hud.toast('Tow needs ' + fmtRp(TOW_COST) + ' — push the car! 💪', 3000);
      this.audio.deny();
      return;
    }
    const dest = this.stations.garageForTow(this.state === 'drive' ? this.phy.z : this.walker.pos.z);
    if (!dest) {
      this.hud.toast('No garage in range?! Keep pushing…', 2600);
      return;
    }
    this.cash -= TOW_COST;
    this.audio.towBeep();
    this.hud.toast('🚚 Tow truck on the way…', 2200);
    this.hud.fade(true, 1200);
    setTimeout(() => {
      const st = dest.st;
      this.phy.reset(-16, st.z + 18);
      this.syncCarTransform();
      this.setAutoSilent(false);
      if (this.state === 'foot') {
        this.state = 'drive';
        this.controls.mode = 'drive';
        if (this.controls.isTouch) this.hud.setTouchMode('drive');
        this.controls.lookYaw = 0;
        this.controls.lookPitch = 0;
      }
      this.hud.fade(false, 1200);
      this.hud.toast('🚚 Dropped at ' + (st.flavor === 'motel' ? 'BENGKEL' : 'SPBU') + ' · ' + fmtRp(TOW_COST), 3200);
    }, 1250);
  }

  useItem(n) {
    if (this.overlay || this.state === 'intro') return;
    const cap = this.tankCap();
    const stopped = Math.abs(this.phy.speed) < 2;
    if (n === 1) {
      // jerry can
      if (this.inv.can <= 0) {
        this.hud.toast('No jerry can — buy at MART 🛢️', 2200);
        this.audio.deny();
        return;
      }
      if (!stopped) {
        this.hud.toast('Stop the car first!', 1800);
        return;
      }
      if (this.state === 'foot') {
        const d = Math.hypot(this.walker.pos.x - this.phy.x, this.walker.pos.z - this.phy.z);
        if (d > 7) {
          this.hud.toast('Get closer to the car!', 1800);
          return;
        }
      }
      if (this.fuel >= cap - 1) {
        this.hud.toast('Tank is nearly full already', 1800);
        return;
      }
      this.inv.can -= 1;
      this.fuel = Math.min(cap, this.fuel + 15);
      this.audio.noise({ dur: 0.8, vol: 0.14, low: 400, high: 1500 });
      this.hud.toast('🛢️ +15L poured in!', 2200);
    } else if (n === 2) {
      // quick patch
      if (this.inv.kit <= 0) {
        this.hud.toast('No repair kit — buy at MART 🔧', 2200);
        this.audio.deny();
        return;
      }
      if (!stopped) {
        this.hud.toast('Stop the car first!', 1800);
        return;
      }
      if (this.engine.health >= 99.5) {
        this.hud.toast('Engine is healthy ✨', 1800);
        return;
      }
      this.inv.kit -= 1;
      this.engine.health = clamp(this.engine.health + 35, 0, 100);
      this.audio.clank();
      setTimeout(() => this.audio.repairDone(), 250);
      this.hud.toast('Quick patch! Engine ' + Math.round(this.engine.health) + '%', 2400);
    } else if (n === 3) {
      if (this.inv.snack <= 0) {
        this.hud.toast('No snacks 🍩', 1800);
        this.audio.deny();
        return;
      }
      this.inv.snack -= 1;
      this.needs.eat(45);
      this.audio.gulp();
      this.hud.toast('🍩 Tasty! +45 food', 2000);
    } else if (n === 4) {
      if (this.inv.coffee <= 0) {
        this.hud.toast('No coffee ☕', 1800);
        this.audio.deny();
        return;
      }
      this.inv.coffee -= 1;
      this.needs.coffee();
      this.audio.gulp();
      this.hud.toast('☕ Wide awake! +26 energy', 2000);
    }
  }

  closeOverlay() {
    this.overlay = null;
    this.hud.closeShop();
    this.hud.closeRest();
    this.hud.closeUpgrades();
    this.hud.closeSettings();
    this.hud.showHelp(false);
    this.audio.click();
  }

  updateNeedsFx(dt) {
    // microsleep nods at zero energy
    if (this.needs.energy <= 0) {
      this.nodT -= dt;
      if (this.nodT <= 0) {
        this.nodT = 15 + Math.random() * 10;
        this.nodding = 1.5;
        this.hud.toast('😴…! Find a motel!', 2400);
      }
    }
    this.nodding = Math.max(0, this.nodding - dt);
    this.hud.eyelids(Math.max(this.needs.fatigue * 0.85, this.nodding > 0 ? 0.92 : 0));
    // hunger growls
    if (this.needs.starving) {
      this.growlT -= dt;
      if (this.growlT <= 0) {
        this.growlT = 40;
        this.audio.growl();
      }
      if (!this.flagStarve) {
        this.flagStarve = true;
        this.hud.toast('🍩 Hungry… grab a snack!', 2600);
      }
    } else {
      this.flagStarve = false;
    }
  }

  // ================= camera =================
  updateCamera(dt) {
    const shake = this.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.3 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.3 : 0;
    if (this.state === 'drive') {
      const f = this.phy.forward();
      const r = this.phy.right();
      this.camera.position.set(
        this.phy.x + r.x * 0.42 + f.x * 0.1 + sx * 0.3,
        1.24 + sy * 0.3,
        this.phy.z + r.z * 0.42 + f.z * 0.1
      );
      const yaw = this.phy.heading + clamp(this.controls.lookYaw, -2.6, 2.6) + (this.lookBack ? Math.PI : 0);
      const pitch = clamp(this.controls.lookPitch, -0.5, 0.35);
      const gustRoll = this.weather.gust * this.weather.gustDir * 0.01
        * Math.min(1, Math.abs(this.phy.speed) / 20);
      this.camera.rotation.set(pitch + sy * 0.1, yaw + sx * 0.1, gustRoll);
    } else {
      this.camera.position.set(this.walker.pos.x, this.walker.eyeHeight(), this.walker.pos.z);
      this.camera.rotation.set(this.walker.pitch, this.walker.yaw, 0);
    }
  }

  syncCarTransform() {
    this.car.group.position.set(this.phy.x, 0, this.phy.z);
    this.car.group.rotation.y = this.phy.heading;
  }

  syncCarVisuals() {
    const c = this.car;
    c.speedKmh = this.phy.speed * 3.6;
    c.rpm01 = this.rpm01 || 0;
    c.gear = this.gearStr || 'N';
    c.fuel01 = this.fuel / this.tankCap();
    c.tempC = this.engine.temp;
    c.odoM = this.odoM;
    c.clockStr = fmtClock(this.clockMin);
    c.steerVis = this.phy.steer;
    c.throttleVis = this.throttleVis || 0;
    c.brakeVis = !!this.brakeVis;
    c.reversing = this.phy.speed < -0.3;
    c.dirt = this.dirt;
    c.health = this.engine.health;
    c.rainI = this.weather.intensity;
    c.engineOn = this.engineRunning();
    c.beamLvl = this.upgrades.beamLvl();
    c.gpsLines = [this.gpsFuel, this.gpsRest];
    // mirror dots: traffic behind
    const dots = [];
    for (const t of this.trafficList || []) {
      if (!t.same) continue;
      const dz = t.z - this.phy.z;
      if (dz > 2 && dz < 90) {
        dots.push({
          x: clamp((t.x - this.phy.x) / 8, -1, 1),
          r: clamp(4 - dz / 28, 1, 3.5),
          color: '#ff3030',
        });
      }
      if (dots.length >= 6) break;
    }
    c.behindDots = dots;
    // dome light when near car on foot
    if (this.state === 'foot') {
      const d = Math.hypot(this.walker.pos.x - this.phy.x, this.walker.pos.z - this.phy.z);
      c.domeTarget = d < 7 ? 1 : 0;
    } else {
      c.domeTarget = 0;
    }
  }

  // ================= HUD =================
  setPrompt(html) {
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    this.hud.prompt(html);
  }

  refreshHUD() {
    const pz = this.state === 'foot' ? this.walker.pos.z : this.phy.z;
    this.hud.setStats(this.cash, this.clockMin, this.odoM);
    this.hud.setWarns({
      fuel: this.fuel < this.tankCap() * 0.15,
      eng: this.engine.health < 50,
      temp: this.engine.temp > 122,
      lights: this.car.lightsOn,
    });
    this.hud.setDrive({
      speedKmh: this.phy.speed * 3.6,
      gear: this.gearStr || 'N',
      fuel01: this.fuel / this.tankCap(),
      energy01: this.needs.energy / 100,
      food01: this.needs.food / 100,
      inv: this.inv,
    });
    this.gpsT -= 0.1;
    if (this.gpsT <= 0) {
      this.gpsT = 0.5;
      const fuel = this.stations.ahead(pz, 'fuel');
      const rest = this.stations.ahead(pz, 'rest');
      this.gpsFuel = fuel ? `⛽ ${fmtKm(fuel.dz)} ←` : '⛽ —';
      this.gpsRest = rest ? `🛏️ ${fmtKm(rest.dz)} ←` : '🛏️ —';
      this.hud.setGPS(this.gpsFuel, this.gpsRest);
    }
    // passenger chip + minimap
    const hi = this.hitch.info();
    if (hi.state === 'aboard') {
      this.hud.setPassenger(`→ ${hi.destName} · ${fmtKm(Math.max(0, pz - hi.destZ))} · ${fmtRp(hi.tip)}`);
    } else {
      this.hud.setPassenger(null);
    }
    this.minimap.draw({
      stations: this.stations.aheadList(pz, 4),
      hitch: hi,
      pz,
    });
  }

  fpsWatch(dt) {
    if (this.fpsChecked) return;
    if (this.settings.quality !== 'auto') {
      this.fpsChecked = true;
      return;
    }
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 5) {
      this.fpsChecked = true;
      const fps = this.fpsN / this.fpsAcc;
      if (fps < 26 && !this.degraded) {
        this.degraded = true;
        this.world.degrade();
        this.ground.setReflections(false);
        this.hud.toast('🐢 Quality auto-lowered for smoothness', 3000);
      }
    }
  }
}
