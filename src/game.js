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
import { AudioEngine } from './audio.js';
import { clamp, lerp, smooth } from './utils.js';

// SIT: NIGHT PORCH — sit on a chair, look at the storm, stand, walk to the dock.
// States: 'intro' -> 'seated' <-> 'moving' (sit/stand transition) | 'standing' (walk).
const EYE_SEATED = new THREE.Vector3(0, 1.22, 2.6);
const STAND_SPOT = new THREE.Vector3(1.0, 1.7, 2.75);
const YARD = { x0: -12, x1: 12, z0: -34.2, z1: 7 };
const WALK_SPEED = 2.3;
const TRANSIT_TIME = 0.9;

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
    this.audio = new AudioEngine();
    this.sky.onThunder = () => this.audio.thunder();

    this.boxes = [...this.porch.boxes, ...this.props.boxes];
    this.circles = [...this.porch.circles, ...this.props.circles];

    this.state = 'intro';
    this.standing = false;
    this.transit = null; // {t, from, to, fromYaw, toYaw, toStanding}
    this.walkPos = new THREE.Vector3().copy(STAND_SPOT);
    this.groundY = 0;
    this.bobPhase = 0;
    this.idle = 0;
    this.toastTimer = 0;
    this.time = 0;
    this.last = performance.now();
    this.dockToastShown = false;

    this.els['btn-start'].addEventListener('click', () => this.start());
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
    this.els.intro.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.state = 'seated';
    this.controls.requestLock();
    this.audio.unlock();
    this.audio.startRain();
    this.toast('storm over the lake — E to stand, walk to the dock');
  }

  onLockChange(locked) {
    if (!locked && this.state !== 'intro') {
      this.showPrompt('click to capture mouse');
    } else {
      this.hidePrompt();
    }
  }

  chairDist() {
    return Math.hypot(this.walkPos.x - 0, this.walkPos.z - 2.6);
  }

  pressE() {
    if (this.state === 'seated') {
      const yaw = this.controls.lookYaw;
      this.transit = {
        t: 0, from: EYE_SEATED.clone(), to: STAND_SPOT.clone(),
        fromYaw: yaw, toYaw: yaw, toStanding: true,
      };
      this.state = 'moving';
    } else if (this.state === 'standing') {
      if (this.chairDist() > 2.5) {
        this.toast('the chair is back on the porch 🪑');
        return;
      }
      const cur = this.controls.lookYaw;
      const flat = Math.round(cur / (Math.PI * 2)) * Math.PI * 2; // face the lake again
      this.transit = {
        t: 0, from: this.world.camera.position.clone(), to: EYE_SEATED.clone(),
        fromYaw: cur, toYaw: flat, toStanding: false,
      };
      this.state = 'moving';
    }
  }

  update(dt) {
    this.idle += dt;

    const jp = this.controls.justPressed;
    if (this.state !== 'intro') {
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
        this.audio.click();
        this.toast(on ? 'lights on 💡' : 'lights off…');
      }
      if (jp.has('KeyM')) {
        const muted = this.audio.toggleMute();
        this.toast(muted ? 'muted 🔇' : 'sound on 🔊');
      }
    }

    if (this.state === 'seated') {
      this.world.camera.position.copy(EYE_SEATED);
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
      }
      this.walkPos.x = clamp(this.walkPos.x, YARD.x0, YARD.x1);
      this.walkPos.z = clamp(this.walkPos.z, YARD.z0, YARD.z1);
      this.collide(this.walkPos);
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
      if (this.chairDist() < 2.2 && this.controls.locked) {
        this.showPrompt('<b>E</b> — sit back down');
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
        this.state = this.standing ? 'standing' : 'seated';
        this.transit = null;
        if (!this.standing) this.toast('ahh. much better 🪑');
      }
    } else if (this.state === 'intro') {
      // slow cinematic drift behind the menu
      this.world.camera.position.set(Math.sin(this.time * 0.1) * 0.4, 1.3, 3.4);
      this.world.camera.rotation.set(0, Math.sin(this.time * 0.07) * 0.2, 0);
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.els.toast.classList.add('hidden');
    }
    this.nature.update(dt);
    this.rain.update(this.time, this.world.camera.position);
    this.lake.update(dt, this.time, this.rain.on);
    this.sky.update(dt, this.time, this.rain.on, this.porch.lampOn);
    this.props.update(this.time);

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
    this.world.render();
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
