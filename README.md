# 🪑 SIT — a quiet night on the porch

First-person sitting on a wooden chair. Rainy night, warm lamp, lake and
mountains ahead. Look around, look down at your legs, stand up, walk the
yard, sit back down. That's it. That's the game.

## ▶️ Run it

Node 18+ required:

```bash
npm install   # one time
npm run dev   # open http://localhost:5173
```

Build for release: `npm run build` → `dist/` (static, works anywhere).

> Browsers block ES modules from `file://` — always serve over http.

## 🎮 Controls

| Input | Action |
|-------|--------|
| Mouse | look around (click captures cursor) |
| E | stand up / sit down |
| WASD | walk (when standing) |
| R | rain on/off |
| L | porch lamp on/off |
| Esc | free cursor |

Mobile: left-half drag = walk stick, right-half drag = look, **E** button
to sit/stand.

## 📁 Structure

```
index.html        # shell + UI overlay
src/style.css     # UI styling
src/main.js       # boot + crash overlay
src/game.js       # orchestrator: sit/stand/walk/loop
src/world.js      # renderer, camera, lights, fog
src/controls.js   # pointer-lock look, keys, touch
src/porch.js      # deck, roof, railing, lamp, table, chair
src/body.js       # seated legs/arms/torso
src/nature.js     # grass, trees, lake, mountains, stars, moon
src/rain.js       # GPU rain streaks + splash rings
src/utils.js      # math/canvas helpers
```

Built with [Three.js](https://threejs.org/) + Vite.
