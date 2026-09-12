import * as THREE from 'three';

// Morty's head: a sculpted sphere with a hand-painted canvas face.
// Face center sits at u=0.25 (px 256) which faces +z.
const SKIN = '#f2cf9f';
const SKIN_D = '#dfa878';
const HAIR = '#5a3d22';
const HAIR_D = '#3a2513';

function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function mortyTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');

  // skin base
  x.fillStyle = SKIN;
  x.fillRect(0, 0, 1024, 512);

  // hair cap
  x.fillStyle = HAIR;
  x.fillRect(0, 0, 1024, 150);
  // long hair at the back (back center = px 768)
  x.fillRect(560, 150, 440, 175);
  // sideburns flanking both ears (ears at px 512 and 0/1024)
  x.fillRect(430, 150, 60, 130);
  x.fillRect(534, 150, 60, 130);
  x.fillRect(30, 150, 60, 130);
  x.fillRect(934, 150, 60, 130);

  // spiky hairline around the face (face center px 256)
  x.beginPath();
  const x0 = 92, x1 = 420, top = 148;
  x.moveTo(x0, top);
  const spikes = 10;
  for (let i = 0; i <= spikes; i++) {
    const px = x0 + ((x1 - x0) * i) / spikes;
    const dip = i % 2 === 0 ? top : top + 30 + (i % 4 === 1 ? 12 : 0);
    x.lineTo(px, dip);
  }
  x.lineTo(x1, top);
  x.lineTo(x1, 0);
  x.lineTo(x0, 0);
  x.closePath();
  x.fill();
  // hair shading strokes
  x.strokeStyle = HAIR_D;
  x.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    const px = 130 + i * 38;
    x.beginPath();
    x.moveTo(px, 20);
    x.quadraticCurveTo(px + 12, 80, px - 6, 130);
    x.stroke();
  }

  // ears (sides of the head)
  for (const ex of [512, 0, 1024]) {
    x.fillStyle = SKIN_D;
    x.beginPath();
    x.ellipse(ex, 258, 30, 38, 0, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#b57e4e';
    x.lineWidth = 5;
    x.beginPath();
    x.ellipse(ex, 258, 15, 22, 0, 0, Math.PI * 2);
    x.stroke();
  }

  // big worried eyes (pupils are 3D — they follow your cursor)
  for (const ex of [184, 328]) {
    x.fillStyle = '#fdfdf5';
    x.beginPath();
    x.ellipse(ex, 248, 45, 75, 0, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = '#3a3a3a';
    x.lineWidth = 4;
    x.stroke();
  }

  // worried slanted brows (inner ends up)
  x.strokeStyle = '#2e1c0c';
  x.lineWidth = 11;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(138, 192);
  x.lineTo(222, 158);
  x.stroke();
  x.beginPath();
  x.moveTo(374, 192);
  x.lineTo(290, 158);
  x.stroke();

  // forehead worry lines
  x.strokeStyle = 'rgba(160,110,70,0.8)';
  x.lineWidth = 4;
  for (const [cy, w] of [[128, 60], [146, 44]]) {
    x.beginPath();
    x.moveTo(256 - w, cy);
    x.quadraticCurveTo(256, cy - 10, 256 + w, cy);
    x.stroke();
  }

  // pointy little nose
  x.fillStyle = SKIN_D;
  x.beginPath();
  x.moveTo(256, 258);
  x.lineTo(248, 286);
  x.lineTo(264, 286);
  x.closePath();
  x.fill();
  x.strokeStyle = '#b57e4e';
  x.lineWidth = 3;
  x.stroke();

  // worried wobbly mouth
  x.strokeStyle = '#7a4a2a';
  x.lineWidth = 6;
  x.beginPath();
  x.moveTo(224, 342);
  x.quadraticCurveTo(240, 352, 256, 342);
  x.quadraticCurveTo(272, 332, 288, 342);
  x.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function bump(v, cx, cy, cz, r, dx, dy, dz, amt) {
  const d = Math.hypot(v.x - cx, v.y - cy, v.z - cz);
  if (d < r) {
    const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / r);
    v.x += dx * amt * w;
    v.y += dy * amt * w;
    v.z += dz * amt * w;
  }
}

export function sculptHead(geo) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // wide cranium, tapered chin
    v.x *= 1 + 0.08 * sstep(-0.2, 1.0, v.y);
    const chin = sstep(0.1, -1.0, v.y);
    v.x *= 1 - 0.22 * chin;
    v.z *= 1 - 0.12 * chin;
    // slightly flattened back
    if (v.z < -0.4) v.z *= 0.94;
    // nose + ears (part of the elastic sheet, so they squish too)
    bump(v, 0, -0.08, 0.99, 0.2, 0, 0, 1, 0.09);
    bump(v, 0.97, 0, 0.02, 0.25, 1, 0, 0, 0.12);
    bump(v, -0.97, 0, 0.02, 0.25, -1, 0, 0, 0.12);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}

function pupilMesh() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.25 })
  );
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  shine.position.set(0.02, 0.025, 0.05);
  g.add(ball, shine);
  return g;
}

export function buildMorty() {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  sculptHead(geo);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: mortyTexture(), roughness: 0.55 })
  );
  mesh.castShadow = true;

  // eye anchors: nearest rest verts to the painted eye centers
  const pos = geo.attributes.position;
  const find = (tx, ty, tz) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - tx, dy = pos.getY(i) - ty, dz = pos.getZ(i) - tz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  return {
    mesh,
    pupilL: pupilMesh(),
    pupilR: pupilMesh(),
    anchorL: find(-0.3, 0.05, 0.93),
    anchorR: find(0.3, 0.05, 0.93),
  };
}
