import { Game } from './game.js';

function showBootError(err) {
  console.error('[MIDNIGHT DRIVE] boot failed:', err);
  const el = document.getElementById('boot-error');
  const msg = document.getElementById('boot-error-msg');
  if (msg) msg.textContent = String((err && err.message) || err);
  if (el) el.classList.remove('hidden');
  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('hidden');
}

async function boot() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load('900 100px Orbitron'),
          document.fonts.load('700 40px Rajdhani'),
        ]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
  } catch (e) { /* fall back to system fonts */ }

  try {
    // Friendly message instead of a black screen when WebGL is missing.
    const test = document.createElement('canvas');
    const gl = test.getContext('webgl2') || test.getContext('webgl');
    if (!gl) {
      throw new Error(
        'WebGL is not available. Use a recent Chrome / Edge / Firefox / Safari ' +
        'with hardware acceleration enabled.'
      );
    }
    const game = new Game();
    game.run();
  } catch (err) {
    showBootError(err);
  }
}

// If anything explodes very early (e.g. module load), still say something.
window.addEventListener('error', (e) => {
  if (!window.__mdBooted && e && e.message) {
    showBootError(e.message);
  }
});

boot();
