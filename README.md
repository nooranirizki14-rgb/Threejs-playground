# 🪑 SIT — a quiet night on the porch

First-person sitting on a wooden chair. A storm rolls over the lake, a
campfire crackles in the yard, lightning splits the mountains. Sit by the
fire, walk the dock, explore the yard. No goals.

Built with **Three.js + Vite**: shader lake with a moon glitter path, GPU
rain, lightning, mirror puddles, campfire with dancing shadows, bloom +
film-grain post-processing, real recorded sound.

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
| E / Space | Sit / stand (chair + two fireside logs) |
| WASD / arrows | Walk (when standing) |
| R | Toggle rain (crickets + fireflies when it stops) |
| L | Toggle lights (lamp, strings, window, lanterns, shed) |
| M | Mute / unmute sound |
| Touch | Left half = walk stick, right half = look drag, E button |

Walk off the porch, follow the stones to the **campfire** (E to sit on a
log), through the fence gate to the **dock**, or east to the **bench
overlook**. Thunder arrives late, like the real thing. 🔥

## Sound

Real recorded sound ships with the game — see
[`public/sfx/CREDITS.md`](public/sfx/CREDITS.md) for sources and licenses.

| File | Used as |
|---|---|
| `rain.mp3` | Rain loop |
| `thunder.mp3` | Thunder clap after each strike (delayed by distance) |
| `fire.mp3` | Campfire crackle (louder near the fire) |
| `crickets.mp3` | Night crickets (fade in when rain stops) |
| `click.mp3` | Lamp switch click |
| `step.mp3` / `step2.mp3` | Footsteps while walking |

Replace any file with your own recording — just keep the name. Missing
files are simply silent.

## Project structure

```
index.html          shell: intro overlay, HUD, prompts, toasts
src/style.css       normal serif-night styling (no neon)
src/main.js         boot + WebGL check + error overlay
src/utils.js        clamp / lerp / rnd / canvas helpers
src/world.js        renderer, camera, moonlight + shadows, fog
src/controls.js     keyboard + pointer-lock look + touch stick
src/porch.js        deck, roof, railings, lamp, string lights, table, chair
src/body.js         your seated body (chair + fireside logs)
src/nature.js       wet yard, grass, pines, mountains, stars, moon
src/lake.js         animated shader water + moon glitter path
src/rain.js         GPU rain streaks + splash rings
src/skyfx.js        sky dome, lightning, mist, fireflies, moths
src/props.js        cabin, swing, fence, paths, shed, bench, dock
src/firecamp.js     campfire: flames, sparks, smoke, shadow light, log seats
src/puddles.js      mirror puddles (real reflections)
src/postfx.js       bloom + vignette/grain cinematic chain
src/audio.js        real-sound engine: loops, distance fire, footsteps
src/game.js         states, sit/stand tweens, walking, collisions, UI
public/sfx/         real rain / thunder / fire / cricket / click / step mp3s
```

## Notes

- Three shadow lights: porch lamp, campfire, moon. One bloom pass.
- `npm run build` → static `dist/`, deployable anywhere.
