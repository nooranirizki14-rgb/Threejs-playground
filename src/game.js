import * as THREE from 'three';
import { World } from './world.js';
import { Controls } from './controls.js';
import { Porch } from './porch.js';
import { Body } from './body.js';
import { Nature } from './nature.js';
import { Rain } from './rain.js';
import { Lake } from './lake.js';
import { SkyFX } from './skyfx.js';
import { Props } from './props.js';
import { FireCamp } from './firecamp.js';
import { Puddles } from './puddles.js';
import { PostFX } from './postfx.js';
import { Dog } from './dog.js';
import { PorchLife, RADIO_POS, NOODLE_POS, BOWL_POS } from './porchlife.js';
import { Cabin } from './cabin.js';
import { Attractions, GUITAR_POS, TELESCOPE_POS, MAILBOX_POS, CELESTIALS, LETTERS } from './attractions.js';
import { Cat, Owl, FairyRing, CAT_POS, OWL_POS, RING_POS } from './wildlife.js';
import { Fishing, Rowboat, ROD_POS } from './fishing.js';
import { Chimes } from './chimes.js';
import { Footprints, Breath } from './trails.js';
import { Moths } from './moths.js';
import { AudioEngine } from './audio.js';
import { clamp, lerp, smooth, rnd } from './utils.js';

// SIT: NIGHT PORCH — LONG NIGHT edition. Sit anywhere, explore, fish,
// roast marshmallows, stargaze, read the mail, pet everyone. E uses the
// nearest E-interactable, F touches the world. J opens the night journal.
// States: 'intro' -> 'seated' <-> 'moving' (sit/stand) | 'standing' (walk).
const YARD = { x0: -17.4, x1: 17.4, z0: -34.2, z1: 10.2 };
const WALK_SPEED = 2.3;
const TRANSIT_TIME = 0.9;
const QUALITY = ['ULTRA', 'HIGH', 'BALANCED'];
const DOOR_POS = { x: 2.5, z: 4.9 };
const NOODLE_TOASTS = ['slurp 🍜', 'so good 🍜', 'midnight noodles hit different 🌙'];
const PET_TOASTS = ['good dog 🐕', 'Biscuit wags! 🐕', "who's a good boy? 🐕"];
const CHORDS = [['g', 'G'], ['c', 'C'], ['d', 'D'], ['em', 'Em'], ['am', 'Am'], ['f', 'F']];
const BOOKS = ['"Night Trains"', '"The Lake House"', '"Owl Poems"', '"Rainy Nights"', '"How to Talk to Dogs"'];
const CAT_TOASTS = ['Miso purrs 🐈', 'Miso headbutts your hand 🐈', 'purrfect 🐈'];
const RAIN_TOASTS = ['clear skies — look up ✨', 'just a drizzle 🌦️', 'storm over the lake 🌧️'];
const STATIONS = ['off', 'lofi', 'musicbox'];
const STATION_TOASTS = ['radio off', 'radio on 📻 lo-fi', 'radio on 📻 music box'];

