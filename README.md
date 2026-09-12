# 🪑 SIT — a quiet night on the porch

Photorealistic first-person night on a porch. A storm rolls over the lake,
a campfire crackles, Biscuit the dog is waiting, noodles steam on the
porch, the radio hums. Sit by the fire, go inside and chill on the couch,
walk the dock, explore the yard. No goals.

Built with **Three.js + Vite**: full PBR materials, HDRI environment,
moon/fire/lamp shadows, contact AO, shader lake, cyber rain with gusts,
lightning through storm clouds, mirror puddles, bloom + filmic grade,
companion dog AI, 15 sounds.

## Run it

```bash
npm install
npm run dev     # → http://localhost:5173
```

Use a recent Chrome / Edge / Firefox with hardware acceleration.
Must be served over http — opening `index.html` from disk won't work.

If the menu ever seems stuck: hard-refresh the page. Any error will show
as a red message (screenshot it and report it).

## Controls

| Input | Action |
|---|---|
| Mouse | Look (click captures the pointer) |
| E / Space | Nearest interact: sit / stand, door, radio, noodles, dog bowl, pet dog |
| WASD / arrows | Walk (when standing) |
| R | Toggle rain (crickets + fireflies + owl when it stops) |
| L | Toggle lights (lamp, strings, window, lanterns, shed, cabin) |
| Q | Graphics quality: ULTRA → HIGH → BALANCED |
| M | Mute / unmute sound |
| Touch | Left half = walk stick, right half = look drag, E button |

Walk through the open cabin door and sit on the couch — Biscuit will curl
up on his bed. Fill his bowl and he'll run over to eat. Thunder startles
him (sorry, Biscuit). Rain fades under roofs and inside. 🐕

## Sound

Ships with the game — see [`public/sfx/CREDITS.md`](public/sfx/CREDITS.md)
for sources and licenses.

| File | Used as |
|---|---|
| `rain.mp3` | Rain loop (quieter indoors) |
| `thunder.mp3` | Thunder clap after each strike (delayed by distance) |
| `fire.mp3` | Campfire crackle (louder near the fire) |
| `crickets.mp3` | Night crickets (fade in when rain stops) |
| `wind.mp3` | Wind bed underneath everything |
| `hoot.mp3` | Distant owl (calls when rain stops) |
| `radio.mp3` | Warm late-night radio loop (toggle at the radio) |
| `bark.mp3` | Biscuit's bark |
| `munch.mp3` | Eating noodles |
| `kibble.mp3` | Pouring dog food |
| `click.mp3` | Lamp switch click |
| `step.mp3` / `step2.mp3` | Footsteps on dirt/ash |
| `step_wood.mp3` | Footsteps on deck + dock + cabin floor |
| `step_grass.mp3` | Footsteps on grass |

Replace any file with your own recording — just keep the name. Missing
files are simply silent.

## Project structure

```
index.html          shell: intro overlay, HUD, prompts, toasts, boot fallback
src/style.css       normal serif-night styling (no neon)
src/main.js         boot + WebGL check + error overlay + runtime error toast
src/utils.js        clamp / lerp / rnd / canvas helpers
src/textures.js     procedural PBR sets: wood, mud, bark, stone, plaid, denim
src/envmap.js       procedural night HDRI baked through PMREM
src/world.js        renderer, camera, moon + shadows, fill, fog, environment
src/controls.js     keyboard + pointer-lock look + touch stick
src/porch.js        PBR deck, lamp + cone, strings, table, steam, drips
src/body.js         your seated body: flannel, denim, breathing
src/nature.js       PBR ground, wind grass, pines, mountains, stars, moon
src/lake.js         animated shader water + moon glitter path
src/rain.js         cyber rain: gusts, bright rings, shelter fade
src/skyfx.js        sky dome, storm clouds, lightning, mist, fireflies, moths
src/props.js        cabin wall + door, swing, fence, paths, shed, bench, dock
src/firecamp.js     campfire: flames, sparks, smoke, shadow light, log seats
src/puddles.js      mirror puddles (real reflections)
src/dog.js          Biscuit: follow, wander, eat, sleep, startle, bark
src/porchlife.js    radio, noodle bowl, kibble bowl
src/cabin.js        enterable interior: couch, table, shelf, lamp, dog bed
src/postfx.js       MSAA + bloom + filmic grade (split-tone, vignette, grain)
src/audio.js        loops, distance fire, surface steps, radio, indoor muffle
src/game.js         states, interactions, dog wiring, shelter, quality, UI
public/sfx/         15 real + crafted mp3s (see CREDITS.md)
```

## Notes

- Three shadow lights (lamp, campfire, moon) + contact AO blobs.
- Quality scaler (Q) adjusts pixel ratio, bloom, and shadow resolution.
- `npm run build` → static `dist/`, deployable anywhere.

## v6 — LONG NIGHT mega-expansion 🌙

The homestead after dark, stuffed full:

- **Playable guitar** (porch post) — 6 Karplus-Strong chords (G C D Em Am F), keys 1-6 + F to strum, guitar wobbles
- **Dock fishing** — grab the rod, cast from the dock end, pull on the bite (10% old boot 🥾), catches tracked in the journal
- **Rowboat sit spot** — moored by the dock, gentle rocking
- **Telescope scope mode** — F to look, snaps to Saturn 🪐, zoomed FOV, celestial discovery toasts
- **Mailbox** — 5 letters, flag drops when done
- **Miso the cat** — meows on her own, purrs + happy tail-wag when petted (F)
- **Fence owl** — perks up and stares when owls call; admire with F
- **Fairy ring** — step in (F) for a glow burst + chime
- **Aurora + meteors** on clear skies, **F to wish** on a falling star 🌠
- **Wind chimes** — pentatonic, randomized by gust
- **Footprints + breath vapor** in the cold air
- **Marshmallow roasting** — F at the fire, fire flares, don't walk away
- **3-level weather** (R): storm / drizzle / clear — crickets, frogs, loons follow the sky
- **4 new sit spots**: overlook bench, dock end, porch swing (sways!), rowboat — 8 total, tracked in journal
- **Photo mode** (P) with flash, **night journal** (J), **couch naps** (Z)
- **Dog tricks**: G speak, T shake (when close)
- **Radio 3 stations**: off / lo-fi / music-box
- **Moths** around the porch lamp, cabin **wood stove** with kettle, bookshelf + painting admires
- 32 crafted MP3s (17 new: meow, purr, 6 strums, splash, sizzle, chime, creak, musicbox, plip, catch, frogs, loon)
