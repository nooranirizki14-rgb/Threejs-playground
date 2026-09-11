import * as THREE from 'three';

// All textures are painted procedurally on canvas — zero image assets.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowText(ctx, text, x, y, font, color, blur = 24, align = 'center') {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.fillText(text, x, y); // second pass = hotter core
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Horizontal neon sign, e.g. ラーメン / KARAOKE.
export function makeNeonSign({ text, sub = '', color = '#ff2fd6', w = 512, h = 256, frame = true }) {
  const [c, ctx] = canvas(w, h);
  if (frame) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.restore();
  }
  const size = sub ? h * 0.34 : h * 0.42;
  glowText(ctx, text, w / 2, sub ? h * 0.38 : h * 0.5, `900 ${size}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`, color, 26);
  if (sub) {
    glowText(ctx, sub, w / 2, h * 0.74, `700 ${h * 0.16}px Orbitron, sans-serif`, '#ffffff', 14);
  }
  return toTexture(c);
}

// Tall vertical sign with stacked characters.
export function makeVerticalSign({ text, color = '#00e5ff', w = 192, h = 512, frame = true }) {
  const [c, ctx] = canvas(w, h);
  if (frame) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.restore();
  }
  const chars = [...text];
  const size = Math.min(w * 0.52, (h * 0.82) / Math.max(chars.length, 1));
  const step = size * 1.18;
  const startY = h / 2 - (step * (chars.length - 1)) / 2;
  chars.forEach((ch, i) => {
    glowText(ctx, ch, w / 2, startY + i * step, `900 ${size}px "Hiragino Sans", "Noto Sans JP", sans-serif`, color, 22);
  });
  return toTexture(c);
}

