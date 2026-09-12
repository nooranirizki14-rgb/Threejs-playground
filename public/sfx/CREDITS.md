# SFX credits

## Real recordings (MIT — IonDen / ion-sound)

The short one-shots are trimmed from real recorded UI sounds in
[ion-sound 3.0.7](https://www.npmjs.com/package/ion-sound-3)
by IonDen (<http://ionden.com>), MIT licensed:

| File | Source | Edit |
|---|---|---|
| `click.mp3` | `button_click.mp3` | trimmed to 0.3 s, faded, mono |
| `step.mp3` | `door_bump.mp3` | trimmed, faded, −2 dB, mono |
| `step2.mp3` | `tap.mp3` | trimmed, faded, −3 dB, mono |

MIT terms: keep this credit if you redistribute the game with these files.

## Studio-crafted loops (original, CC0)

The sandbox has no access to field-recording libraries, so these four were
crafted in-repo with DSP (layered filtered-noise beds, periodic LFOs, and
equal-power loop crossfades so they repeat seamlessly). They are original
works, dedicated to the public domain (CC0) — use them anywhere:

| File | How it was built |
|---|---|
| `rain.mp3` (24 s loop) | lowpassed noise bed + 2.5 kHz patter band + 60 droplet plinks |
| `thunder.mp3` (5 s) | noise crack + brown-noise sub body + 3 rolling echoes |
| `fire.mp3` (16 s loop) | ember bed + hiss + 90 crackle pops (20% with low thump) |
| `crickets.mp3` (12 s loop) | two chirpers (4.2 / 4.7 kHz, exact integer cycles) + night air |

Want true field recordings instead? Record your own (a phone in the rain is
genuinely great) or grab some from [Freesound](https://freesound.org), drop
them here with the same names, reload — no code changes needed.
