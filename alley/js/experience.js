import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CinematicShader } from './cinematic.js';
import { Alley } from './alley.js';
import { WetGround } from './wetground.js';
import { RainStreaks, SplashRings } from './rain.js';
import { Controls } from './controls.js';
import { RainAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Experience {
  constructor() {
    this.container = $('scene-container');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.baseFog = new THREE.Color(0x070418);
    this.scene.background = new THREE.Color().copy(this.baseFog);
    this.scene.fog = new THREE.FogExp2(0x070418, 0.026);

    this.camera = new THREE.PerspectiveCamera(
      62, window.innerWidth / window.innerHeight, 0.1, 500
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.7, 20);

    this.hemi = new THREE.HemisphereLight(0x33407a, 0x05030c, 0.55);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8899ff, 0.3);
    this.moon.position.set(-20, 40, -10);
    this.scene.add(this.moon);

    // post chain: render -> bloom -> film grade -> output (MSAA target)
    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      samples: 4, type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.72
    );
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(CinematicShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    // world
    this.alley = new Alley(this.scene);
    this.ground = new WetGround(this.scene);
    const lowPower = ('ontouchstart' in window) ||
      Math.min(window.innerWidth, window.innerHeight) < 700;
    this.rain = new RainStreaks(this.scene, { count: lowPower ? 1500 : 2600 });
    this.rings = new SplashRings(this.scene, { count: lowPower ? 220 : 350 });
    this.controls = new Controls(this.renderer.domElement);
    this.audio = new RainAudio();

    this.pos = new THREE.Vector3(0, 1.7, 20);
    this.bobPhase = 0;
    this.started = false;
    this.time = 0;

    // lightning
    this.nextFlash = 6 + Math.random() * 10;
    this.flashEnv = [];
    this.flash = 0;
    this.pendingThunder = -1;
    this.thunderIntensity = 1;

    this.clock = new THREE.Clock();
    this.frames = 0;
    this.fpsAt = performance.now();

    this.bindUI();
    this.controls.onLockChange = (locked) => {
      $('resume').classList.toggle('hidden', locked || !this.started || this.controls.isTouch);
    };
    this.controls.onAutoWalkChange = (v) => $('btn-auto').classList.toggle('active', v);

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clock.getDelta();
    });
    $('btn-mute').textContent = this.audio.muted ? '🔇' : '🔊';
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => this.start());
    $('resume').addEventListener('click', () => this.controls.requestLock());
    this.renderer.domElement.addEventListener('click', () => {
      if (this.started) this.controls.requestLock();
    });
    $('btn-mute').addEventListener('click', () => this.toggleMute());
    $('btn-reflect').addEventListener('click', () => {
      const on = !this.ground.withReflections;
      this.ground.setReflections(on);
      $('btn-reflect').classList.toggle('active', on);
    });
    $('btn-auto').addEventListener('click', () => {
      this.controls.setAutoWalk(!this.controls.autoWalk);
    });
    $('btn-bars').addEventListener('click', () => {
      const hidden = $('bar-top').classList.toggle('hidden');
      $('bar-bottom').classList.toggle('hidden', hidden);
      $('btn-bars').classList.toggle('active', !hidden);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
      if ((e.code === 'Enter' || e.code === 'Space') && !this.started) this.start();
    });
  }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    $('btn-mute').textContent = this.audio.muted ? '🔇' : '🔊';
  }

  start() {
    if (this.started) return;
    if (document.activeElement) document.activeElement.blur();
    this.started = true;
    this.controls.started = true;
    this.audio.ensure();
    this.audio.startRain();
    $('intro').classList.add('hidden');
    $('hint').classList.remove('hidden');
    this.controls.requestLock();
    setTimeout(() => $('hint').classList.add('hidden'), 9000);
  }

  run() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.composer.render();
      this.frames++;
      const now = performance.now();
      if (now - this.fpsAt > 500) {
        $('fps').textContent = Math.round((this.frames * 1000) / (now - this.fpsAt)) + ' fps';
        this.frames = 0;
        this.fpsAt = now;
      }
    };
    loop();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    if (!this.started) {
      // attract mode: slow dolly + sway behind the intro
      this.pos.z -= dt * 1.6;
      this.pos.x = Math.sin(t * 0.18) * 1.6;
      this.controls.yaw = Math.sin(t * 0.12) * 0.35;
      this.controls.pitch = -0.03 + Math.sin(t * 0.23) * 0.03;
      this.applyCamera(dt, 1.6);
    } else {
      const move = this.controls.getMove();
      if (move.manual && this.controls.autoWalk) this.controls.setAutoWalk(false);
      const speed = move.run ? 7.5 : 4.2;
      const f = move.f * speed;
      const s = move.s * speed;
      const sin = Math.sin(this.controls.yaw);
      const cos = Math.cos(this.controls.yaw);
      this.pos.x += (-sin * f + cos * s) * dt;
      this.pos.z += (-cos * f - sin * s) * dt;
      this.pos.x = clamp(this.pos.x, -6, 6);
      this.applyCamera(dt, Math.hypot(f, s));
    }

    this.ground.update(t, this.pos.z);
    this.rain.update(t, this.camera.position);
    this.rings.update(t, this.camera.position);
    this.alley.update(dt, t, this.pos.z);
    this.updateLightning(dt);
    this.grade.uniforms.uTime.value = t;
    this.grade.uniforms.uFlash.value = this.flash * 0.5;
  }

  applyCamera(dt, speed) {
    this.bobPhase += dt * (2.2 + speed * 1.35);
    const amt = Math.min(1, speed / 4);
    this.camera.position.set(
      this.pos.x,
      this.pos.y + Math.sin(this.bobPhase * 2) * 0.032 * amt,
      this.pos.z
    );
    this.camera.rotation.set(
      this.controls.pitch, this.controls.yaw,
      Math.sin(this.bobPhase) * 0.006 * amt
    );
  }

  updateLightning(dt) {
    this.nextFlash -= dt;
    if (this.nextFlash <= 0) {
      this.nextFlash = 10 + Math.random() * 22;
      const peak = 0.5 + Math.random() * 0.5;
      this.flashEnv.push({ t: 0, dur: 0.09, peak: peak * 0.7 });
      this.flashEnv.push({ t: -0.16, dur: 0.22, peak });
      this.pendingThunder = 0.7 + Math.random() * 1.8;
      this.thunderIntensity = 0.6 + Math.random() * 0.6;
    }
    let f = 0;
    for (let i = this.flashEnv.length - 1; i >= 0; i--) {
      const e = this.flashEnv[i];
      e.t += dt;
      if (e.t >= 0) {
        const k = e.t / e.dur;
        if (k >= 1) this.flashEnv.splice(i, 1);
        else f = Math.max(f, e.peak * Math.sin(Math.PI * k));
      }
    }
    this.flash = f;
    this.hemi.intensity = 0.55 + f * 2.2;
    this.moon.intensity = 0.3 + f * 1.4;
    this.scene.fog.color.copy(this.baseFog);
    this.scene.fog.color.r += f * 0.12;
    this.scene.fog.color.g += f * 0.14;
    this.scene.fog.color.b += f * 0.22;
    this.scene.background.copy(this.scene.fog.color);
    if (this.pendingThunder >= 0) {
      this.pendingThunder -= dt;
      if (this.pendingThunder < 0) this.audio.thunder(this.thunderIntensity);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
