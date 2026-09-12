# 🌙 MIDNIGHT DRIVE — Eternal Night Haul

A chill **first-person midnight driving sim** built with Three.js + Vite.
Rain, fuel runs, motels, breakdowns, hitchhikers, lo-fi radio.
No ending — just the road.

## 🚀 How to run (2 minutes)

You need [Node.js](https://nodejs.org/) 18+ (check with `node --version`).

```bash
cd drive
npm install     # one time: downloads three.js + vite
npm run dev     # start the game
```

Then open the URL it prints (usually **http://localhost:5173**).

> ⚠️ Opening `index.html` straight from disk (double-click / `file://`)
> will NOT work — browsers block ES modules that way. Always use
> `npm run dev` (or any static server + `npm run build`, see below).

## 📦 Build for release

```bash
cd drive
npm run build    # -> dist/ (static files, works from any folder/sub-path)
npm run preview  # serve the production build locally to test it
```

Deploy `dist/` anywhere: itch.io, GitHub Pages, Netlify, Vercel, plain hosting.

## 🎮 Controls

| Key | Action |
|-----|--------|
| W/S · A/D | gas / brake / reverse · steer |
| Mouse | look (click captures the cursor) |
| Space | handbrake |
| E (tap/hold) | enter·exit·interact / refuel·repair·push |
| L / H | headlights / high-beam |
| V | wipers (off→slow→fast) |
| R | radio (3 synth stations + off) |
| G | auto-drive (any input takes over) |
| T | tow truck (Rp 250.000) |
| Z / X | turn signals |
| K | horn · C hold peek back |
| 1/2/3/4 | jerry can · repair kit · snack · coffee |
| P / 📷 | photo mode (P again = snap PNG) |
| M / ⚙️ | mute / settings (volume·quality·mouse) |
| Esc | close menus / free cursor |

Mobile: touch buttons + left virtual stick + drag-to-look.

## 🧰 What's in the game

- **Drive**: RHD first-person cockpit, mirror with live traffic dots, dash GPS, gauges, signals, hazards, high-beams, horn
- **Weather**: drifting rain intensity, lightning + delayed thunder, wind gusts, windshield droplets cleared by wipers, wet reflective asphalt
- **Fuel loop**: rear fuel flap — park at SPBU, get out, hold E at the pump; jerry cans; push the car; tow truck
- **Breakdowns**: redline/crash/dirt wear, misfires, overheating, hood repairs, Bengkel full service
- **Upgrades** (Bengkel): long-range tank, engine tune, eco kit, wet-grip tires, LED light bar — saved with your journey
- **Stations** every 1.5 km: SPBU, Mart 24H, Motel Melati + Bengkel, Warkop Diner, car wash — with GPS + road signs
- **Hitchhikers** 🧍: pick them up, drop at their station, earn tips
- **Needs**: energy/food, drooping eyelids, microsleeps, hunger growls
- **Economy**: vlog Rp per km, shops, motel sleep = save game, free diner dozes
- **Extras**: procedural radio, auto-drive, minimap, photo mode, settings, full touch support

## 🛠️ Tech notes

- `npm run dev` = Vite dev server with hot-reload + error overlay
- `npm run build` = tree-shaken production bundle (`three` from npm, pinned in `package-lock.json`)
- 30 modules in `js/`, no framework — plain Three.js + canvas HUD
- Saves live in `localStorage` (`midnight-drive-save-v1`, all access crash-guarded for webviews)

## 🆘 It won't start?!

1. Make sure you ran `npm install` and `npm run dev` (don't open the file directly)
2. Use Chrome / Edge / Firefox / Safari **with hardware acceleration on** (game needs WebGL)
3. The game shows its own error box (`⚠️ COULDN'T START`) with the reason — read it, it usually tells you exactly what's wrong
4. Still stuck? Open devtools (F12) → Console → copy the red error
