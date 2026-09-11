import * as THREE from 'three';
import { makeCanvas } from './utils.js';

// All textures painted procedurally — zero image assets.
function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowText(ctx, text, x, y, font, color, blur = 22) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function makeNeonSign({ text, sub = '', color = '#ff2fd6', w = 512, h = 256 }) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.restore();
  const size = sub ? h * 0.32 : h * 0.4;
  glowText(ctx, text, w / 2, sub ? h * 0.38 : h * 0.5,
    `900 ${size}px Orbitron, "Segoe UI", sans-serif`, color, 24);
  if (sub) {
    glowText(ctx, sub, w / 2, h * 0.74,
      `700 ${h * 0.15}px Orbitron, sans-serif`, '#ffffff', 12);
  }
  return toTexture(c);
}

export function makeVerticalSign({ text, color = '#00e5ff', w = 192, h = 512 }) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.restore();
  const chars = [...text];
  const size = Math.min(w * 0.5, (h * 0.84) / Math.max(chars.length, 1));
  const step = size * 1.2;
  const startY = h / 2 - (step * (chars.length - 1)) / 2;
  chars.forEach((ch, i) => {
    glowText(ctx, ch, w / 2, startY + i * step,
      `900 ${size}px Orbitron, sans-serif`, color, 20);
  });
  return toTexture(c);
}

// Green highway board. Repaintable: returns { tex, draw(lines) }.
export function makeRoadBoard({ w = 512, h = 256 } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  const tex = toTexture(c);
  function draw(lines) {
    ctx.fillStyle = '#063d1e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8f5e9';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const y = (h / (lines.length + 1)) * (i + 1);
      ctx.font = `700 ${ln.big ? 52 : 44}px Rajdhani, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.55)';
      ctx.shadowBlur = 8;
      ctx.fillText(ln.text, 30, y);
      if (ln.right) {
        ctx.textAlign = 'right';
        ctx.fillText(ln.right, w - 30, y);
        ctx.textAlign = 'left';
      }
    });
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  }
  draw([{ text: '...' }]);
  return { tex, draw };
}

// Fuel price totem. Repaintable with price.
export function makeTotem({ brand = 'NUSANTARA FUEL', w = 256, h = 512 } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  const tex = toTexture(c);
  function draw(priceText) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a1030');
    g.addColorStop(1, '#05070f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 16;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7df9ff';
    ctx.font = '900 34px Orbitron, sans-serif';
    const words = brand.split(' ');
    words.forEach((wd, i) => ctx.fillText(wd, w / 2, 70 + i * 42));
    // fuel drop icon
    ctx.save();
    ctx.translate(w / 2, 210);
    ctx.fillStyle = '#ff9a3d';
    ctx.shadowColor = '#ff9a3d';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.bezierCurveTo(26, -8, 34, 8, 34, 22);
    ctx.bezierCurveTo(34, 44, 18, 56, 0, 56);
    ctx.bezierCurveTo(-18, 56, -34, 44, -34, 22);
    ctx.bezierCurveTo(-34, 8, -26, -8, 0, -46);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 30px Orbitron, sans-serif';
    ctx.fillText(priceText, w / 2, 310);
    ctx.fillStyle = '#8f9bff';
    ctx.font = '600 22px Rajdhani, sans-serif';
    ctx.fillText('PER LITER', w / 2, 342);
    ctx.fillStyle = '#7dff6a';
    ctx.font = '700 30px Orbitron, sans-serif';
    ctx.fillText('★ 24 JAM ★', w / 2, 400);
    ctx.fillStyle = '#c6cbff';
    ctx.font = '600 24px Rajdhani, sans-serif';
    ctx.fillText('MART · MUSOLA · TOILET', w / 2, 448);
    tex.needsUpdate = true;
  }
  draw('...');
  return { tex, draw };
}

// Indonesian license plate, e.g. "KT 4821 XA".
export function makePlate(text) {
  const [c, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '900 38px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  return toTexture(c);
}

// Static pump display face.
export function makePumpFace({ brand = 'PERTALITE' } = {}) {
  const [c, ctx] = makeCanvas(128, 192);
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#ff9a3d';
  ctx.font = '900 17px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(brand, 64, 26);
  ctx.fillStyle = '#031007';
  ctx.fillRect(10, 40, 108, 44);
  ctx.fillStyle = '#7dff6a';
  ctx.font = '700 24px "Courier New", monospace';
  ctx.fillText('0.00 L', 64, 68);
  ctx.fillStyle = '#031007';
  ctx.fillRect(10, 92, 108, 44);
  ctx.fillStyle = '#7dff6a';
  ctx.fillText('Rp 0', 64, 120);
  ctx.fillStyle = '#39406b';
  for (let i = 0; i < 3; i++) ctx.fillRect(14 + i * 36, 148, 28, 28);
  return toTexture(c);
}

// Soft radial glow sprite.
export function makeGlowSprite({ size = 128 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, false);
}

// Tileable puddle mask (white = mirror).
export function makePuddle({ size = 512, blobs = 30 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#303030';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 24 + Math.random() * 84;
    const v = 150 + ((Math.random() * 105) | 0);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgb(${v},${v},${v})`);
        g.addColorStop(0.65, `rgba(${v},${v},${v},0.55)`);
        g.addColorStop(1, 'rgba(48,48,48,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const t = toTexture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Tileable smooth noise (mirror 2x2 trick).
export function makeNoise({ size = 128 } = {}) {
  const small = document.createElement('canvas');
  small.width = small.height = 32;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(32, 32);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = (Math.random() * 255) | 0;
    img.data[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const [c, ctx] = makeCanvas(size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, size / 2, size / 2);
  ctx.save();
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(small, 0, 0, size / 2, size / 2);
  ctx.restore();
  ctx.save();
  ctx.translate(0, size);
  ctx.scale(1, -1);
  ctx.drawImage(small, 0, 0, size / 2, size / 2);
  ctx.drawImage(c, 0, 0, size / 2, size / 2, size / 2, 0, size / 2, size / 2);
  ctx.restore();
  const t = toTexture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Asphalt detail (dark noise) for lots/grass variation.
export function makeDetail({ size = 256, base = '#0a0c14', spots = 900 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < spots; i++) {
    const v = 8 + Math.random() * 22;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.5)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