export class Game {
  constructor() {
    this.els = {};
    for (const id of ['scene-container', 'intro', 'btn-start', 'hud', 'cross', 'prompt', 'toast', 'hint', 'btn-act']) {
      this.els[id] = document.getElementById(id);
    }
    this.els.journal = document.getElementById('journal');
    this.els.fade = document.getElementById('fade');
    this.els.flash = document.getElementById('flash');

    this.world = new World(this.els['scene-container']);
    this.controls = new Controls(this.world.renderer.domElement);
    this.porch = new Porch(this.world.scene);
    this.body = new Body(this.world.scene);
    this.nature = new Nature(this.world.scene);
    this.rain = new Rain(this.world.scene);
    this.lake = new Lake(this.world.scene);
    this.sky = new SkyFX(this.world.scene, this.world.hemi);
    this.props = new Props(this.world.scene);
    this.fire = new FireCamp(this.world.scene);
    this.puddles = new Puddles(this.world.scene);
    this.life = new PorchLife(this.world.scene);
    this.cabin = new Cabin(this.world.scene);
    this.dog = new Dog(this.world.scene);
    this.attractions = new Attractions(this.world.scene);
    this.cat = new Cat(this.world.scene);
    this.owl = new Owl(this.world.scene);
    this.ring = new FairyRing(this.world.scene);
    this.fishing = new Fishing(this.world.scene);
    this.boat = new Rowboat(this.world.scene);
    this.chimes = new Chimes(this.world.scene);
    this.prints = new Footprints(this.world.scene);
    this.breath = new Breath(this.world.scene);
    this.moths = new Moths(this.world.scene, new THREE.Vector3(0, 2.25, 0.5));
    this.postfx = new PostFX(this.world.renderer, this.world.scene, this.world.camera);
    this.audio = new AudioEngine();
    this._camDir = new THREE.Vector3();
    // thunder arrives late, like the real thing — and startles the dog
    this.sky.onThunder = () => {
      setTimeout(() => this.audio.thunder(), rnd(800, 2500));
      this.dog.thunder();
    };
    this.dog.onBark = (kind) => this.audio.bark(kind);
    this.dog.onAte = () => {
      this.life.emptyBowl();
      this.toast('Biscuit is happy 🐕');
    };
    this.life.onRefill = () => this.toast('fresh noodles 🍜');
    this.moths.setOn(this.porch.lampOn);
    this.cat.onMeow = () => this.audio.meow();
    this.chimes.onChime = () => this.audio.chime();
    this.fishing.onSplash = () => this.audio.splash();
    this.fishing.onPlip = () => this.audio.plip();
    this.fishing.onBite = () => {
      this.audio.plip();
      this.toast('a bite! press F! 🐟');
    };
    this.fishing.onCatch = (fish, count, boot) => {
      if (boot) {
        this.audio.creak();
        this.toast('…an old boot. the lake provides 🥾');
      } else {
        this.audio.catchJingle();
        this.fishCaught = count;
        this.toast(`caught ${fish}! (${count} total) 🐟`);
      }
    };
    this.fishing.onMiss = () => this.toast('it got away…');
    this.fishing.onReel = () => this.audio.click();
    this.sky.onMeteor = () => {
      this.meteorsSeen++;
      this.lastMeteorT = this.time;
      this.toast('a shooting star! (F to wish) 🌠');
    };
    window.addEventListener('resize', () => {
      this.postfx.setSize(window.innerWidth, window.innerHeight);
    });

    this.boxes = [...this.porch.boxes, ...this.props.boxes, ...this.cabin.boxes];
    this.circles = [
      ...this.porch.circles, ...this.props.circles, ...this.life.circles,
      ...this.cabin.circles, ...this.attractions.circles,
    ];

    // sittable spots: porch chair, swing, two fireside logs, couch,
    // overlook bench, dock end, rowboat
    this.spots = [
      {
        id: 'chair', eye: new THREE.Vector3(0, 1.22, 2.6), yaw: 0,
        body: { x: 0, y: 0.12, z: 2.6, rot: 0 },
        stand: new THREE.Vector3(1.0, 1.7, 2.75),
        near: { x: 0, z: 2.6 }, r: 2.5, label: 'chair', toast: 'ahh. much better 🪑',
      },
      {
        id: 'fire-east', eye: new THREE.Vector3(-6.7, 1.07, -13), yaw: Math.PI / 2,
        body: { x: -6.7, y: 0, z: -13, rot: Math.PI / 2 },
        stand: new THREE.Vector3(-6.0, 1.7, -13),
        near: { x: -6.7, z: -13 }, r: 2.0, label: 'fireside log', toast: 'warm by the fire 🔥',
      },
      {
        id: 'fire-north', eye: new THREE.Vector3(-8.5, 1.07, -11.2), yaw: 0,
        body: { x: -8.5, y: 0, z: -11.2, rot: 0 },
        stand: new THREE.Vector3(-8.5, 1.7, -10.5),
        near: { x: -8.5, z: -11.2 }, r: 2.0, label: 'fireside log', toast: 'warm by the fire 🔥',
      },
      {
        id: 'couch', eye: new THREE.Vector3(1.2, 1.18, 9.3), yaw: 0,
        body: { x: 1.2, y: 0.12, z: 9.3, rot: 0 },
        stand: new THREE.Vector3(1.2, 1.7, 8.3),
        near: { x: 1.2, z: 9.0 }, r: 2.2, label: 'couch', toast: 'warm inside 🛋️',
      },
      {
        id: 'bench', eye: new THREE.Vector3(13.5, 1.08, -15.5), yaw: 0,
        body: { x: 13.5, y: 0.15, z: -15.5, rot: 0 },
        stand: new THREE.Vector3(13.5, 1.7, -14.4),
        near: { x: 13.5, z: -15.5 }, r: 2.0, label: 'overlook bench', toast: 'the whole lake, all yours 🌌',
      },
      {
        id: 'dock-end', eye: new THREE.Vector3(0, 1.32, -33.8), yaw: 0,
        body: { x: 0, y: 0.35, z: -33.8, rot: 0 },
        stand: new THREE.Vector3(0, 1.7, -32.6),
        near: { x: 0, z: -33.2 }, r: 1.9, label: 'dock end', toast: 'feet over the water 🎣',
      },
      {
        id: 'swing', eye: new THREE.Vector3(3.6, 1.18, 3.4), yaw: 0,
        body: { x: 3.6, y: 0.1, z: 3.4, rot: 0 },
        stand: new THREE.Vector3(3.6, 1.7, 2.4),
        near: { x: 3.6, z: 3.4 }, r: 1.7, label: 'porch swing', toast: 'swinging gently 🌙',
      },
      {
        id: 'boat', eye: new THREE.Vector3(-3.5, 1.02, -27), yaw: 0,
        body: { x: -3.5, y: 0.1, z: -27, rot: 0 },
        stand: new THREE.Vector3(-0.5, 1.7, -27),
        near: { x: -0.7, z: -27 }, r: 1.9, label: 'rowboat', toast: 'rocking gently 🚣',
      },
    ];
    this.spot = this.spots[0];

    this.state = 'intro';
    this.standing = false;
    this.transit = null; // {t, from, to, fromYaw, toYaw, toStanding, spot}
    this.walkPos = this.spots[0].stand.clone();
    this.groundY = 0;
    this.bobPhase = 0;
    this.lastStep = 0;
    this.swingCooldown = 0;
    this.owlTimer = rnd(20, 40);
    this.quality = 0;
    this.idle = 0;
    this.toastTimer = 0;
    this.time = 0;
    this.last = performance.now();
    this.dockToastShown = false;
    this.fireToastShown = false;
    this.cabinToastShown = false;
    this.indoor = false;
    this.baseFov = this.world.camera.fov;
    // LONG NIGHT state
    this.chordIdx = 0;
    this.stationIdx = 0;
    this.hasRod = false;
    this.scopeOn = false;
    this.scopeTimer = 0;
    this.scopeCel = 0;
    this.roasting = false;
    this.roastT = 0;
    this.roastCooldown = 0;
    this.roastCount = 0;
    this.letterIdx = 0;
    this.fishCaught = 0;
    this.meteorsSeen = 0;
    this.lastMeteorT = -99;
    this.wishes = 0;
    this.photosTaken = 0;
    this.chordsPlayed = new Set();
    this.catsPetted = 0;
    this.tricks = 0;
    this.spotsVisited = new Set(['chair']);
    this.loonTimer = rnd(50, 100);
    this.napping = false;
    this.napT = 0;
    this.journalOpen = false;

    this.els['btn-start'].addEventListener('click', () => this.start());
    // fallback: clicking anywhere on the menu also starts (plus Enter key)
    this.els.intro.addEventListener('click', () => this.start());
    this.controls.onLockChange = (locked) => this.onLockChange(locked);
    this.world.renderer.domElement.addEventListener('click', () => {
      if (this.state !== 'intro' && !this.controls.isTouch) this.controls.requestLock();
    });
    if (this.controls.isTouch) {
      this.els['btn-act'].classList.remove('hidden');
      this.els['btn-act'].addEventListener('click', (e) => {
        e.preventDefault();
        this.pressE();
      });
    }
  }

