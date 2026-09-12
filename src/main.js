import { Game } from './game.js';

function showBootError(err) {
  console.error('[SIT] boot failed:', err);
  const el = document.getElementById('boot-error');
  const msg = document.getElementById('boot-error-msg');
  if (msg) msg.textContent = String((err && err.message) || err);
  if (el) el.classList.remove('hidden');
  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('hidden');
}

function boot() {
  try {
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
    window.__sitBooted = true;
  } catch (err) {
    showBootError(err);
  }
}

window.addEventListener('error', (e) => {
  if (!window.__sitBooted && e && e.message) showBootError(e.message);
});

boot();
