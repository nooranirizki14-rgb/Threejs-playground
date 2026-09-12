import * as THREE from 'three';
import { rnd, makeCanvas } from './utils.js';

// Sky dome, aurora, meteors, storm clouds, lightning, lake mist,
// fireflies, lamp moths. rainLevel: 0 clear, 1 drizzle, 2 storm.
function softTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function cloudTexture() {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 46; i++) {
    const x = 20 + Math.random() * 216;
    const y = 30 + Math.random() * 68;
    const rx = rnd(18, 60);
    const ry = rnd(10, 26);
    const g = ctx.createRadialGradient(x, y, 1, x, y, rx);
    g.addColorStop(0, `rgba(255,255,255,${rnd(0.1, 0.28)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

const LAMP_POS = new THREE.Vector3(0, 2.2, 0.5);

export class SkyFX {
  constructor(scene, hemi) {
    this.scene = scene;
    this.hemi = hemi;
    this.baseHemi = hemi.intensity;
    this.onThunder = null;
    this.onMeteor = null;
    this.level = 2;

    // gradient night dome (replaces the flat background color)
    this.domeUniforms = { uFlash: { value: 0 } };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(360, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.domeUniforms,
        vertexShader: /* glsl */`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform float uFlash;
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 zen = vec3(0.012, 0.016, 0.035);
            vec3 hor = vec3(0.06, 0.09, 0.16);
            vec3 col = mix(hor, zen, smoothstep(0.0, 0.5, h));
            col = mix(col, vec3(0.02, 0.025, 0.05), smoothstep(0.0, -0.3, h));
            col += vec3(0.5, 0.55, 0.7) * uFlash;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    scene.add(dome);

    // aurora curtains high in the north sky
    this.auroraUniforms = { uTime: { value: 0 }, uClear: { value: 0.25 } };
    const aurora = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 70),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.auroraUniforms,
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform float uTime;
          uniform float uClear;
          varying vec2 vUv;
          void main() {
            float rays = sin(vUv.x * 36.0 + sin(vUv.x * 13.0 + uTime * 0.4) * 1.5 + uTime * 0.25);
            rays = smoothstep(-0.2, 1.0, rays);
            float vert = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
            float shimmer = 0.75 + 0.25 * sin(uTime * 1.3 + vUv.x * 20.0);
            vec3 col = mix(vec3(0.1, 0.9, 0.45), vec3(0.5, 0.3, 0.9), smoothstep(0.1, 0.7, vUv.y));
            float a = rays * vert * shimmer * 0.4 * uClear;
            gl_FragColor = vec4(col * a, a);
          }
        `,
      })
    );
    aurora.position.set(0, 95, -190);
    aurora.frustumCulled = false;
    aurora.renderOrder = -9;
    scene.add(aurora);

    // meteors (clear skies only)
    this.meteors = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xd8e4ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const line = new THREE.Line(g, mat);
      line.frustumCulled = false;
      scene.add(line);
      this.meteors.push({ line, mat, t: 1e9, dur: 0.9, x: 0, y: 0, z: 0, vx: 0, vy: 0 });
    }
    this.meteorTimer = rnd(6, 14);

    // drifting storm clouds (lightning flashes through them)
    const cloudTex = cloudTexture();
    this.cloudMats = [];
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.SpriteMaterial({
        map: cloudTex, color: 0x0e1420, transparent: true,
        opacity: rnd(0.55, 0.85), depthWrite: false, fog: false,
      });
      const s = new THREE.Sprite(m);
      const sc = rnd(90, 150);
      s.scale.set(sc, sc * 0.42, 1);
      s.position.set(rnd(-180, 180), rnd(58, 95), rnd(-220, -60));
      s.userData.v = rnd(1.2, 2.6);
      scene.add(s);
      this.clouds.push(s);
      this.cloudMats.push(m);
    }

    // lightning bolt (regenerated polyline per strike)
    this.boltN = 22;
    this.boltGeo = new THREE.BufferGeometry();
    this.boltPos = new Float32Array(this.boltN * 3);
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3));
    this.boltMat = new THREE.LineBasicMaterial({
      color: 0xcfe0ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.bolt = new THREE.Line(this.boltGeo, this.boltMat);
    this.bolt.frustumCulled = false;
    scene.add(this.bolt);
    this.flash = 0;
    this.nextStrike = rnd(4, 10);

    // drifting mist over the lake
    const soft = softTexture();
    this.mists = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: soft, color: 0x8fa3c8, transparent: true,
        opacity: rnd(0.05, 0.11), depthWrite: false,
      }));
      const sc = rnd(18, 34);
      s.scale.set(sc, sc * 0.36, 1);
      s.position.set(rnd(-70, 70), rnd(0.6, 2.2), rnd(-85, -26));
      s.userData.v = rnd(0.2, 0.7);
      scene.add(s);
      this.mists.push(s);
    }

    // fireflies (appear when the rain stops)
    const FF = 46;
    this.ffBase = new Float32Array(FF * 3);
    this.ffSeed = new Float32Array(FF * 3);
    const ffPos = new Float32Array(FF * 3);
    for (let i = 0; i < FF; i++) {
      this.ffBase[i * 3] = rnd(-17, 17);
      this.ffBase[i * 3 + 1] = rnd(0.3, 2.0);
      this.ffBase[i * 3 + 2] = rnd(-21, 9);
      this.ffSeed[i * 3] = rnd(0, 20);
      this.ffSeed[i * 3 + 1] = rnd(0, 20);
      this.ffSeed[i * 3 + 2] = rnd(0, 20);
    }
    this.ffGeo = new THREE.BufferGeometry();
    this.ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    this.ffMat = new THREE.PointsMaterial({
      color: 0xb8ff7a, size: 0.09, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.fireflies = new THREE.Points(this.ffGeo, this.ffMat);
    this.fireflies.frustumCulled = false;
    this.fireflies.visible = false;
    scene.add(this.fireflies);

    // moths circling the porch lamp
    const MO = 10;
    this.moSeed = new Float32Array(MO * 2);
    const moPos = new Float32Array(MO * 3);
    for (let i = 0; i < MO; i++) {
      this.moSeed[i * 2] = rnd(0, Math.PI * 2);
      this.moSeed[i * 2 + 1] = rnd(1.5, 3.5);
    }
    this.moGeo = new THREE.BufferGeometry();
    this.moGeo.setAttribute('position', new THREE.BufferAttribute(moPos, 3));
    this.moMat = new THREE.PointsMaterial({
      color: 0xffd9a0, size: 0.05, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.moths = new THREE.Points(this.moGeo, this.moMat);
    this.moths.frustumCulled = false;
    scene.add(this.moths);
  }

  strike() {
    let x = rnd(-90, 40);
    let z = rnd(-140, -80);
    const arr = this.boltPos;
    for (let i = 0; i < this.boltN; i++) {
      const y = 62 - (i / (this.boltN - 1)) * 54;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
      x += rnd(-7, 7);
      z += rnd(-3, 3);
    }
    this.boltGeo.getAttribute('position').needsUpdate = true;
    this.flash = 1;
    this.nextStrike = this.level === 2 ? rnd(6, 18) : rnd(18, 40);
    if (this.onThunder) this.onThunder();
  }

  launchMeteor() {
    const m = this.meteors.find((k) => k.t >= k.dur);
    if (!m) return;
    m.t = 0;
    m.x = rnd(-150, 150);
    m.y = rnd(90, 160);
    m.z = rnd(-260, -120);
    m.vx = rnd(-70, -40);
    m.vy = rnd(-40, -25);
    if (this.onMeteor) this.onMeteor();
  }

  update(dt, t, rainLevel, lampOn) {
    this.level = rainLevel;
    if (rainLevel >= 1) {
      this.nextStrike -= dt * (rainLevel === 2 ? 1 : 0.35);
      if (this.nextStrike <= 0) this.strike();
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    const f = this.flash <= 0 ? 0 : (Math.sin(this.flash * 28) * 0.5 + 0.5) * this.flash;
    this.boltMat.opacity = f * 0.95;
    this.domeUniforms.uFlash.value = f * 0.9;
    this.hemi.intensity = this.baseHemi + f * 2.2;
    for (const cm of this.cloudMats) {
      cm.color.setRGB(0.055 + f * 0.5, 0.078 + f * 0.55, 0.125 + f * 0.6);
    }

    // aurora breathes stronger on clear nights
    this.auroraUniforms.uTime.value = t;
    const clearTarget = rainLevel === 0 ? 1 : 0.25;
    this.auroraUniforms.uClear.value += (clearTarget - this.auroraUniforms.uClear.value) * Math.min(1, dt);

    // meteors on clear nights
    if (rainLevel === 0) {
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = rnd(8, 22);
        this.launchMeteor();
      }
    }
    for (const m of this.meteors) {
      if (m.t >= m.dur) {
        m.mat.opacity = 0;
        continue;
      }
      m.t += dt;
      const hx = m.x + m.vx * m.t;
      const hy = m.y + m.vy * m.t;
      const a = m.line.geometry.getAttribute('position').array;
      a[0] = hx; a[1] = hy; a[2] = m.z;
      a[3] = hx - m.vx * 0.12; a[4] = hy - m.vy * 0.12; a[5] = m.z;
      m.line.geometry.getAttribute('position').needsUpdate = true;
      m.mat.opacity = Math.sin(Math.min(1, m.t / m.dur) * Math.PI) * 0.9;
    }

    for (const s of this.clouds) {
      s.position.x += s.userData.v * dt;
      if (s.position.x > 200) s.position.x = -200;
    }
    for (const s of this.mists) {
      s.position.x += s.userData.v * dt;
      if (s.position.x > 75) s.position.x = -75;
    }

    this.fireflies.visible = rainLevel === 0;
    if (rainLevel === 0) {
      const attr = this.ffGeo.getAttribute('position');
      const a = attr.array;
      for (let i = 0; i < a.length / 3; i++) {
        const s0 = this.ffSeed[i * 3];
        const s1 = this.ffSeed[i * 3 + 1];
        const s2 = this.ffSeed[i * 3 + 2];
        a[i * 3] = this.ffBase[i * 3] + Math.sin(t * 0.5 + s0) * 1.2;
        a[i * 3 + 1] = this.ffBase[i * 3 + 1] + Math.sin(t * 0.9 + s1) * 0.4;
        a[i * 3 + 2] = this.ffBase[i * 3 + 2] + Math.cos(t * 0.4 + s2) * 1.2;
      }
      attr.needsUpdate = true;
      this.ffMat.opacity = 0.55 + 0.4 * Math.sin(t * 2.1);
    }

    this.moths.visible = lampOn;
    if (lampOn) {
      const attr = this.moGeo.getAttribute('position');
      const a = attr.array;
      for (let i = 0; i < a.length / 3; i++) {
        const s = this.moSeed[i * 2];
        const sp = this.moSeed[i * 2 + 1];
        const ang = t * sp + s;
        const r = 0.4 + (i % 3) * 0.18;
        a[i * 3] = LAMP_POS.x + Math.cos(ang) * r;
        a[i * 3 + 1] = LAMP_POS.y + Math.sin(t * 3 + s) * 0.25;
        a[i * 3 + 2] = LAMP_POS.z + Math.sin(ang) * r * 0.7;
      }
      attr.needsUpdate = true;
    }
  }
}
