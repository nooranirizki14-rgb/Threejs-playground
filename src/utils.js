// Shared helpers: math, RNG, canvas boilerplate.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
