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
import { AudioEngine } from './audio.js';
import { clamp, lerp, smooth, rnd } from './utils.js';

// SIT: NIGHT PORCH — sit, explore, enter the cabin, feed the dog, radio on.
// E uses the nearest interactable: seats, door, radio, noodles, bowl, dog.
// States: 'intro' -> 'seated' <-> 'moving' (sit/stand) | 'standing' (walk).
const YARD = { x0: -17.4, x1: 17.4, z0: -34.2, z1: 10.2 };
const WALK_SPEED = 2.3;
const TRANSIT_TIME = 0.9;
const QUALITY = ['ULTRA', 'HIGH', 'BALANCED'];
const DOOR_POS = { x: 2.5, z: 4.9 };
const NOODLE_TOASTS = ['slurp 🍜', 'so good 🍜', 'midnight noodles hit different 🌙'];
const PET_TOASTS = ['good dog 🐕', 'Biscuit wags! 🐕', "who's a good boy? 🐕"];

export class Game {
  constructor() {
    this.els = {};
    for (const id of ['scene-container', 'intro', 'btn-start', 'hud', 'cross', 'prompt', 'toast', 'hint', 'btn-act']) {
      this.els[id] = document.getElementById(id);
    }

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
    this.postfx = new PostFX(this.world.renderer, this.world.scene, this.world.camera);
    this.audio = new AudioEngine();
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
    window.addEventListener('resize', () => {
      this.postfx.setSize(window.innerWidth, window.innerHeight);
    });

    this.boxes = [...this.porch.boxes, ...this.props.boxes, ...this.cabin.boxes];
    this.circles = [...this.porch.circles, ...this.props.circles, ...this.life.circles, ...this.cabin.circles];

    // sittable spots: porch chair, two fireside logs, cabin couch
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
      this.audio.setRain(this.rain.on);
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
      label: this.life.radioOn ? 'turn radio off' : 'turn radio on',
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
        const on = this.life.toggleRadio();
        this.audio.setRadio(on);
        this.audio.click();
        this.toast(on ? 'radio on 📻' : 'radio off');
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
    } else {
      if ((jp.has('KeyE') || jp.has('Space')) && this.state !== 'moving') this.pressE();
      if (jp.has('KeyR')) {
        this.rain.setOn(!this.rain.on);
        this.audio.setRain(this.rain.on);
        this.toast(this.rain.on ? 'rain returns 🌧️' : 'rain fades… fireflies soon ✨');
      }
      if (jp.has('KeyL')) {
        const on = !this.porch.lampOn;
        this.porch.setLamp(on);
        this.props.setLights(on);
        this.cabin.setLights(on);
        this.audio.click();
        this.toast(on ? 'lights on 💡' : 'lights off…');
      }
      if (jp.has('KeyM')) {
        const muted = this.audio.toggleMute();
        this.toast(muted ? 'muted 🔇' : 'sound on 🔊');
      }
      if (jp.has('KeyQ')) this.setQuality((this.quality + 1) % 3);
    }

    if (this.state === 'seated') {
      this.world.camera.position.copy(this.spot.eye);
      this.applyLook(this.seatedPose());
    } else if (this.state === 'standing') {
      this.idle = 0;
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
      if (it && this.controls.locked) {
        this.showPrompt(`<b>E</b> — ${it.label}`);
      } else if (!this.controls.locked) {
        this.showPrompt('click to capture mouse');
      } else {
        this.hidePrompt();
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
        if (!this.standing) this.toast(this.spot.toast);
      }
    } else if (this.state === 'intro') {
      // slow cinematic drift behind the menu
      this.world.camera.position.set(Math.sin(this.time * 0.1) * 0.4, 1.3, 3.4);
      this.world.camera.rotation.set(0, Math.sin(this.time * 0.07) * 0.2, 0);
    }

    // a distant owl calls when the rain lets up
    if (this.state !== 'intro' && !this.rain.on) {
      this.owlTimer -= dt;
      if (this.owlTimer <= 0) {
        this.owlTimer = rnd(45, 100);
        this.audio.hoot();
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
    this.sky.update(dt, this.time, this.rain.on, this.porch.lampOn);
    this.porch.update(this.time, dt, this.rain.on);
    this.props.update(this.time, dt);
    this.fire.update(dt, this.time);
    this.body.update(this.time);
    this.life.update(this.time, dt);
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

  toast(text) {
    this.els.toast.textContent = text;
    this.els.toast.classList.remove('hidden');
    this.toastTimer = 2.5;
  }
}
