# 🪑 SIT — a quiet night on the porch

Photorealistic first-person night on a porch. A storm rolls over the lake,
a campfire crackles in the yard, lightning splits the mountains. Sit by the
fire, open the cabin door, walk the dock, explore the yard. No goals.

Built with **Three.js + Vite**: full PBR materials (albedo + roughness +
normal), procedural HDRI environment, moon/fire/lamp shadows, contact AO,
shader lake with moon glitter, GPU rain, lightning through storm clouds,
mirror puddles, bloom + filmic grade, spatial-ish real sound.

## Run it

```bash
npm install
npm run dev     # → http://localhost:5173
```

Use a recent Chrome / Edge / Firefox with hardware acceleration.
Must be served over http — opening `index.html` from disk won't work.

## Controls

| Input | Action |
|---|---|
| Mouse | Look (click captures the pointer) |
| E / Space | Sit / stand (chair + two fireside logs), open cabin door |
| WASD / arrows | Walk (when standing) |
| R | Toggle rain (crickets + fireflies + owl when it stops) |
| L | Toggle lights (lamp, strings, window, lanterns, shed) |
| Q | Graphics quality: ULTRA → HIGH → BALANCED |
| M | Mute / unmute sound |
| Touch | Left half = walk stick, right half = look drag, E button |

Footsteps change with the surface (deck, dock, grass, fire ash). Bump the
porch swing and it sways. Thunder arrives late, like the real thing. 🔥

## Sound

Ships with the game — see [`public/sfx/CREDITS.md`](public/sfx/CREDITS.md)
for sources and licenses.

| File | Used as |
|---|---|
| `rain.mp3` | Rain loop |
| `thunder.mp3` | Thunder clap after each strike (delayed by distance) |
| `fire.mp3` | Campfire crackle (louder near the fire) |
| `crickets.mp3` | Night crickets (fade in when rain stops) |
| `wind.mp3` | Wind bed (always breathing underneath) |
| `hoot.mp3` | Distant owl (calls when rain stops) |
| `click.mp3` | Lamp switch click |
| `step.mp3` / `step2.mp3` | Footsteps on dirt/ash |
| `step_wood.mp3` | Footsteps on deck + dock |
| `step_grass.mp3` | Footsteps on grass |

Replace any file with your own recording — just keep the name. Missing
files are simply silent.

## Project structure

```
index.html          shell: intro overlay, HUD, prompts, toasts
src/style.css       normal serif-night styling (no neon)
src/main.js         boot + WebGL check + error overlay
src/utils.js        clamp / lerp / rnd / canvas helpers
src/textures.js     procedural PBR sets: wood, mud, bark, stone, plaid, denim
src/envmap.js       procedural night HDRI baked through PMREM
src/world.js        renderer, camera, moon + shadows, fill, fog, environment
src/controls.js     keyboard + pointer-lock look + touch stick
src/porch.js        PBR deck, lamp + volumetric cone, strings, table, steam, drips
src/body.js         your seated body: flannel, denim, breathing
src/nature.js       PBR ground, wind grass, pines, mountains, stars, moon
src/lake.js         animated shader water + moon glitter path
src/rain.js         GPU rain streaks + splash rings
src/skyfx.js        sky dome, storm clouds, lightning, mist, fireflies, moths
src/props.js        cabin + door, swing, fence, paths, shed, bench, dock, clutter
src/firecamp.js     campfire: flames, sparks, smoke, shadow light, log seats
src/puddles.js      mirror puddles (real reflections)
src/postfx.js       MSAA + bloom + filmic grade (split-tone, vignette, grain)
src/audio.js        loops, distance fire, surface steps, owl, thunder delay
src/game.js         states, sit/stand tweens, walking, quality scaler, UI
public/sfx/         11 real + crafted mp3s (see CREDITS.md)
```

## Notes

- Three shadow lights (lamp, campfire, moon) + contact AO blobs.
- Quality scaler (Q) adjusts pixel ratio, bloom, and shadow resolution.
- `npm run build` → static `dist/`, deployable anywhere.
