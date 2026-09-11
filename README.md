# ⚡ NEON RUSH — Three.js Playground

A synthwave **3D endless runner** built from scratch with Three.js — no game engine, just code.
Dodge traffic, jump barriers, slide under blocks, thread wall gaps, and stack coins while the
speed keeps climbing. **100% self-contained: Three.js r160 is vendored in `vendor/`, zero CDN
dependencies for the game code** (only the optional Google Fonts need internet, with system
fallbacks).

## 🎮 Play it

This project uses ES modules + CDN imports, so it needs to be served over HTTP (not `file://`):

```bash
# option 1: python (easiest)
python3 -m http.server 8000

# option 2: node
npx serve .

# option 3: VS Code "Live Server" extension
```

Then open **http://localhost:8000** and hit **START ENGINE**.

## 🕹️ Controls

| Action | Keyboard | Touch |
|---|---|---|
| Steer | ◀ ▶ / A D | swipe left / right |
| Jump | ▲ / W / Space | swipe up / tap |
| Slide (or slam down mid-air) | ▼ / S | swipe down |
| Pause | P / Esc | ⏸ button |
| Mute | M | 🔊 button |

- 🟧 **Orange barriers** — jump them
- 🟪 **Purple blocks** — slide under them
- 🟥 **Pink walls** — get in the gap lane
- 🪙 **Coins** — +25 pts each, combo raises the pickup pitch 🎵

## ✨ What's inside (skills demo)

- **Custom GLSL shaders** — scrolling neon grid ground, striped synthwave sun
- **Player physics** — lane steering with lean, jump gravity, slide squash, fast-fall slam
- **Collision system** — height-aware hitboxes per obstacle type
- **Procedural spawner** — endless patterns that always leave a survivable path, difficulty scales with speed
- **Pooled particle engine** — engine trail, coin sparkles, landing dust, crash explosion (single draw call each)
- **Crash physics** — whatever you hit goes tumbling with velocity + spin
- **Synthesized audio** — all SFX generated with WebAudio oscillators/noise, zero assets
- **Game feel** — screen shake, FOV speed kick, slow-mo death, combo pitch, vibration on mobile
- **Full game shell** — animated attract-mode menu, HUD, pause, game-over stats, persistent best score
- **Performance** — instanced city rendering, shared geometries/materials, capped pixel ratio, mobile-ready

## 📁 Project structure

```
├── index.html          # game shell: HUD, menus, import map
├── css/style.css       # neon UI theme (Orbitron/Rajdhani, responsive + touch)
├── js/
│   ├── main.js         # entry point
│   ├── game.js         # orchestrator: states, loop, input, camera, scoring
│   ├── world.js        # renderer, lights, shaders, city, rings, stars, dust
│   ├── player.js       # hover-car model, movement + jump/slide physics
│   ├── obstacles.js    # spawner, collisions, coins, crash physics
│   ├── particles.js    # pooled GPU point-sprite particle system
│   └── audio.js        # WebAudio synth SFX (jump, coin combo, crash, jingles)
```

## 🚀 Roadmap ideas

- [ ] Power-ups (magnet, shield, slow-mo)
- [ ] More runners/vehicles to unlock
- [ ] Daily-seeded tracks + leaderboard
- [ ] Boss chase sequences
- [ ] A second game in the playground: FPS? racing? tower defense?

Built with [Three.js](https://threejs.org/) r160.
