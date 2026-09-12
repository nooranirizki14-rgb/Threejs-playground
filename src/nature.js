import * as THREE from 'three';
import { rnd, makeCanvas } from './utils.js';
import { makeGround } from './textures.js';

// Yard: PBR mud ground, wind-blown grass, pine silhouettes,
// mountains, pulsing stars, moon. (Lake in lake.js, sky dome in skyfx.js.)
const DECK = { x0: -7.5, x1: 7.5, z0: -3.5, z1: 5.5 };
const inDeck = (x, z) => x > DECK.x0 && x < DECK.x1 && z > DECK.z0 && z < DECK.z1;
const nearFire = (x, z, r) => Math.hypot(x + 8.5, z + 13) < r;
const inShed = (x, z) => Math.abs(x + 14.5) < 3 && Math.abs(z + 17.5) < 2.5;
const nearBench = (x, z) => Math.hypot(x - 13.5, z + 15.5) < 2.5;

function grassTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.random() * 56;
    const h = 24 + Math.random() * 38;
    const lean = (Math.random() - 0.5) * 14;
    const shade = 30 + Math.random() * 40;
    ctx.strokeStyle = `rgb(${shade * 0.45},${shade},${shade * 0.5})`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function glowTexture() {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(220,230,255,1)');
  grad.addColorStop(0.35, 'rgba(200,215,245,0.5)');
  grad.addColorStop(1, 'rgba(200,215,245,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Nature {
  constructor(scene) {
    // PBR mud: albedo variation, damp reflective patches, normal detail
    const gnd = makeGround();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({
        ...gnd, color: 0xbfc4bb, metalness: 0.25,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // grass tufts (instanced crossed planes, swaying in the wind)
    {
      const geo = new THREE.PlaneGeometry(1.3, 0.8);
      geo.translate(0, 0.4, 0);
      const mat = new THREE.MeshStandardMaterial({
        map: grassTexture(), alphaTest: 0.4, side: THREE.DoubleSide,
        roughness: 1, color: 0x9fb89f,
      });
      this.grassTime = { value: 0 };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.grassTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            vec4 gw = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              gw = instanceMatrix * gw;
            #endif
            float sway = sin(uTime * 1.6 + gw.x * 0.8 + gw.z * 0.6) * 0.5
                       + sin(uTime * 3.1 + gw.z * 1.7) * 0.2;
            transformed.x += sway * 0.12 * uv.y;
            transformed.z += sway * 0.06 * uv.y;
          }`
        );
      };
      const n = 320;
      const mesh = new THREE.InstancedMesh(geo, mat, n * 2);
      const d = new THREE.Object3D();
      let placed = 0;
      let guard = 0;
      while (placed < n && guard++ < 4000) {
        const x = rnd(-45, 45);
        const z = rnd(-60, 20);
        if (inDeck(x, z) || z < -22) continue;
        if (nearFire(x, z, 2)) continue;
        const s = rnd(0.6, 1.7);
        for (let k = 0; k < 2; k++) {
          d.position.set(x, 0, z);
          d.scale.set(s, s, s);
          d.rotation.set(0, rnd(0, Math.PI) + (k * Math.PI) / 2, 0);
          d.updateMatrix();
          mesh.setMatrixAt(placed * 2 + k, d.matrix);
        }
        placed++;
      }
      mesh.count = placed * 2;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    // pine trees (dark silhouettes, kept clear of paths and hangouts)
    {
      const geo = new THREE.ConeGeometry(1, 1, 7);
      const mat = new THREE.MeshBasicMaterial({ color: 0x060a08 });
      const n = 70;
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      const d = new THREE.Object3D();
      let placed = 0;
      let guard = 0;
      while (placed < n && guard++ < 2000) {
        const x = rnd(-85, 85);
        const z = rnd(-110, 18);
        if (inDeck(x, z)) continue;
        if (z < -22 && z > -95 && Math.abs(x) < 60) continue; // keep the lake view open
        if (nearFire(x, z, 4.5) || inShed(x, z) || nearBench(x, z)) continue;
        const w = rnd(3, 6.5);
        const h = rnd(7, 15);
        d.position.set(x, h / 2 - 0.2, z);
        d.scale.set(w, h, w);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(placed, d.matrix);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    // (the lake + moon glint now come from the Lake shader in lake.js)

    // mountains
    {
      const mat = new THREE.MeshBasicMaterial({ color: 0x0a1020 });
      const spots = [
        [-90, -135, 42, 40], [-45, -125, 34, 32], [0, -140, 48, 44],
        [50, -128, 36, 30], [95, -138, 44, 38], [-130, -120, 30, 24], [135, -122, 32, 26],
      ];
      for (const [x, z, r, h] of spots) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
        m.position.set(x, h / 2 - 2, z);
        m.rotation.y = rnd(0, Math.PI);
        scene.add(m);
      }
    }

    // stars (gently twinkling)
    {
      const N = 900;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI * 0.48 + 0.03;
        const r = 380;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
        pos[i * 3 + 1] = Math.sin(e) * r;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.starsMat = new THREE.PointsMaterial({
        color: 0xcfd8ff, size: 1.4, sizeAttenuation: false,
        transparent: true, opacity: 0.8, fog: false, depthWrite: false,
      });
      const stars = new THREE.Points(g, this.starsMat);
      stars.frustumCulled = false;
      scene.add(stars);
    }

    // moon + halo
    const glowTex = glowTexture();
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xf2f5ff, transparent: true, opacity: 0.95,
      fog: false, depthWrite: false,
    }));
    moon.scale.set(9, 9, 1);
    moon.position.set(-30, 45, -130);
    scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x8fa0d8, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, fog: false, depthWrite: false,
    }));
    halo.scale.set(26, 26, 1);
    halo.position.copy(moon.position);
    scene.add(halo);

    this.t = 0;
  }

  update(dt, t) {
    this.t += dt;
    this.grassTime.value = t;
    this.starsMat.opacity = 0.72 + Math.sin(t * 1.3) * 0.06 + Math.sin(t * 3.7) * 0.03;
  }
}
