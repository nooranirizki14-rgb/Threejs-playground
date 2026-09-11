# ⚡ Three.js Playground

A collection of interactive 3D web experiences built from scratch with Three.js —
no game engine, just code. **Fully self-contained:** Three.js r160 is vendored in
`vendor/`, zero CDN dependencies for any of the 3D code.

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

## ▶️ Run it

ES modules need HTTP (not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000        -> NEON RUSH
# open http://localhost:8000/alley/ -> NEON RAIN
```

## 📁 Project structure

```
├── index.html          # NEON RUSH game shell
├── css/ js/            # NEON RUSH sources
├── alley/              # NEON RAIN walkthrough (own index.html + js/ + css/)
│   └── js/addons/      # vendored three.js examples (Reflector, post-processing)
├── vendor/             # three.module.min.js r160 + license
└── README.md
```

Built with [Three.js](https://threejs.org/) r160.
