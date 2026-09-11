import { Game } from './game.js';

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
  const game = new Game();
  game.run();
}

boot();
