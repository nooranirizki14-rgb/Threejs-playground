# ⚡ Three.js Playground

A collection of interactive 3D web experiences built from scratch with Three.js —
no game engine, just code.

## 🎮 The experiences

### 1. NEON RUSH — endless runner [`/`](./index.html)
A synthwave **3D endless runner**. Pilot a neon hover-car down an infinite grid
highway: steer, jump barriers, slide under blocks, thread wall gaps, stack coins.

- Custom GLSL shaders, player physics, collisions, procedural spawner
- Pooled GPU particles, WebAudio synth SFX, crash physics
- Keyboard + touch controls, HUD, pause, persistent best score

### 2. NEON RAIN — cyberpunk alley walkthrough [`/alley/`](./alley/index.html)
A cinematic **first-person walk through a rainy cyberpunk alley**, inspired by
[threejspunk.vercel.app](https://threejspunk.vercel.app/) (Anderson Mancini & Sunag).

- 🪞 **Wet-mirror streets** — custom planar reflector with puddle mask, animated
  ripple distortion and roughness blur
- 🌧️ **GPU rain** — 2,600 shader-animated streaks + expanding splash rings, zero CPU cost
- 🪧 **Neon Tokyo** — procedural canvas signs (ラーメン, カラオケ, 酒場…), flickering
  tubes, scrolling LED ticker, vending machines, hanging lanterns
- 🎬 **Film-grade post** — Unreal bloom + custom pass (lens distortion, chromatic
  aberration, teal-orange grade, vignette, grain) + MSAA + ACES
- ⚡ **Living city** — lightning + synthesized thunder, steam vents, flying traffic,
  endless recycling street, pointer-lock walk / mobile joystick

### 3. 🌙 MIDNIGHT DRIVE — eternal night haul [`/drive/`](./drive/README.md)
A chill **first-person midnight driving sim**: RHD cockpit, rain + wipers,
fuel runs with a rear fuel flap, motels that save, breakdowns, upgrades,
hitchhikers, procedural radio, auto-drive. No ending — just the road.
**Powered by Vite** — see [drive/README.md](./drive/README.md).

## ▶️ Run it

ES modules need HTTP (not `file://`):

```bash
# NEON RUSH + NEON RAIN (zero install, vendored three.js r160)
python3 -m http.server 8000
# open http://localhost:8000        -> NEON RUSH
# open http://localhost:8000/alley/ -> NEON RAIN

# MIDNIGHT DRIVE (needs Node 18+ for the Vite toolchain)
cd drive && npm install && npm run dev
# open http://localhost:5173        -> MIDNIGHT DRIVE
```

## 📁 Project structure

```
├── index.html          # NEON RUSH game shell
├── css/ js/            # NEON RUSH sources
├── alley/              # NEON RAIN walkthrough (own index.html + js/ + css/)
│   └── js/addons/      # vendored three.js examples (Reflector, post-processing)
├── drive/              # MIDNIGHT DRIVE (Vite app: package.json, js/, css/)
├── vendor/             # three.module.min.js r160 + license (rush + alley)
└── README.md
```

Built with [Three.js](https://threejs.org/).