  start() {
    if (this.state !== 'intro') return;
    try { this.els.intro.classList.add('hidden'); } catch (e) { console.error(e); }
    try { this.els.hud.classList.remove('hidden'); } catch (e) { console.error(e); }
    this.state = 'seated';
    this.spot = this.spots[0];
    try { this.controls.requestLock(); } catch (e) { /* ignore */ }
    try {
      this.audio.unlock();
      this.audio.startAmbience();
      this.audio.setRainLevel(this.rain.level);
    } catch (e) { console.error(e); }
    try { this.toast('storm over the lake — Biscuit is waiting 🐕'); } catch (e) { /* ignore */ }
  }

  onLockChange(locked) {
    if (!locked && this.state !== 'intro') {
      this.showPrompt('click to capture mouse');
    } else {
      this.hidePrompt();
    }
  }

  interactCandidates() {
    const c = [];
    for (const s of this.spots) {
      c.push({ kind: 'sit', spot: s, x: s.near.x, z: s.near.z, r: s.r, label: `sit (${s.label})` });
    }
    c.push({
      kind: 'door', x: DOOR_POS.x, z: DOOR_POS.z, r: 1.6,
      label: this.props.doorOpen ? 'close the door' : 'open the door',
    });
    c.push({
      kind: 'radio', x: RADIO_POS.x, z: RADIO_POS.z, r: 1.3,
      label: `radio (${STATIONS[this.stationIdx]})`,
    });
    c.push({ kind: 'noodle', x: NOODLE_POS.x, z: NOODLE_POS.z, r: 1.1, label: 'eat noodles' });
    c.push({
      kind: 'bowl', x: BOWL_POS.x, z: BOWL_POS.z, r: 1.2,
      label: this.life.bowlFilled ? 'call Biscuit to eat' : 'fill the dog bowl',
    });
    c.push({ kind: 'dog', x: this.dog.pos.x, z: this.dog.pos.z, r: 1.3, label: 'pet Biscuit' });
    return c;
  }

  nearestInteract() {
    let best = null;
    let bd = Infinity;
    for (const cand of this.interactCandidates()) {
      const d = Math.hypot(this.walkPos.x - cand.x, this.walkPos.z - cand.z);
      if (d < cand.r && d < bd) {
        best = cand;
        bd = d;
      }
    }
    return best;
  }

