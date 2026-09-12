import * as THREE from 'three';
import { makeCanvas, rnd } from './utils.js';

// Procedural PBR texture sets: { map, roughnessMap, normalMap }.
// Nothing flat-colored — every surface gets albedo variation, roughness
// response, and normal detail.
function toTex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function heightToNormal(heightCanvas, strength = 2) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, ctx] = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x, y) => src[((((y + h) % h) * w) + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (dx * inv * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      out.data[i + 2] = inv * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function speckle(ctx, w, h, n, alpha, light) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * Math.random()})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

// Weathered plank wood. gaps=true draws plank separations.
export function makeWood({ base = '#6b4a2a', dark = '#3a2412', planks = 6, rx = 1, ry = 1, gaps = true, weather = 0.3 } = {}) {
  const W = 256;
  const H = 256;
  const [ac, a] = makeCanvas(W, H);
  const [hc, h] = makeCanvas(W, H);
  const [rc, r] = makeCanvas(W, H);
  a.fillStyle = base;
  a.fillRect(0, 0, W, H);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, W, H);
  r.fillStyle = '#c8c8c8';
  r.fillRect(0, 0, W, H);
  const ph = H / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    // per-plank tone shift (weathered = grayer, less saturated)
    const tone = rnd(-14, 14);
    a.fillStyle = `rgba(${tone > 0 ? '255,220,170' : '0,0,0'},${Math.abs(tone) / 100})`;
    a.fillRect(0, y0, W, ph);
    if (weather > 0) {
      a.fillStyle = `rgba(140,145,150,${weather * 0.35})`;
      a.fillRect(0, y0, W, ph);
    }
    // grain streaks
    for (let i = 0; i < 26; i++) {
      const gy = y0 + Math.random() * ph;
      a.strokeStyle = `rgba(20,10,5,${rnd(0.08, 0.3)})`;
      a.lineWidth = rnd(0.5, 1.8);
      a.beginPath();
      a.moveTo(0, gy);
      a.bezierCurveTo(W * 0.3, gy + rnd(-3, 3), W * 0.7, gy + rnd(-3, 3), W, gy + rnd(-2, 2));
      a.stroke();
      h.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.25)`;
      h.lineWidth = 1;
      h.beginPath();
      h.moveTo(0, gy);
      h.bezierCurveTo(W * 0.3, gy + 2, W * 0.7, gy - 2, W, gy);
      h.stroke();
    }
    // occasional knot
    if (Math.random() < 0.6) {
      const kx = rnd(20, W - 20);
      const ky = y0 + ph / 2 + rnd(-6, 6);
      const kg = a.createRadialGradient(kx, ky, 1, kx, ky, 9);
      kg.addColorStop(0, 'rgba(15,8,4,0.9)');
      kg.addColorStop(0.5, 'rgba(30,18,10,0.5)');
      kg.addColorStop(1, 'rgba(30,18,10,0)');
      a.fillStyle = kg;
      a.beginPath();
      a.ellipse(kx, ky, 9, 6, 0, 0, Math.PI * 2);
      a.fill();
    }
    if (gaps) {
      a.fillStyle = 'rgba(0,0,0,0.7)';
      a.fillRect(0, y0, W, 2);
      h.fillStyle = '#000';
      h.fillRect(0, y0, W, 2);
      r.fillStyle = '#fff';
      r.fillRect(0, y0, W, 2);
    }
  }
  a.strokeStyle = dark;
  a.globalAlpha = 0.15;
  for (let i = 0; i < 40; i++) {
    a.lineWidth = rnd(0.5, 1);
    const sx = Math.random() * W;
    a.beginPath();
    a.moveTo(sx, Math.random() * H);
    a.lineTo(sx + rnd(-30, 30), Math.random() * H);
    a.stroke();
  }
  a.globalAlpha = 1;
  speckle(a, W, H, 500, 0.12, false);
  speckle(a, W, H, 200, 0.08, true);
  return {
    map: toTex(ac, rx, ry, true),
    roughnessMap: toTex(rc, rx, ry, false),
    normalMap: heightToNormal(hc, 1.6),
  };
}

// Muddy night ground with moss blotches and grit.
export function makeGround(rx = 48, ry = 48) {
  const W = 512;
  const H = 512;
  const [ac, a] = makeCanvas(W, H);
  const [hc, h] = makeCanvas(W, H);
  const [rc, r] = makeCanvas(W, H);
  a.fillStyle = '#141009';
  a.fillRect(0, 0, W, H);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, W, H);
  r.fillStyle = '#909090';
  r.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const rad = rnd(6, 42);
    const moss = Math.random() < 0.45;
    const g = a.createRadialGradient(x, y, 1, x, y, rad);
    if (moss) {
      g.addColorStop(0, `rgba(24,48,22,${rnd(0.3, 0.7)})`);
    } else {
      g.addColorStop(0, `rgba(${Math.random() < 0.5 ? '8,6,4' : '40,30,18'},${rnd(0.25, 0.6)})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
    const hg = h.createRadialGradient(x, y, 1, x, y, rad);
    hg.addColorStop(0, moss ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    h.fillStyle = hg;
    h.beginPath();
    h.arc(x, y, rad, 0, Math.PI * 2);
    h.fill();
  }
  // grit stones
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const s = rnd(1, 3);
    a.fillStyle = `rgba(${rnd(60, 110) | 0},${rnd(58, 100) | 0},${rnd(50, 90) | 0},0.8)`;
    a.fillRect(x, y, s, s);
    h.fillStyle = 'rgba(255,255,255,0.7)';
    h.fillRect(x, y, s, s);
  }
  speckle(a, W, H, 3000, 0.15, false);
  // damp smooth patches (dark = low roughness = reflective smears)
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const rad = rnd(10, 50);
    const g = r.createRadialGradient(x, y, 1, x, y, rad);
    g.addColorStop(0, 'rgba(30,30,30,0.8)');
    g.addColorStop(1, 'rgba(30,30,30,0)');
    r.fillStyle = g;
    r.beginPath();
    r.arc(x, y, rad, 0, Math.PI * 2);
    r.fill();
  }
  const normalMap = heightToNormal(hc, 1.5);
  normalMap.repeat.set(rx, ry);
  return { map: toTex(ac, rx, ry, true), roughnessMap: toTex(rc, rx, ry, false), normalMap };
}

