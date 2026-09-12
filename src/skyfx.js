import * as THREE from 'three';
import { rnd, makeCanvas } from './utils.js';

// Sky dome gradient, lightning storm, lake mist, fireflies, lamp moths.
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

const LAMP_POS = new THREE.Vector3(0, 2.2, 0.5);

export class SkyFX {
  constructor(scene, hemi) {
    this.scene = scene;
    this.hemi = hemi;
    this.baseHemi = hemi.intensity;
    this.onThunder = null;

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
      this.ffBase[i * 3] = rnd(-12, 12);
      this.ffBase[i * 3 + 1] = rnd(0.3, 2.0);
      this.ffBase[i * 3 + 2] = rnd(-20, 6);
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
    this.nextStrike = rnd(6, 18);
    if (this.onThunder) this.onThunder();
  }

  update(dt, t, rainOn, lampOn) {
    if (rainOn) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) this.strike();
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    const f = this.flash <= 0 ? 0 : (Math.sin(this.flash * 28) * 0.5 + 0.5) * this.flash;
    this.boltMat.opacity = f * 0.95;
    this.domeUniforms.uFlash.value = f * 0.9;
    this.hemi.intensity = this.baseHemi + f * 2.2;

    for (const s of this.mists) {
      s.position.x += s.userData.v * dt;
      if (s.position.x > 75) s.position.x = -75;
    }

    this.fireflies.visible = !rainOn;
    if (!rainOn) {
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
