import * as THREE from 'three';
import { makeCanvas, rnd } from './utils.js';

// Procedural night HDRI: equirect sky (stars, moon glow, horizon lift,
// warm cabin spill, dark ground) baked through PMREM so every PBR
// material gets believable environment response.
export function applyEnvironment(scene, renderer) {
  const [c, ctx] = makeCanvas(512, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#02030a');
  g.addColorStop(0.42, '#0a1226');
  g.addColorStop(0.52, '#162033');
  g.addColorStop(0.56, '#05060a');
  g.addColorStop(1, '#010101');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // stars in the upper sky
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 120;
    ctx.fillStyle = `rgba(220,230,255,${rnd(0.2, 0.9)})`;
    const s = Math.random() < 0.9 ? 1 : 2;
    ctx.fillRect(x, y, s, s);
  }
  // moon glow (matches the moon direction, upper-left sky)
  const moon = ctx.createRadialGradient(150, 58, 2, 150, 58, 60);
  moon.addColorStop(0, 'rgba(235,242,255,1)');
  moon.addColorStop(0.12, 'rgba(215,228,255,0.8)');
  moon.addColorStop(1, 'rgba(150,170,220,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(80, 0, 150, 130);
  // warm spill near the horizon (porch + campfire side)
  const warm = ctx.createRadialGradient(400, 138, 2, 400, 138, 70);
  warm.addColorStop(0, 'rgba(255,170,90,0.55)');
  warm.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(320, 70, 160, 140);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.35;
  tex.dispose();
  pmrem.dispose();
}