// Tree bark: vertical ridges and cracks.
export function makeBark(rx = 2, ry = 2) {
  const W = 256;
  const H = 256;
  const [ac, a] = makeCanvas(W, H);
  const [hc, h] = makeCanvas(W, H);
  a.fillStyle = '#2a1c10';
  a.fillRect(0, 0, W, H);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const wdt = rnd(2, 9);
    a.fillStyle = `rgba(${Math.random() < 0.5 ? '10,6,3' : '70,50,30'},${rnd(0.3, 0.7)})`;
    a.fillRect(x, 0, wdt, H);
    h.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.5)`;
    h.fillRect(x, 0, wdt, H);
  }
  for (let i = 0; i < 14; i++) {
    // deep cracks
    let x = Math.random() * W;
    a.strokeStyle = 'rgba(5,3,2,0.9)';
    a.lineWidth = rnd(1.5, 3.5);
    a.beginPath();
    a.moveTo(x, 0);
    for (let y = 0; y < H; y += 16) {
      x += rnd(-6, 6);
      a.lineTo(x, y);
    }
    a.stroke();
  }
  speckle(a, W, H, 600, 0.2, false);
  const [rc, r] = makeCanvas(W, H);
  r.fillStyle = '#e8e8e8';
  r.fillRect(0, 0, W, H);
  const normalMap = heightToNormal(hc, 2.5);
  normalMap.repeat.set(rx, ry);
  return { map: toTex(ac, rx, ry, true), roughnessMap: toTex(rc, rx, ry, false), normalMap };
}

// Cut stone for steps and the fire ring.
export function makeStone(rx = 1, ry = 1) {
  const W = 256;
  const H = 256;
  const [ac, a] = makeCanvas(W, H);
  const [hc, h] = makeCanvas(W, H);
  a.fillStyle = '#4a4c52';
  a.fillRect(0, 0, W, H);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const rad = rnd(4, 26);
    const g = a.createRadialGradient(x, y, 1, x, y, rad);
    const v = rnd(40, 110) | 0;
    g.addColorStop(0, `rgba(${v},${v},${v + 6},0.4)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
  }
  for (let i = 0; i < 8; i++) {
    a.strokeStyle = 'rgba(15,15,18,0.7)';
    a.lineWidth = rnd(1, 2);
    a.beginPath();
    let x = Math.random() * W;
    let y = Math.random() * H;
    a.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += rnd(-40, 40);
      y += rnd(-40, 40);
      a.lineTo(x, y);
    }
    a.stroke();
  }
  speckle(a, W, H, 1500, 0.18, false);
  speckle(a, W, H, 800, 0.12, true);
  speckle(h, W, H, 1500, 0.3, true);
  const [rc, r] = makeCanvas(W, H);
  r.fillStyle = '#b0b0b0';
  r.fillRect(0, 0, W, H);
  return {
    map: toTex(ac, rx, ry, true),
    roughnessMap: toTex(rc, rx, ry, false),
    normalMap: heightToNormal(hc, 1.2),
  };
}

