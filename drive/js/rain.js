import * as THREE from 'three';

// GPU rain following the camera: streaks + splash rings, intensity-driven.
function instancedQuads(count, itemSize, fill) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const data = new Float32Array(count * itemSize);
  fill(data, count, itemSize);
  geo.setAttribute('aData', new THREE.InstancedBufferAttribute(data, itemSize));
  geo.instanceCount = count;
  return geo;
}

export class RainStreaks {
  constructor(scene, { count = 2200 } = {}) {
    const geo = instancedQuads(count, 4, (d, n, s) => {
      for (let i = 0; i < n; i++) {
        d[i * s] = Math.random();
        d[i * s + 1] = Math.random();
        d[i * s + 2] = Math.random();
        d[i * s + 3] = 17 + Math.random() * 9;
      }
    });
    this.uniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector2(70, 70) },
      uHeight: { value: 32 },
      uWidth: { value: 0.035 },
      uLen: { value: 1.0 },
      uSlant: { value: 0.16 },
      uWindX: { value: 1.4 },
      uColor: { value: new THREE.Color(0x8fa8ff) },
      uOpacity: { value: 0.3 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aData;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec2 uBox;
        uniform float uHeight;
        uniform float uWidth;
        uniform float uLen;
        uniform float uSlant;
        uniform float uWindX;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float y = mod(aData.z * uHeight - uTime * aData.w, uHeight);
          vec2 drift = vec2(uTime * uWindX, uTime * 0.35);
          vec2 rel = mod(aData.xy * uBox + drift - uCamPos.xz, uBox) - uBox * 0.5;
          vec3 world = vec3(uCamPos.x + rel.x, y, uCamPos.z + rel.y);
          vec4 mv = viewMatrix * vec4(world, 1.0);
          float dist = max(-mv.z, 0.001);
          mv.xy += vec2(position.x * uWidth + position.y * uSlant * uLen,
                         position.y * uLen);
          gl_Position = projectionMatrix * mv;
          vAlpha = (1.0 - smoothstep(28.0, 62.0, dist)) * smoothstep(0.4, 3.0, dist);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          float a = sin(vUv.y * 3.14159);
          a *= a;
          gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  setIntensity(i) {
    this.uniforms.uOpacity.value = 0.04 + i * 0.3;
    this.mesh.visible = i > 0.03;
  }

  update(time, camPos) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCamPos.value.copy(camPos);
  }
}

export class SplashRings {
  constructor(scene, { count = 300 } = {}) {
    const geo = instancedQuads(count, 4, (d, n, s) => {
      for (let i = 0; i < n; i++) {
        d[i * s] = Math.random();
        d[i * s + 1] = Math.random();
        d[i * s + 2] = Math.random();
        d[i * s + 3] = 1.2 + Math.random() * 1.6;
      }
    });
    this.uniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: 60 },
      uMaxR: { value: 0.5 },
      uColor: { value: new THREE.Color(0x5f7dff) },
      uOpacity: { value: 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aData;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform float uBox;
        uniform float uMaxR;
        varying float vT;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float t = fract(uTime * aData.w + aData.z);
          vT = t;
          float r = mix(0.05, uMaxR, t);
          vec2 rel = mod(aData.xy * uBox - uCamPos.xz, uBox) - uBox * 0.5;
          vec3 world = vec3(uCamPos.x + rel.x, 0.035, uCamPos.z + rel.y);
          world.xz += position.xy * r * 2.0;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vT;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.5, 0.82, d) * (1.0 - smoothstep(0.82, 1.0, d));
          gl_FragColor = vec4(uColor, ring * (1.0 - vT) * uOpacity);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }

  setIntensity(i) {
    this.uniforms.uOpacity.value = 0.08 + i * 0.45;
    this.mesh.visible = i > 0.03;
  }

  update(time, camPos) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCamPos.value.copy(camPos);
  }
}
