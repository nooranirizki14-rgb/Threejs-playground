import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { Particles } from './particles.js';
import { SoundFX } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Game {
  constructor() {
    this.world = new World($('game-container'));
    this.player = new Player(this.world.scene);
    this.obstacles = new ObstacleManager(this.world.scene);
    this.trail = new Particles(this.world.scene, { max: 500, size: 0.16 });
    this.bursts = new Particles(this.world.scene, { max: 800, size: 0.24 });
    this.sfx = new SoundFX();

    this.state = 'menu'; // menu | playing | paused | dying | gameover
    this.best = parseInt(localStorage.getItem('neon-rush-best') || '0', 10) || 0;
    this.hooks = {
      coin: (pos) => this.onCoin(pos),
      crash: (pos) => this.onCrash(pos),
    };
    this.reset();

    this.camPos = new THREE.Vector3(0, 4.6, 8);
    this.lastTime = performance.now();
    this.hudTimer = 0;
    this.trailTimer = 0;
    this.trailFlip = false;
    this.shake = 0;
    this.dyingTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;

    this.bindInput();
    this.bindUI();
    $('menu-best').textContent = this.best;
    $('hud-best').textContent = this.best;
    this.updateMuteButtons();
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch');
    }
  }

  reset() {
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.elapsed = 0;
    this.speed = 18;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.player.reset();
    this.obstacles.reset();
    this.trail.clear();
    this.bursts.clear();
  }

  // ---------------- state changes ----------------
  startGame() {
    if (document.activeElement) document.activeElement.blur();
    this.sfx.ensure();
    this.sfx.click();
    this.reset();
    this.state = 'playing';
    this.showOverlay(null);
    $('hud').classList.remove('hidden');
    this.flash('GO!');
    this.sfx.go();
    this.updateHUD();
  }

  togglePause(forcePause = false) {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.showOverlay('pause');
      this.sfx.click();
    } else if (this.state === 'paused' && !forcePause) {
      this.state = 'playing';
      this.showOverlay(null);
      this.sfx.ensure();
      this.sfx.click();
    }
  }

  toMenu() {
    this.sfx.click();
    this.reset();
    this.state = 'menu';
    $('hud').classList.add('hidden');
    $('menu-best').textContent = this.best;
    this.showOverlay('menu');
  }

  onCrash() {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.dyingTimer = 1.2;
    const p = this.player.group.position;
    this.bursts.spawn(p.x, 0.9, 0, {
      count: 90, color: 0xffe08a, color2: 0xff2200,
      speed: 13, life: 1.1, gravity: 9, drag: 1.6,
    });
    this.bursts.spawn(p.x, 0.9, 0, {
      count: 30, color: 0x00eeff, color2: 0xff2fd6,
      speed: 8, life: 0.8, gravity: 4,
    });
    this.player.hide();
    this.shake = 1.5;
    this.sfx.crash();
    if (navigator.vibrate) navigator.vibrate(120);
  }

  onCoin(pos) {
    this.coins++;
    if (this.comboTimer > 0) this.combo++;
    else this.combo = 0;
    this.comboTimer = 1.2;
    this.sfx.coin(this.combo);
    this.bursts.spawn(pos.x, pos.y, pos.z, {
      count: 12, color: 0xffd94d, color2: 0xffffff,
      speed: 4.5, life: 0.5, gravity: 6,
    });
    this.updateHUD();
  }

  showGameOver() {
    this.state = 'gameover';
    const isBest = this.score > this.best;
    if (isBest) {
      this.best = this.score;
      localStorage.setItem('neon-rush-best', String(this.best));
    }
    $('final-score').textContent = this.score;
    $('final-best').textContent = this.best;
    $('final-coins').textContent = this.coins;
    $('final-dist').textContent = Math.floor(this.distance) + 'm';
    $('newbest').classList.toggle('hidden', !isBest);
    $('hud-best').textContent = this.best;
    this.showOverlay('gameover');
    this.sfx.gameover();
  }

  showOverlay(name) {
    for (const id of ['menu', 'gameover', 'pause']) {
      $(id).classList.toggle('hidden', id !== name);
    }
  }

  flash(text) {
    const el = $('flash');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
  }

  // ---------------- main loop ----------------
  run() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.update(dt, now / 1000);
      this.world.render();
    };
    requestAnimationFrame(loop);
  }

  update(dt, t) {
    if (this.state === 'paused') return;

    if (this.state === 'menu') {
      // attract mode: world scrolls behind the menu
      this.world.update(dt, 10);
      this.obstacles.update(dt, 10, this.player, this.hooks, false);
      this.player.update(dt, 0, true);
      this.trail.update(dt);
      this.bursts.update(dt);
      this.camPos.set(Math.sin(t * 0.4) * 2.2, 4.6 + Math.sin(t * 0.7) * 0.3, 8);
      this.applyCamera(0);
      return;
    }

    if (this.state === 'playing') {
      this.elapsed += dt;
      this.speed = Math.min(18 + this.elapsed * 0.5, 46);
      this.distance += this.speed * dt;
      this.score = Math.floor(this.distance) + this.coins * 25;
      if (this.comboTimer > 0) this.comboTimer -= dt;

      const evt = this.player.update(dt, this.speed, false);
      if (evt === 'land') {
        const p = this.player.group.position;
        this.bursts.spawn(p.x, 0.25, 0.3, {
          count: 8, color: 0x8f7bff, speed: 2.5, life: 0.4, gravity: 3,
        });
        this.sfx.land();
      }
      this.obstacles.update(dt, this.speed, this.player, this.hooks, true);

      // engine trail
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.018;
        this.trailFlip = !this.trailFlip;
        const p = this.player.group.position;
        this.trail.spawn(
          p.x + (Math.random() - 0.5) * 0.5,
          0.5 + p.y + Math.random() * 0.2,
          1.0,
          {
            count: 2, color: this.trailFlip ? 0x00eeff : 0xff2fd6,
            speed: 1.2, life: 0.45, gravity: -0.5, drag: 1,
            bias: [0, 0.6, 5],
          }
        );
      }

      this.world.update(dt, this.speed);
      this.trail.update(dt);
      this.bursts.update(dt);

      // chase camera
      const p = this.player.group.position;
      this.camPos.x += (p.x * 0.4 - this.camPos.x) * Math.min(1, dt * 6);
      this.camPos.y += ((4.4 + p.y * 0.3) - this.camPos.y) * Math.min(1, dt * 6);
      this.camPos.z = 8;
      this.applyCamera(p.x * 0.5);

      // speed FOV kick
      const targetFov = 68 + (this.speed - 18) * 0.45;
      this.world.camera.fov += (targetFov - this.world.camera.fov) * Math.min(1, dt * 3);
      this.world.camera.updateProjectionMatrix();

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.1;
        this.updateHUD();
      }
      return;
    }

    if (this.state === 'dying') {
      this.speed = Math.max(0, this.speed - 55 * dt);
      this.obstacles.update(dt, this.speed, this.player, this.hooks, false);
      this.world.update(dt, this.speed);
      this.trail.update(dt);
      this.bursts.update(dt);
      this.shake = Math.max(0, this.shake - dt * 2.2);
      this.applyCamera(0);
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) this.showGameOver();
      return;
    }

    // gameover: frozen wreck scene, particles settle, coins keep spinning
    this.obstacles.update(dt, 0, this.player, this.hooks, false);
    this.world.update(dt, 0);
    this.trail.update(dt);
    this.bursts.update(dt);
    this.applyCamera(0);
  }

  applyCamera(lookX) {
    const cam = this.world.camera;
    const s = this.shake;
    cam.position.set(
      this.camPos.x + (s > 0 ? (Math.random() - 0.5) * s : 0),
      this.camPos.y + (s > 0 ? (Math.random() - 0.5) * s : 0),
      this.camPos.z
    );
    cam.lookAt(lookX, 1.3, -10);
  }

  updateHUD() {
    $('hud-score').textContent = this.score;
    $('hud-coins').textContent = '◉ ' + this.coins;
    $('hud-speed').textContent = Math.round(this.speed * 6) + ' km/h';
    $('speed-fill').style.width = (clamp01((this.speed - 18) / 28) * 100).toFixed(1) + '%';
  }

  // ---------------- input ----------------
  doLane(dir) {
    this.player.move(dir);
    this.sfx.swoosh();
  }

  doJump() {
    if (this.player.jump()) this.sfx.jump();
  }

  doSlide() {
    if (this.player.slide()) this.sfx.slide();
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      const k = e.key;
      if (k === 'm' || k === 'M') { this.toggleMute(); return; }
      if (k === 'Enter') {
        if (this.state === 'menu' || this.state === 'gameover') this.startGame();
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'P') { this.togglePause(); return; }
      if (this.state === 'menu' && (k === ' ' || k === 'ArrowUp')) { this.startGame(); return; }
      if (this.state === 'gameover' && k === ' ') { this.startGame(); return; }
      if (this.state !== 'playing') return;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.doLane(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.doLane(1);
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') this.doJump();
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.doSlide();
    });

    // touch: swipe to steer / jump / slide, tap to jump
    const el = this.world.renderer.domElement;
    let tsx = 0, tsy = 0;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      tsx = t.clientX;
      tsy = t.clientY;
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.state !== 'playing') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tsx;
      const dy = t.clientY - tsy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Math.max(adx, ady) < 24) { this.doJump(); return; }
      if (adx > ady) this.doLane(dx > 0 ? 1 : -1);
      else if (dy < 0) this.doJump();
      else this.doSlide();
    }, { passive: false });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause(true);
    });
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => this.startGame());
    $('btn-restart').addEventListener('click', () => this.startGame());
    $('btn-restart2').addEventListener('click', () => this.startGame());
    $('btn-resume').addEventListener('click', () => this.togglePause());
    $('btn-menu').addEventListener('click', () => this.toMenu());
    $('btn-menu2').addEventListener('click', () => this.toMenu());
    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-mute').addEventListener('click', () => this.toggleMute());
  }

  toggleMute() {
    this.sfx.ensure();
    this.sfx.setMuted(!this.sfx.muted);
    this.updateMuteButtons();
    this.sfx.click();
  }

  updateMuteButtons() {
    $('btn-mute').textContent = this.sfx.muted ? '🔇' : '🔊';
  }
}