  // F-candidates: touch the world (guitar, rod, scope, mail, cat, owl,
  // fairy ring, roast, stove, books, paintings)
  fCandidates() {
    const c = [];
    const chord = CHORDS[this.chordIdx][1];
    c.push({ kind: 'guitar', x: GUITAR_POS.x, z: GUITAR_POS.z, r: 1.4, label: `strum ${chord} (1-6)` });
    if (!this.hasRod) {
      c.push({ kind: 'rod', x: ROD_POS.x, z: ROD_POS.z, r: 1.5, label: 'take the fishing rod' });
    } else {
      c.push({ kind: 'rodhint', x: ROD_POS.x, z: ROD_POS.z, r: 1.5, label: 'cast from the dock end' });
    }
    c.push({ kind: 'scope', x: TELESCOPE_POS.x, z: TELESCOPE_POS.z, r: 1.4, label: 'look through the telescope' });
    c.push({
      kind: 'mail', x: MAILBOX_POS.x, z: MAILBOX_POS.z, r: 1.3,
      label: this.letterIdx < LETTERS.length ? 'read the mail' : 'no more mail',
    });
    c.push({ kind: 'cat', x: CAT_POS.x, z: CAT_POS.z, r: 1.4, label: 'pet Miso' });
    c.push({ kind: 'owl', x: OWL_POS.x, z: OWL_POS.z, r: 1.6, label: 'watch the owl' });
    c.push({ kind: 'ring', x: RING_POS.x, z: RING_POS.z, r: 1.7, label: 'step into the fairy ring' });
    c.push({
      kind: 'roast', x: -8.5, z: -13, r: 2.6,
      label: this.roasting ? 'roasting…' : 'roast a marshmallow',
    });
    c.push({ kind: 'stove', x: -3.0, z: 6.6, r: 1.3, label: 'the warm stove' });
    c.push({ kind: 'books', x: -2.9, z: 9.4, r: 1.1, label: 'browse the bookshelf' });
    c.push({ kind: 'art', x: 4.0, z: 9.7, r: 1.3, label: 'admire the paintings' });
    return c;
  }

  nearestF() {
    let best = null;
    let bd = Infinity;
    for (const cand of this.fCandidates()) {
      const d = Math.hypot(this.walkPos.x - cand.x, this.walkPos.z - cand.z);
      if (d < cand.r && d < bd) {
        best = cand;
        bd = d;
      }
    }
    return best;
  }

  fishZone() {
    return this.hasRod && !this.scopeOn && this.walkPos.z < -30 && Math.abs(this.walkPos.x) < 1.6;
  }

  pressF() {
    if (this.state !== 'standing' || this.napping || this.journalOpen) return;
    if (this.scopeOn) {
      this.toggleScope();
      return;
    }
    if (this.fishZone()) {
      this.fishing.press();
      return;
    }
    const it = this.nearestF();
    if (!it) {
      // wish on a falling star
      if (this.time - this.lastMeteorT < 5) {
        this.wishes++;
        this.audio.chime();
        this.toast('you make a wish 🌠');
      }
      return;
    }
    if (it.kind === 'guitar') {
      const [code, name] = CHORDS[this.chordIdx];
      this.audio.strum(code);
      this.attractions.strum();
      this.chordsPlayed.add(name);
      this.toast(`${name} 🎸`);
    } else if (it.kind === 'rod') {
      this.hasRod = true;
      this.audio.click();
      this.toast('fishing rod — cast from the dock end (F) 🎣');
    } else if (it.kind === 'rodhint') {
      this.toast('cast from the dock end 🎣');
    } else if (it.kind === 'scope') {
      this.toggleScope();
    } else if (it.kind === 'mail') {
      const text = this.attractions.readLetter();
      if (text) {
        this.letterIdx++;
        this.audio.click();
        this.toast(text, 5);
      } else {
        this.toast('no more mail 📭');
      }
    } else if (it.kind === 'cat') {
      this.cat.nuzzle();
      this.audio.purr();
      this.catsPetted++;
      this.toast(CAT_TOASTS[(Math.random() * CAT_TOASTS.length) | 0]);
    } else if (it.kind === 'owl') {
      this.owl.perk();
      this.audio.hoot();
      this.toast('the owl blinks at you 🦉');
    } else if (it.kind === 'ring') {
      this.ring.burst();
      this.audio.chime();
      this.toast('you step into the fairy ring 🧚');
    } else if (it.kind === 'roast') {
      if (!this.roasting && this.roastCooldown <= 0) {
        this.roasting = true;
        this.roastT = 2.5;
        this.fire.boost = 22;
        this.audio.sizzle();
        this.toast("roasting… don't burn it! 🔥");
      }
    } else if (it.kind === 'stove') {
      this.audio.chime();
      this.toast('the kettle hums on the stove 🫖');
    } else if (it.kind === 'books') {
      this.audio.click();
      this.toast(`you pull out ${BOOKS[(Math.random() * BOOKS.length) | 0]} 📖`);
    } else if (it.kind === 'art') {
      this.toast(Math.random() < 0.5
        ? 'a lake at dusk, painted years ago 🎨'
        : 'someone loved this place 🏡');
    }
  }