// Woven plaid flannel.
export function makePlaid(c1 = '#5a2a2a', c2 = '#1a1a1a', rx = 1, ry = 1) {
  const W = 256;
  const H = 256;
  const [ac, a] = makeCanvas(W, H);
  a.fillStyle = c2;
  a.fillRect(0, 0, W, H);
  a.fillStyle = c1;
  for (let x = 0; x < W; x += 64) a.fillRect(x, 0, 30, H);
  for (let y = 0; y < H; y += 64) a.fillRect(0, y, W, 30);
  a.fillStyle = 'rgba(220,200,170,0.25)';
  for (let x = 32; x < W; x += 64) a.fillRect(x, 0, 4, H);
  for (let y = 32; y < H; y += 64) a.fillRect(0, y, W, 4);
  // thread weave
  for (let y = 0; y < H; y += 2) {
    a.fillStyle = `rgba(0,0,0,${y % 4 === 0 ? 0.12 : 0.05})`;
    a.fillRect(0, y, W, 1);
  }
  const [rc, r] = makeCanvas(W, H);
  r.fillStyle = '#f0f0f0';
  r.fillRect(0, 0, W, H);
  return { map: toTex(ac, rx, ry, true), roughnessMap: toTex(rc, rx, ry, false), normalMap: null };
}

// Denim twill.
export function makeDenim(rx = 1, ry = 1) {
  const W = 256;
  const H = 256;
  const [ac, a] = makeCanvas(W, H);
  a.fillStyle = '#232c40';
  a.fillRect(0, 0, W, H);
  a.strokeStyle = 'rgba(120,140,180,0.18)';
  a.lineWidth = 1;
  for (let i = -H; i < W; i += 3) {
    a.beginPath();
    a.moveTo(i, 0);
    a.lineTo(i + H, H);
    a.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const rad = rnd(15, 50);
    const g = a.createRadialGradient(x, y, 1, x, y, rad);
    g.addColorStop(0, 'rgba(140,160,200,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
  }
  const [rc, r] = makeCanvas(W, H);
  r.fillStyle = '#e0e0e0';
  r.fillRect(0, 0, W, H);
  return { map: toTex(ac, rx, ry, true), roughnessMap: toTex(rc, rx, ry, false), normalMap: null };
}

// Soft contact-shadow blob.
let aoTex = null;
export function aoTexture() {
  if (aoTex) return aoTex;
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  aoTex = new THREE.CanvasTexture(c);
  return aoTex;
}

export function addAO(scene, x, y, z, sx, sz, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: aoTexture(), transparent: true, opacity,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  m.position.set(x, y, z);
  m.renderOrder = 1;
  scene.add(m);
  return m;
}
