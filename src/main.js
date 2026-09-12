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

// Runtime errors after boot: visible red toast so they can be screenshotted.
function showRuntimeError(msg) {
  console.error('[SIT] runtime:', msg);
  let t = document.getElementById('runtime-error');
  if (!t) {
    t = document.createElement('div');
    t.id = 'runtime-error';
    t.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99;max-width:90vw;background:rgba(60,8,8,0.92);color:#ffb3b3;border:1px solid #ff6b6b;border-radius:10px;padding:0.6rem 1rem;font:13px monospace;white-space:pre-wrap;word-break:break-word;';
    document.body.appendChild(t);
  }
  t.textContent = '⚠️ ' + String(msg).slice(0, 300);
}

window.addEventListener('error', (e) => {
  if (window.__sitBooted && e && e.message) showRuntimeError(e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (window.__sitBooted) {
    const r = e.reason;
    showRuntimeError('promise: ' + ((r && r.message) || r));
  }
});

boot();
