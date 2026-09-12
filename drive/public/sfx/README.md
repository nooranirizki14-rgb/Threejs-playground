# 🔊 MIDNIGHT DRIVE sound pack

The game plays **real recordings first** and only synthesizes sounds whose
file is missing. Drop `.mp3` files with the exact names below into this
folder and they work immediately (restart `npm run dev`, or rebuild).

## ✅ Already included (real recordings, MIT — see Credits)

| File | Used for |
|------|----------|
| `click.mp3` | UI buttons |
| `tick.mp3` | settings +/- |
| `deny.mp3` | error buzz |
| `door.mp3` | car door open/close |
| `blinker.mp3` | turn-signal relay |
| `crash.mp3` + `crunch.mp3` + `glass.mp3` | crash layers (glass only on hard hits) |
| `clank.mp3` | repair work |
| `photo.mp3` | photo-mode shutter |
| `bell.mp3` | motel reception bell |
| `gulp.mp3` | snack / coffee |
| `fuelcap.mp3` | fuel cap pop when refuelling starts |

## ⬆️ Upload slots (synth fallback until you add these)

Loops must loop **seamlessly** (no click at the wrap). Mono or stereo,
44.1 kHz MP3 is perfect. Keep each under ~1 MB.

| File | What to get | Loop? |
|------|-------------|-------|
| `engine.mp3` | steady car engine, mid RPM, 2–4 s, no revving | ✅ |
| `rain.mp3` | heavy rain on car roof / windshield, 4–8 s | ✅ |
| `wind.mp3` | airy driving wind, no whistling, 3–6 s | ✅ |
| `gravel.mp3` | tires on gravel/dirt road, 2–4 s | ✅ |
| `skid.mp3` | tire skid, 1–2 s | ✅ |
| `fuel.mp3` | fuel pump humming, 2–3 s | ✅ |
| `thunder1.mp3` `thunder2.mp3` `thunder3.mp3` | close + distant thunder claps | one-shot |
| `wiper.mp3` | single wiper swoosh (~0.3 s) | one-shot |
| `horn.mp3` | normal car horn honk (~0.5 s) | one-shot |

## 🆓 Where to get free sounds

- **Pixabay Sound** (pixabay.com/sound-effects) — free, no attribution needed
- **Mixkit** (mixkit.co/free-sound-effects) — free license
- **Freesound** (freesound.org) — huge, free account, check per-sound license
  (prefer CC0; CC-BY needs credit in this file)
- **BBC Sound Effects** (sound-effects.bbcrewind.co.uk) — free for personal use

Search terms that work: `car engine loop`, `rain on car`, `driving wind`,
`gravel road driving`, `tire skid`, `thunder close`, `windshield wiper`,
`car horn`.

## Credits

Bundled one-shots are from **IonDen / ion.sound 3.0.7** (MIT license),
via npm: button, relay, door, metal, glass, camera, bell, can, error, cork.
Thank you Denis Ineshin / contributors.
