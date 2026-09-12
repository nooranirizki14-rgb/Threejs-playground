# 🪑 SIT — a quiet night on the porch

First-person sitting on a wooden chair. A storm rolls over the lake, warm
lamps glow, lightning splits the mountains. Look around, stand up, walk down
to the dock, sit back down. No goals.

Built with **Three.js + Vite**. Realistic night mood: shader lake with a
moon glitter path, GPU rain, lightning, lake mist, fireflies, lamp moths.

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
| E / Space | Stand up / sit back down (near the chair) |
| WASD / arrows | Walk (when standing) |
| R | Toggle rain (fireflies come out when it stops) |
| L | Toggle lights (lamp, string lights, window, dock lantern) |
| M | Mute / unmute sound |
| Touch | Left half = walk stick, right half = look drag, E button |

Walk off the porch, follow the stepping stones through the fence gate,
and out along the dock to the lantern.

## Sound (real recordings)

The game ships silent. To add sound, drop real recorded mp3s here:

```
public/sfx/rain.mp3     # loopable rain recording (stereo, a few seconds+)
public/sfx/thunder.mp3  # single thunder clap
public/sfx/click.mp3    # short lamp-switch click
```

Good sources: record rain on your own roof with a phone (best!), or
[Freesound](https://freesound.org) (check each sample's license).

## Project structure

```
index.html          shell: intro overlay, HUD, prompts, toasts
src/style.css       normal serif-night styling (no neon)
src/main.js         boot + WebGL check + error overlay
src/utils.js        clamp / lerp / rnd / canvas helpers
src/world.js        renderer, camera, moonlight, fog
src/controls.js     keyboard + pointer-lock look + touch stick
src/porch.js        deck, roof, railings, lamp, string lights, table, chair
src/body.js         your seated body (visible while sitting)
src/nature.js       yard grass, pines, mountains, stars, moon
src/lake.js         animated shader water + moon glitter path
src/rain.js         GPU rain streaks + splash rings
src/skyfx.js        sky dome, lightning, mist, fireflies, moths
src/props.js        cabin, swing, fence, stones, dock + lantern, trees
src/audio.js        real-mp3-first audio engine (silent fallback)
src/game.js         states, sit/stand tween, walking, collisions, UI
public/sfx/         your real rain / thunder / click mp3s live here
```

## Notes

- One shadow-casting light (the porch lamp); everything else is cheap.
- `npm run build` → static `dist/`, deployable anywhere.
