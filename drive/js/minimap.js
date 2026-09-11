import { clamp, fmtKm } from './utils.js';

// Tiny neon minimap: road strip, upcoming stations, hitchhiker markers.
const FLAVOR_ICON = { mart: '🏪', motel: '🛏️', diner: '🍜' };
const RANGE = 3000; // metres shown

export class Minimap {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
  }

  draw(d) {
    // d: { stations: [{dz, flavor, fuel}], hitch: {state,x,z,destZ} | null, pz }
    const g = this.g;
    const W = this.c.width;
    const H = this.c.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(3, 2, 16, 0.72)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);

    const cx = W / 2;
    const yOf = (dz) => H - 18 - clamp(dz / RANGE, 0, 1) * (H - 30);

    // road strip (player lanes left of median)
    g.fillStyle = 'rgba(120, 140, 255, 0.16)';
    g.fillRect(cx - 22, 4, 44, H - 8);
    g.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    g.lineWidth = 2;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(cx + 20, 4);
    g.lineTo(cx + 20, H - 4);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    g.lineWidth = 1;
    g.strokeRect(cx - 22, 4, 44, H - 8);

    // stations ahead
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const s of d.stations || []) {
      if (s.dz < 0 || s.dz > RANGE) continue;
      const y = yOf(s.dz);
      g.font = '13px serif';
      g.fillText(FLAVOR_ICON[s.flavor] || '•', cx - 30, y);
      if (s.fuel) {
        g.font = '10px serif';
        g.fillText('⛽', cx - 30, y + 11);
      }
      g.fillStyle = 'rgba(201, 255, 217, 0.85)';
      g.font = '9px Orbitron, monospace';
      g.fillText(fmtKm(s.dz), cx + 34, y);
      g.fillStyle = 'rgba(0, 229, 255, 0.8)';
      g.beginPath();
      g.arc(cx - 12, y, 2.5, 0, Math.PI * 2);
      g.fill();
    }

    // hitchhiker waiting / destination flag
    const h = d.hitch;
    if (h && h.state === 'waiting') {
      const dz = d.pz - h.z;
      if (dz > -50 && dz < RANGE) {
        g.font = '13px serif';
        g.fillText('🧍', cx - 12, yOf(Math.max(0, dz)));
      }
    }
    if (h && h.state === 'aboard') {
      const dz = d.pz - h.destZ;
      if (dz > -50 && dz < RANGE) {
        g.font = '14px serif';
        g.fillText('🏁', cx - 12, yOf(Math.max(0, dz)));
      }
    }

    // player arrow
    const py = H - 14;
    g.fillStyle = '#7dff6a';
    g.shadowColor = '#7dff6a';
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(cx - 12, py - 8);
    g.lineTo(cx - 5, py + 4);
    g.lineTo(cx - 19, py + 4);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
  }
}
