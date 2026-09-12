import * as THREE from 'three';
import { makeCanvas, rnd } from './utils.js';

// moths circling the porch lamp — only when it's on
function mothTexture() {
  const [c, ctx] = makeCanvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 14);
  g.addColorStop(0, 'rgba(255,240,210,1)');
  g.addColorStop(0.5, 'rgba(230,210,170,0.4)');
  g.addColorStop(1, 'rgba(230,210,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Moths {
  constructor(scene, lampPos) {
    this.base = lampPos.clone();
    this.group = new THREE.Group();
    scene.add(this.group);
    const tex = mothTexture();
    this.moths = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xd8c8a0, transparent: true,
        opacity: 0.75, depthWrite: false,
      }));
      s.scale.set(0.07, 0.07, 1);
      this.group.add(s);
      this.moths.push({
        s,
        r: rnd(0.25, 0.6),
        w1: rnd(2, 5) * (Math.random() < 0.5 ? -1 : 1),
        w2: rnd(3, 7),
        p1: rnd(0, 6.28),
        p2: rnd(0, 6.28),
        y: rnd(-0.15, 0.25),
      });
    }
  }

  setOn(on) {
    this.group.visible = on;
  }

  update(t) {
    if (!this.group.visible) return;
    for (const m of this.moths) {
      const a = t * m.w1 + m.p1;
      m.s.position.set(
        this.base.x + Math.cos(a) * m.r,
        this.base.y + m.y + Math.sin(t * m.w2 + m.p2) * 0.12,
        this.base.z + Math.sin(a) * m.r
      );
      // wing flutter
      const f = 0.05 + Math.abs(Math.sin(t * 30 + m.p1)) * 0.04;
      m.s.scale.set(f, f, 1);
    }
  }
}
