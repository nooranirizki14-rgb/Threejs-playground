import * as THREE from 'three';
import { makeCanvas, rnd } from './utils.js';
import { makeWood, makePlaid, addAO } from './textures.js';

// Enterable cabin interior: wood room, couch (sittable), coffee table, rug,
// bookshelf, paintings, floor lamp, dog bed. Doorway at x 1.975..3.025.
function paintingTexture(variant) {
  const [c, ctx] = makeCanvas(128, 96);
  const sky = ctx.createLinearGradient(0, 0, 0, 96);
  if (variant === 0) {
    sky.addColorStop(0, '#0a1428');
    sky.addColorStop(0.6, '#1a2a4a');
  } else {
    sky.addColorStop(0, '#1a0f28');
    sky.addColorStop(0.6, '#3a2040');
  }
  sky.addColorStop(0.61, '#0a0f1a');
  sky.addColorStop(1, '#05080f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#e8ecf5';
  ctx.beginPath();
  ctx.arc(variant === 0 ? 96 : 30, 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,230,255,0.35)';
  ctx.fillRect(variant === 0 ? 94 : 28, 58, 4, 38);
  ctx.fillStyle = '#060a12';
  ctx.beginPath();
  ctx.moveTo(0, 58);
  ctx.lineTo(40, 25);
  ctx.lineTo(70, 58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(45, 58);
  ctx.lineTo(90, 30);
  ctx.lineTo(128, 58);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Cabin {
  constructor(scene) {
    this.boxes = [];
    this.circles = [];
    const warmTex = makeWood({ base: '#5a3a20', dark: '#2a1808', planks: 5, rx: 3, ry: 1, weather: 0.1 });
    const warm = new THREE.MeshStandardMaterial({ ...warmTex, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x241608, roughness: 1 });

    // floor (top flush with the deck) + walls + ceiling
    const floor = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.12, 4.6), warm);
    floor.position.set(1.15, 0.06, 8.05);
    floor.receiveShadow = true;
    scene.add(floor);
    const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3.4, 0.3), warm);
    back.position.set(1.15, 1.7, 10.5);
    back.receiveShadow = true;
    scene.add(back);
    for (const sx of [-3.7, 6.0]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 4.9), warm);
      side.position.set(sx, 1.7, 8.05);
      side.receiveShadow = true;
      scene.add(side);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.9), dark);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(1.15, 3.05, 8.05);
    scene.add(ceil);
    // doorway trim
    for (const jx of [1.94, 3.06]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.34), dark);
      jamb.position.set(jx, 1.27, 5.6);
      scene.add(jamb);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.34), dark);
    header.position.set(2.5, 2.42, 5.6);
    scene.add(header);

    // couch facing the doorway (sit + look out at the storm)
    const fabric = new THREE.MeshStandardMaterial({ color: 0x2a4038, roughness: 1 });
    const couch = new THREE.Group();
    couch.position.set(1.2, 0, 9.3);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.85), fabric);
    base.position.y = 0.33;
    base.castShadow = true;
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 0.25), fabric);
    backrest.position.set(0, 0.75, 0.32);
    couch.add(base, backrest);
    for (const ax of [-0.825, 0.825]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.85), fabric);
      arm.position.set(ax, 0.5, 0);
      couch.add(arm);
    }
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xb8903a, roughness: 1 })
    );
    pillow.position.set(-0.55, 0.65, 0.15);
    pillow.rotation.z = 0.15;
    couch.add(pillow);
    const throwTex = makePlaid('#4a3a52', '#22202a', 1, 1);
    const throwB = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ ...throwTex, roughness: 1 })
    );
    throwB.position.set(0.825, 0.84, 0);
    couch.add(throwB);
    scene.add(couch);
    addAO(scene, 1.2, 0.145, 9.3, 2.4, 1.4, 0.9);
    this.circles.push({ x: 1.2, z: 9.3, r: 1.0 });

    // coffee table + mug + book
    const ctable = new THREE.Group();
    ctable.position.set(1.2, 0, 8.2);
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.5), warm);
    ctop.position.y = 0.45;
    ctop.castShadow = true;
    ctable.add(ctop);
    for (const [lx, lz] of [[-0.44, -0.19], [0.44, -0.19], [-0.44, 0.19], [0.44, 0.19]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.33, 0.06), dark);
      leg.position.set(lx, 0.285, lz);
      ctable.add(leg);
    }
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.4 })
    );
    mug.position.set(-0.2, 0.53, 0.05);
    const cbook = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, 0.17),
      new THREE.MeshStandardMaterial({ color: 0x1f3a5a, roughness: 0.7 })
    );
    cbook.position.set(0.2, 0.5, -0.05);
    cbook.rotation.y = -0.4;
    ctable.add(mug, cbook);
    scene.add(ctable);
    this.circles.push({ x: 1.2, z: 8.2, r: 0.6 });

    // rug
    const rugTex = makePlaid('#5a2a2a', '#1a1a1a', 2, 1.5);
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.02, 1.4),
      new THREE.MeshStandardMaterial({ ...rugTex, roughness: 1 })
    );
    rug.position.set(1.2, 0.13, 8.7);
    rug.receiveShadow = true;
    scene.add(rug);

    // bookshelf with books
    const shelf = new THREE.Group();
    shelf.position.set(-2.9, 0, 10.05);
    const shelfMat = dark;
    for (const sy of [0.2, 0.8, 1.4, 1.95]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.3), shelfMat);
      plank.position.y = sy;
      shelf.add(plank);
    }
    for (const sx of [-0.57, 0.57]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.85, 0.3), shelfMat);
      side.position.set(sx, 1.07, 0);
      shelf.add(side);
    }
    const bookCols = [0x8a2a2a, 0x2a5a8a, 0x3a7a3a, 0xb8903a, 0x6a3a8a, 0x8a5a2a];
    for (let row = 0; row < 2; row++) {
      let bx = -0.48;
      while (bx < 0.45) {
        const bw = rnd(0.05, 0.09);
        const bh = rnd(0.22, 0.32);
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, 0.2),
          new THREE.MeshStandardMaterial({ color: bookCols[(Math.random() * bookCols.length) | 0], roughness: 0.8 })
        );
        book.position.set(bx + bw / 2, (row === 0 ? 0.23 : 0.83) + bh / 2, 0);
        shelf.add(book);
        bx += bw + 0.012;
      }
    }
    scene.add(shelf);
    addAO(scene, -2.9, 0.145, 10.05, 1.6, 0.7, 0.9);
    this.boxes.push({ x0: -3.55, x1: -2.25, z0: 9.85, z1: 10.35 });

    // paintings on the back wall
    [[3.6, 0], [4.5, 1]].forEach(([px, v]) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), dark);
      frame.position.set(px, 1.9, 10.33);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.5),
        new THREE.MeshBasicMaterial({ map: paintingTexture(v) })
      );
      art.position.set(px, 1.9, 10.3);
      art.rotation.y = Math.PI;
      scene.add(frame, art);
    });

    // floor lamp (the interior light)
    const lampG = new THREE.Group();
    lampG.position.set(4.6, 0, 9.5);
    const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 12), dark);
    lbase.position.y = 0.145;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8), dark);
    pole.position.y = 0.9;
    this.shadeMat = new THREE.MeshStandardMaterial({
      color: 0xd8c8a8, emissive: 0xffc98a, emissiveIntensity: 0.9,
      roughness: 0.8, side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 12, 1, true), this.shadeMat);
    shade.position.y = 1.7;
    this.bulbMat = new THREE.MeshStandardMaterial({
      color: 0x201408, emissive: 0xffd9a0, emissiveIntensity: 2, roughness: 0.4,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.bulbMat);
    bulb.position.y = 1.62;
    lampG.add(lbase, pole, shade, bulb);
    scene.add(lampG);
    this.lampLight = new THREE.PointLight(0xffc98a, 12, 14, 2);
    this.lampLight.position.set(4.6, 1.6, 9.5);
    scene.add(this.lampLight);
    addAO(scene, 4.6, 0.145, 9.5, 0.7, 0.7, 0.8);
    this.circles.push({ x: 4.6, z: 9.5, r: 0.3 });

    // dog bed
    const bedG = new THREE.Group();
    bedG.position.set(-2.2, 0, 6.6);
    const bedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.6, 0.15, 14),
      new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 })
    );
    bedBase.position.y = 0.195;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.13, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.27;
    bedG.add(bedBase, rim);
    scene.add(bedG);

    // colliders: wall segments, room shell, exterior blockers
    this.boxes.push({ x0: -7.5, x1: 1.975, z0: 5.45, z1: 5.75 });   // front wall L
    this.boxes.push({ x0: 3.025, x1: 7.5, z0: 5.45, z1: 5.75 });    // front wall R
    this.boxes.push({ x0: -3.7, x1: 6.2, z0: 10.35, z1: 10.7 });    // back wall
    this.boxes.push({ x0: -3.85, x1: -3.55, z0: 5.6, z1: 10.5 });   // side L
    this.boxes.push({ x0: 5.85, x1: 6.15, z0: 5.6, z1: 10.5 });     // side R
    this.boxes.push({ x0: -7.6, x1: -3.55, z0: 5.75, z1: 10.7 });   // exterior L
    this.boxes.push({ x0: 5.85, x1: 7.6, z0: 5.75, z1: 10.7 });     // exterior R
    this.lightsOn = true;
  }

  setLights(on) {
    this.lightsOn = on;
    this.lampLight.visible = on;
    this.bulbMat.emissiveIntensity = on ? 2 : 0;
    this.shadeMat.emissiveIntensity = on ? 0.9 : 0;
  }
}
