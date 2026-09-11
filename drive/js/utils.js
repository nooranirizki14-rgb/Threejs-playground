// Shared helpers: math, seeded RNG, formatting, canvas boilerplate.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Deterministic RNG per id (stations, signs) so the world rebuilds identically.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rp 1.234.567 formatting (id-ID style, hand-rolled to avoid locale deps).
export function fmtRp(n) {
  n = Math.max(0, Math.round(n));
  return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Indonesian decimal comma: 1,2 km
export function fmtKm(m) {
  if (m < 95) return Math.round(m) + ' m';
  return (m / 1000).toFixed(1).replace('.', ',') + ' km';
}

export function fmtClock(mins) {
  const m = ((Math.floor(mins) % 300) + 300) % 300; // eternal 00:00–04:59 night
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function fmtOdo(m) {
  return 'ODO ' + (m / 1000).toFixed(1).replace('.', ',') + ' km';
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
