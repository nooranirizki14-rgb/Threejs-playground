import * as THREE from 'three';
import { World } from './world.js';
import { Controls } from './controls.js';
import { Porch } from './porch.js';
import { Body } from './body.js';
import { Nature } from './nature.js';
import { Rain } from './rain.js';
import { clamp, lerp, smooth } from './utils.js';

// SIT — sit on a chair on a rainy porch, look around, stand, walk, sit back.
// States: 'intro' -> 'seated' <-> 'moving' (sit/stand transition) | 'standing' (walk).
const EYE_SEATED = new THREE.Vector3(0, 1.22, 2.6);
const STAND_SPOT = new THREE.Vector3(1.0, 1.7, 2.75);
const YARD = { x0: -12, x1: 12, z0: -22, z1: 7 };
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

    this.state = 'intro';
    this.standing = false;
    this.transit = null; // {t, from, to, fromYaw, toYaw, toStanding}
    this.walkPos = new THREE.Vector3().copy(STAND_SPOT);
    this.bobPhase = 0;
    this.idle = 0;
    this.toastTimer = 0;
    this.time = 0;
    this.last = performance.now();

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
    this.toast('look around — E to stand up');
  }

  onLockChange(locked) {
    if (!locked && this.state !== 'intro') {
      this.showPrompt('click to capture mouse');
    } else {
      this.hidePrompt();
    }
  }

  pressE() {
    if (this.state === 'seated') {
      this.transit = {
        t: 0, from: EYE_SEATED.clone(), to: STAND_SPOT.clone(),
        fromYaw: 0, toYaw: 0, toStanding: true,
      };
      this.state = 'moving';
    } else if (this.state === 'standing') {
      this.transit = {
        t: 0, from: this.world.camera.position.clone(), to: EYE_SEATED.clone(),
        fromYaw: this.controls.lookYaw, toYaw: this.yawToChair(), toStanding: false,
      };
      this.state = 'moving';
    }
  }

  yawToChair() {
    const dx = 0 - this.walkPos.x;
    const dz = 2.6 - this.walkPos.z;
    let target = Math.atan2(-dx, -dz);
    const cur = this.controls.lookYaw;
    while (target - cur > Math.PI) target -= Math.PI * 2;
    while (target - cur < -Math.PI) target += Math.PI * 2;
    return target;
  }

  update(dt) {
    this.idle += dt;

    const jp = this.controls.justPressed;
    if (this.state !== 'intro') {
      if ((jp.has('KeyE') || jp.has('Space')) && this.state !== 'moving') this.pressE();
      if (jp.has('KeyR')) {
        this.rain.setOn(!this.rain.on);
        this.toast(this.rain.on ? 'rain returns 🌧️' : 'rain fades away…');
      }
      if (jp.has('KeyL')) {
        this.porch.setLamp(!this.porch.lampOn);
        this.toast(this.porch.lampOn ? 'lamp on 💡' : 'lamp off…');
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
      const bob = Math.sin(this.bobPhase) * 0.03 * (len > 0.01 ? 1 : 0);
      this.world.camera.position.set(this.walkPos.x, 1.7 + bob, this.walkPos.z);
      this.applyLook(0);
      const near = Math.hypot(this.walkPos.x - 0, this.walkPos.z - 2.6) < 2.2;
      if (near && this.controls.locked) {
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
    for (const b of this.porch.boxes) {
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
    for (const c of this.porch.circles) {
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