  toggleScope() {
    this.scopeOn = !this.scopeOn;
    if (this.scopeOn) {
      // snap the view toward Saturn, then free-look
      const twoPi = Math.PI * 2;
      this.controls.lookYaw = -0.214 + Math.round((this.controls.lookYaw + 0.214) / twoPi) * twoPi;
      this.controls.lookPitch = 0.28;
      this.scopeTimer = 2.5;
      this.scopeCel = 0;
      this.attractions.showSaturn(true);
      this.toast('🔭 …', 2);
    } else {
      this.attractions.showSaturn(false);
      this.world.camera.fov = this.baseFov;
      this.world.camera.updateProjectionMatrix();
    }
  }

  takePhoto() {
    if (this.state === 'intro') return;
    this.photosTaken++;
    this.audio.click();
    const f = this.els.flash;
    f.style.transition = 'none';
    f.style.opacity = '0.9';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.6s';
      f.style.opacity = '0';
    });
    this.toast(`📸 memory no. ${this.photosTaken} saved`);
  }

  toggleJournal() {
    if (this.state === 'intro') return;
    this.journalOpen = !this.journalOpen;
    if (this.journalOpen) this.renderJournal();
    this.els.journal.classList.toggle('hidden', !this.journalOpen);
  }

  renderJournal() {
    const chordStr = CHORDS.map((c) => (
      this.chordsPlayed.has(c[1]) ? c[1] : '<span class="dim">?</span>'
    )).join(' ');
    this.els.journal.innerHTML = `
      <h3>🌙 NIGHT JOURNAL</h3>
      🐟 fish caught: ${this.fishCaught}<br>
      💌 letters read: ${this.letterIdx}/${LETTERS.length}<br>
      📸 photos: ${this.photosTaken}<br>
      🌠 meteors: ${this.meteorsSeen} · wishes: ${this.wishes}<br>
      🍡 marshmallows: ${this.roastCount}<br>
      🐈 Miso pets: ${this.catsPetted}<br>
      🐕 Biscuit tricks: ${this.tricks}<br>
      🎸 chords: ${chordStr}<br>
      🪑 seats found: ${this.spotsVisited.size}/${this.spots.length}<br>
      <span class="dim">J to close</span>`;
  }

  startNap() {
    if (this.state !== 'seated' || this.spot.id !== 'couch' || this.napping) return;
    this.napping = true;
    this.napT = 4;
    this.els.fade.style.opacity = '1';
    this.toast('you doze off… 😴', 3.5);
  }

  surfaceAt(x, z) {
    if (Math.abs(x) <= 7 && z >= -3 && z <= 5) return 'wood';       // porch deck
    if (z < -21.8 && Math.abs(x) < 0.9) return 'wood';              // dock
    if (x > -3.55 && x < 5.85 && z > 5.75 && z < 10.35) return 'wood'; // cabin floor
    if (Math.hypot(x + 8.5, z + 13) < 2) return 'dirt';             // fire ash
    return 'grass';
  }

  isIndoor() {
    const p = this.world.camera.position;
    return p.z > 5.7 && p.z < 10.4 && p.x > -3.6 && p.x < 5.9;
  }

  isUnderPorch() {
    const p = this.world.camera.position;
    return Math.abs(p.x) < 7.6 && p.z > -3.9 && p.z < 5.9 && p.y < 2.9;
  }

  pressE() {
    if (this.scopeOn) {
      this.toggleScope();
      return;
    }
    if (this.state === 'seated') {
      const yaw = this.controls.lookYaw;
      this.transit = {
        t: 0, from: this.spot.eye.clone(), to: this.spot.stand.clone(),
        fromYaw: yaw, toYaw: yaw, toStanding: true, spot: this.spot,
      };
      this.state = 'moving';
    } else if (this.state === 'standing') {
      const it = this.nearestInteract();
      if (!it) return;
      if (it.kind === 'sit') {
        const s = it.spot;
        const cur = this.controls.lookYaw;
        const twoPi = Math.PI * 2;
        const flat = s.yaw + Math.round((cur - s.yaw) / twoPi) * twoPi;
        this.body.sitAt(s.body.x, s.body.y, s.body.z, s.body.rot);
        this.transit = {
          t: 0, from: this.world.camera.position.clone(), to: s.eye.clone(),
          fromYaw: cur, toYaw: flat, toStanding: false, spot: s,
        };
        this.state = 'moving';
      } else if (it.kind === 'door') {
        const open = this.props.toggleDoor();
        this.audio.thunk();
        this.toast(open ? 'the cabin door creaks open 🚪' : 'door closed');
      } else if (it.kind === 'radio') {
        this.stationIdx = (this.stationIdx + 1) % STATIONS.length;
        const st = STATIONS[this.stationIdx];
        if ((st !== 'off') !== this.life.radioOn) this.life.toggleRadio();
        this.audio.setStation(st);
        this.audio.click();
        this.toast(STATION_TOASTS[this.stationIdx]);
      } else if (it.kind === 'noodle') {
        if (this.life.noodlesEaten) {
          this.toast('all gone… more soon 🍜');
        } else {
          this.life.eatNoodles();
          this.audio.munch();
          this.toast(NOODLE_TOASTS[(Math.random() * NOODLE_TOASTS.length) | 0]);
        }
      } else if (it.kind === 'bowl') {
        if (!this.life.bowlFilled) {
          this.life.fillBowl();
          this.audio.kibble();
          this.toast('kibble for Biscuit 🦴');
        } else {
          this.toast('come eat, Biscuit! 🦴');
        }
        this.dog.startEat();
      } else if (it.kind === 'dog') {
        this.dog.pet();
        this.toast(PET_TOASTS[(Math.random() * PET_TOASTS.length) | 0]);
      }
    }
  }

  setQuality(q) {
    this.quality = q;
    const pr = [Math.min(window.devicePixelRatio || 1, 2), 1.5, 1.25][q];
    const bloom = [0.45, 0.35, 0.25][q];
    const sh = [[512, 512, 1024], [512, 512, 1024], [256, 256, 512]][q];
    this.world.renderer.setPixelRatio(pr);
    this.postfx.composer.setPixelRatio(pr);
    this.postfx.setSize(window.innerWidth, window.innerHeight);
    this.postfx.bloom.strength = bloom;
    const lights = [this.porch.lamp, this.fire.light, this.world.moon];
    lights.forEach((light, i) => {
      light.shadow.mapSize.set(sh[i], sh[i]);
      if (light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    });
    this.toast(`graphics: ${QUALITY[q]} ✨`);
  }

  update(dt) {
    this.idle += dt;

    const jp = this.controls.justPressed;
    if (this.state === 'intro') {
      if (jp.has('Enter') || jp.has('Space')) this.start();
    } else if (!this.napping) {
      if ((jp.has('KeyE') || jp.has('Space')) && this.state !== 'moving') this.pressE();
      if (jp.has('KeyF') && this.state !== 'moving') this.pressF();
      if (jp.has('KeyR')) {
        this.rain.setLevel((this.rain.level + 2) % 3);
        this.audio.setRainLevel(this.rain.level);
        this.toast(RAIN_TOASTS[this.rain.level]);
      }
      if (jp.has('KeyL')) {
        const on = !this.porch.lampOn;
        this.porch.setLamp(on);
        this.props.setLights(on);
        this.cabin.setLights(on);
        this.moths.setOn(on);
        this.audio.click();
        this.toast(on ? 'lights on 💡' : 'lights off…');
      }
      if (jp.has('KeyM')) {
        const muted = this.audio.toggleMute();
        this.toast(muted ? 'muted 🔇' : 'sound on 🔊');
      }
      if (jp.has('KeyQ')) this.setQuality((this.quality + 1) % 3);
      if (jp.has('KeyP')) this.takePhoto();
      if (jp.has('KeyJ')) this.toggleJournal();
      if (jp.has('KeyZ')) this.startNap();
      if (jp.has('KeyG')) {
        this.audio.bark('happy');
        this.dog.pet();
        this.tricks++;
        this.toast('Biscuit says hello! 🐕');
      }
      if (jp.has('KeyT')) {
        const d = Math.hypot(this.walkPos.x - this.dog.pos.x, this.walkPos.z - this.dog.pos.z);
        if (d < 3.5) {
          this.dog.pet();
          this.audio.bark('happy');
          this.tricks++;
          this.toast('Biscuit shakes! 🐾');
        } else {
          this.toast('Biscuit is too far for tricks 🐕');
        }
      }
      for (let d = 1; d <= 6; d++) {
        if (jp.has(`Digit${d}`)) {
          this.chordIdx = d - 1;
          this.toast(`chord: ${CHORDS[this.chordIdx][1]} 🎸`);
        }
      }
    }

    if (this.state === 'seated') {
      this.world.camera.position.copy(this.spot.eye);
      if (this.spot.id === 'swing' && this.props.swing) {
        this.props.swing.rotation.x = Math.sin(this.time * 1.4) * 0.06;
      }
      if (this.spot.id === 'boat') {
        this.world.camera.position.y += Math.sin(this.time * 0.8) * 0.05;
        this.world.camera.position.x += Math.sin(this.time * 0.6 + 1) * 0.03;
      }
      this.applyLook(this.seatedPose());
    } else if (this.state === 'standing') {
      this.idle = 0;
      if (this.scopeOn) {
        // telescope: planted at the eyepiece, zoomed in, free-look
        this.world.camera.position.set(TELESCOPE_POS.x, 1.55, TELESCOPE_POS.z);
        this.applyLook(0);
        const cam = this.world.camera;
        if (Math.abs(cam.fov - 14) > 0.1) {
          cam.fov += (14 - cam.fov) * Math.min(1, dt * 4);
          cam.updateProjectionMatrix();
        }
        this.scopeTimer -= dt;
        if (this.scopeTimer <= 0) {
          this.scopeTimer = 7;
          this.toast(CELESTIALS[this.scopeCel % CELESTIALS.length], 4);
          this.scopeCel++;
        }
        if (!this.controls.locked) {
          this.showPrompt('click to capture mouse');
        } else {
          this.showPrompt('🔭 <b>F</b> — step back');
        }
      } else {
        const { f, s } = this.controls.moveInput();
        const yaw = this.controls.lookYaw;
        let dx = Math.sin(yaw) * -f + Math.cos(yaw) * s;
        let dz = Math.cos(yaw) * -f + Math.sin(yaw) * -s;
        const len = Math.hypot(dx, dz);
        if (len > 0.01) {
          dx = (dx / len) * Math.min(1, len);
          dz = (dz / len) * Math.min(1, len);
          this.walkPos.x += dx * WALK_SPEED * dt;
          this.walkPos.z += dz * WALK_SPEED * dt;
          this.bobPhase += dt * 7.5;
          const stepIdx = Math.floor(this.bobPhase / Math.PI);
          if (stepIdx !== this.lastStep) {
            this.lastStep = stepIdx;
            this.audio.step(this.surfaceAt(this.walkPos.x, this.walkPos.z));
            this.prints.step(this.walkPos.x, this.walkPos.z, yaw);
          }
        }
        this.walkPos.x = clamp(this.walkPos.x, YARD.x0, YARD.x1);
        this.walkPos.z = clamp(this.walkPos.z, YARD.z0, YARD.z1);
        this.collide(this.walkPos);
        // bump the swing and it sways
        this.swingCooldown -= dt;
        if (this.swingCooldown <= 0
          && Math.hypot(this.walkPos.x - 3.6, this.walkPos.z - 3.4) < 1.3
          && len > 0.01) {
          this.swingCooldown = 1.0;
          this.props.pushSwing(0.1);
        }
        const onDock = this.walkPos.z < -21.8 && Math.abs(this.walkPos.x) < 0.9;
        const targetGround = onDock ? 0.35 : 0;
        this.groundY += (targetGround - this.groundY) * Math.min(1, dt * 6);
        const bob = Math.sin(this.bobPhase) * 0.03 * (len > 0.01 ? 1 : 0);
        this.world.camera.position.set(this.walkPos.x, 1.7 + this.groundY + bob, this.walkPos.z);
        this.applyLook(0);
        if (onDock && this.walkPos.z < -32 && !this.dockToastShown) {
          this.dockToastShown = true;
          this.toast('the end of the dock. nice. 🎣');
        }
        if (!this.fireToastShown && this.fire.distTo(this.walkPos) < 3) {
          this.fireToastShown = true;
          this.toast('the campfire — E to sit on a log 🔥');
        }
        const it = this.nearestInteract();
        const parts = [];
        if (it) parts.push(`<b>E</b> — ${it.label}`);
        if (this.fishZone()) {
          parts.push(`<b>F</b> — ${this.fishing.label()}`);
        } else {
          const fit = this.nearestF();
          if (fit) parts.push(`<b>F</b> — ${fit.label}`);
        }
        if (!this.controls.locked) {
          this.showPrompt('click to capture mouse');
        } else if (parts.length) {
          this.showPrompt(parts.join(' · '));
        } else {
          this.hidePrompt();
        }
      }
    } else if (this.state === 'moving' && this.transit) {
      this.idle = 0;
      const tr = this.transit;
      tr.t += dt / TRANSIT_TIME;
      const k = smooth(clamp(tr.t, 0, 1));
      this.world.camera.position.lerpVectors(tr.from, tr.to, k);
      this.world.camera.position.y += Math.sin(k * Math.PI) * 0.06;
      this.controls.lookYaw = lerp(tr.fromYaw, tr.toYaw, k);
      this.controls.lookPitch = lerp(this.controls.lookPitch, 0, k);
      this.applyLook(0);
      if (tr.toStanding) this.body.setVisible(tr.t < 0.45);
      else this.body.setVisible(tr.t > 0.55);
      if (tr.t >= 1) {
        this.standing = tr.toStanding;
        this.walkPos.copy(tr.to);
        this.spot = tr.spot;
        this.state = this.standing ? 'standing' : 'seated';
        this.transit = null;
        if (!this.standing) {
          this.toast(this.spot.toast);
          this.spotsVisited.add(this.spot.id);
          if (this.spot.id === 'swing') this.props.pushSwing(0.15);
        }
      }
    } else if (this.state === 'intro') {
      // slow cinematic drift behind the menu
      this.world.camera.position.set(Math.sin(this.time * 0.1) * 0.4, 1.3, 3.4);
      this.world.camera.rotation.set(0, Math.sin(this.time * 0.07) * 0.2, 0);
    }

    // marshmallow roasting
    this.roastCooldown = Math.max(0, this.roastCooldown - dt);
    if (this.roasting) {
      if (this.fire.distTo(this.world.camera.position) > 3.5) {
        this.roasting = false;
        this.toast('you stepped away…');
      } else {
        this.roastT -= dt;
        if (this.roastT <= 0) {
          this.roasting = false;
          this.roastCooldown = 3;
          this.roastCount++;
          this.audio.munch();
          this.toast('perfectly golden 🍡');
        }
      }
    }

    // couch nap
    if (this.napping) {
      this.napT -= dt;
      if (this.napT <= 0) {
        this.napping = false;
        this.els.fade.style.opacity = '0';
        this.toast('you wake up refreshed 🌙');
      }
    }

    // a distant owl calls when the rain lets up — the fence owl perks up
    if (this.state !== 'intro' && this.rain.level === 0) {
      this.owlTimer -= dt;
      if (this.owlTimer <= 0) {
        this.owlTimer = rnd(45, 100);
        this.audio.hoot();
        this.owl.perk();
      }
      // and a loon calls across the lake
      this.loonTimer -= dt;
      if (this.loonTimer <= 0) {
        this.loonTimer = rnd(70, 140);
        this.audio.loon();
        this.toast('a loon calls across the lake 🌊');
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.els.toast.classList.add('hidden');
    }

    // shelter: rain fades under the porch roof, nearly gone inside the cabin
    const indoor = this.isIndoor();
    if (indoor !== this.indoor) {
      this.indoor = indoor;
      this.audio.setIndoor(indoor);
      if (indoor && !this.cabinToastShown) {
        this.cabinToastShown = true;
        this.toast('inside, warm and dry 🏠');
      }
    }
    const shelter = indoor ? 0.12 : this.isUnderPorch() ? 0.55 : 1;
    this.nature.update(dt, this.time);
    this.rain.update(this.time, this.world.camera.position, shelter);
    this.lake.update(dt, this.time, this.rain.on);
    this.sky.update(dt, this.time, this.rain.level, this.porch.lampOn);
    this.porch.update(this.time, dt, this.rain.on);
    this.props.update(this.time, dt);
    this.fire.update(dt, this.time);
    this.body.update(this.time);
    this.life.update(this.time, dt);
    this.cat.update(this.time, dt);
    this.owl.update(this.time, dt);
    this.ring.update(this.time, dt);
    this.attractions.update(dt);
    this.fishing.update(dt, this.time);
    this.boat.update(this.time);
    this.chimes.update(this.time, dt);
    this.prints.update(dt);
    this.moths.update(this.time);
    this.world.camera.getWorldDirection(this._camDir);
    this.breath.update(dt, this.world.camera.position, this._camDir);
    const couchSeated = this.state === 'seated' && this.spot.id === 'couch';
    this.dog.update(
      dt, this.time, this.walkPos, this.state === 'seated', couchSeated,
      BOWL_POS, this.life.bowlFilled, (p) => {
        p.x = clamp(p.x, YARD.x0, YARD.x1);
        p.z = clamp(p.z, YARD.z0, YARD.z1);
        this.collide(p);
      }
    );
    this.audio.updateFire(dt, this.fire.distTo(this.world.camera.position));
    this.audio.updateFrogs(dt, this.rain.level === 0
      ? (this.world.camera.position.z < -18 ? 0.4 : 0.15)
      : 0);

    // NOTE: clear pressed-keys LAST — reading justPressed above must see this frame's taps.
    // Clearing earlier (or never) makes E/R/L stick forever. This was the v1 "stuck keys" bug.
    this.controls.lateUpdate();
  }

  seatedPose() {
    // lean: look down raises knees into view, tiny weight sway over time
    const c = this.controls;
    const lean = clamp(-c.lookPitch, 0, 1.25) * 0.12;
    this.world.camera.position.y += lean;
    const sway = Math.sin(this.time * 0.5) * 0.008;
    this.world.camera.position.x += sway;
    return 0;
  }

  applyLook(roll) {
    this.world.camera.rotation.set(
      this.controls.lookPitch, this.controls.lookYaw, roll
    );
  }

  collide(p) {
    for (const b of this.boxes) {
      const cx = clamp(p.x, b.x0, b.x1);
      const cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < 0.28) {
        if (d > 0.0001) {
          p.x = cx + (dx / d) * 0.28;
          p.z = cz + (dz / d) * 0.28;
        } else {
          p.z = b.z1 + 0.28;
        }
      }
    }
    for (const c of this.circles) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 0.0001) {
        p.x = c.x + (dx / d) * c.r;
        p.z = c.z + (dz / d) * c.r;
      }
    }
  }

  render() {
    this.postfx.render(this.time);
  }

  run() {
    const frame = () => {
      requestAnimationFrame(frame);
      const now = performance.now();
      let dt = (now - this.last) / 1000;
      this.last = now;
      dt = Math.min(dt, 0.05);
      this.time += dt;
      this.update(dt);
      this.render();
    };
    frame();
  }

  showPrompt(html) {
    const p = this.els.prompt;
    if (p.innerHTML !== html) p.innerHTML = html;
    p.classList.remove('hidden');
  }

  hidePrompt() {
    this.els.prompt.classList.add('hidden');
  }

  toast(text, dur = 2.5) {
    this.els.toast.textContent = text;
    this.els.toast.classList.remove('hidden');
    this.toastTimer = dur;
  }
}