// Simple glowing arrow / shape plate.
export function makeArrowSign({ color = '#00e5ff', dir = 1, w = 512, h = 192 }) {
  const [c, ctx] = canvas(w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  const y = h / 2;
  const x0 = w * 0.12;
  const x1 = w * 0.88;
  for (let p = 0; p < 2; p++) {
    ctx.beginPath();
    ctx.moveTo(dir > 0 ? x0 : x1, y);
    ctx.lineTo(dir > 0 ? x1 : x0, y);
    ctx.stroke();
    const hx = dir > 0 ? x1 : x0;
    const s = dir > 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(hx, y);
    ctx.lineTo(hx + s * 70, y - 46);
    ctx.moveTo(hx, y);
    ctx.lineTo(hx + s * 70, y + 46);
    ctx.stroke();
  }
  ctx.restore();
  return toTexture(c);
}

// Building facade: dark concrete + lit window grid. Returns { map, emissive }.
export function makeWindows({ w = 256, h = 512, cols = 6, rows = 14, litRatio = 0.4, seed = 1 }) {
  let s = seed * 9973 + 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const [cm, xm] = canvas(w, h);
  const [ce, xe] = canvas(w, h);

  // concrete base
  const grad = xm.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#14141f');
  grad.addColorStop(1, '#0a0a13');
  xm.fillStyle = grad;
  xm.fillRect(0, 0, w, h);
  // grime streaks
  for (let i = 0; i < 40; i++) {
    xm.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`;
    const gw = 4 + rnd() * 22;
    xm.fillRect(rnd() * w, rnd() * h, gw, 30 + rnd() * 120);
  }
  xe.fillStyle = '#000000';
  xe.fillRect(0, 0, w, h);

  const mx = w * 0.08;
  const my = h * 0.04;
  const cw = (w - mx * 2) / cols;
  const ch = (h - my * 2) / rows;
  const litColors = ['#ffd9a0', '#ffb46b', '#fff3d6', '#a0e7ff', '#ffc4ec', '#d6ffe0'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = mx + col * cw + cw * 0.18;
      const y = my + r * ch + ch * 0.2;
      const ww = cw * 0.64;
      const hh = ch * 0.6;
      const lit = rnd() < litRatio;
      if (lit) {
        const lc = litColors[(rnd() * litColors.length) | 0];
        xm.fillStyle = '#0c0c14';
        xm.fillRect(x - 2, y - 2, ww + 4, hh + 4);
        xm.fillStyle = lc;
        xm.fillRect(x, y, ww, hh);
        // curtain shadow on some
        if (rnd() < 0.4) {
          xm.fillStyle = 'rgba(0,0,0,0.45)';
          xm.fillRect(x, y, ww * (0.3 + rnd() * 0.4), hh);
        }
        xe.fillStyle = lc;
        xe.fillRect(x, y, ww, hh);
      } else {
        xm.fillStyle = '#05060c';
        xm.fillRect(x - 2, y - 2, ww + 4, hh + 4);
        xm.fillStyle = '#0d1220';
        xm.fillRect(x, y, ww, hh);
        // faint sky reflection
        xm.fillStyle = 'rgba(120,140,255,0.08)';
        xm.fillRect(x, y, ww, hh * 0.35);
      }
    }
  }
  // rooftop sign glow spill at top
  return { map: toTexture(cm), emissive: toTexture(ce) };
}

// Glowing shop-front plane (warm interior spill).
export function makeShopGlow({ w = 256, h = 128, color = '#ffb46b' }) {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.45, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // silhouettes of shelves / people
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 5; i++) {
    const bw = 18 + Math.random() * 30;
    ctx.fillRect(10 + i * (w / 5), h * 0.45, bw, h * 0.55);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, h * 0.42, w, 3);
  return toTexture(c);
}

// Vending machine front.
export function makeVending({ w = 128, h = 256 }) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#0a0d18';
  ctx.fillRect(0, 0, w, h);
  const drinks = ['#ff4d6d', '#00e5ff', '#ffd166', '#7dff6a', '#c77dff', '#ff9a3d', '#4dc9ff', '#ff5d8f'];
  for (let r = 0; r < 4; r++) {
    for (let col = 0; col < 3; col++) {
      const x = 10 + col * 38;
      const y = 14 + r * 44;
      ctx.fillStyle = 'rgba(200,220,255,0.9)';
      ctx.fillRect(x, y, 30, 34);
      ctx.fillStyle = drinks[(r * 3 + col) % drinks.length];
      ctx.fillRect(x + 3, y + 8, 24, 23);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x + 3, y + 3, 24, 4);
    }
  }
  // glow strip + slot
  const g = ctx.createLinearGradient(0, h - 56, 0, h);
  g.addColorStop(0, 'rgba(0,229,255,0)');
  g.addColorStop(1, 'rgba(0,229,255,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - 56, w, 56);
  ctx.fillStyle = '#05060c';
  ctx.fillRect(w / 2 - 22, h - 34, 44, 22);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(w / 2 - 22, h - 34, 44, 3);
  return toTexture(c);
}

// Scrolling LED ticker. Call draw(t) each frame; texture auto-updates.
export function makeTicker({ w = 512, h = 64, text, color = '#ffb03d', bg = '#140800' }) {
  const [c, ctx] = canvas(w, h);
  const tex = toTexture(c);
  ctx.font = `700 ${h * 0.52}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
  const full = text + '   ★   ' + text + '   ★   ';
  const textW = ctx.measureText(full).width;
  let off = 0;
  function draw(dt) {
    off = (off + dt * 110) % textW;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // LED scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.save();
    ctx.font = `700 ${h * 0.52}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(full, -off, h / 2);
    ctx.fillText(full, -off + textW, h / 2);
    ctx.restore();
    // frame
    ctx.strokeStyle = 'rgba(255,176,61,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw };
}

// Soft radial sprite (steam puffs, vehicle glow, lamp halos).
export function makeGlowSprite({ size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.28)' }) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c, false);
}

// Tileable puddle mask (white = mirror puddle). World-locked on the ground.
export function makePuddle({ size = 512, blobs = 26 }) {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, size, size);
  // wrapped blob draws => seamless tiling
  for (let i = 0; i < blobs; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 22 + Math.random() * 78;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        const v = 150 + ((Math.random() * 105) | 0);
        g.addColorStop(0, `rgb(${v},${v},${v})`);
        g.addColorStop(0.65, `rgba(${v},${v},${v},0.55)`);
        g.addColorStop(1, 'rgba(42,42,42,0)');
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

// Tileable smooth noise for ripple distortion + asphalt variation.
export function makeNoise({ size = 128 }) {
  const small = document.createElement('canvas');
  small.width = small.height = 32;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(32, 32);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = (Math.random() * 255) | 0;
    img.data[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  // mirror 2x2 => seamless when tiled
  const [c, ctx] = canvas(size, size);
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
