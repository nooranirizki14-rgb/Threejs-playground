import * as THREE from 'three';

// GPU rain: streaks + splash rings following the camera.
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

export class Rain {
  constructor(scene, { streaks = 1300, rings = 160 } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const sgeo = instancedQuads(streaks, 4, (d, n, s) => {
      for (let i = 0; i < n; i++) {
        d[i * s] = Math.random();
        d[i * s + 1] = Math.random();
        d[i * s + 2] = Math.random();
        d[i * s + 3] = 17 + Math.random() * 9;
      }
    });
    this.sUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector2(55, 55) },
      uHeight: { value: 26 },
      uColor: { value: new THREE.Color(0xa8b2c4) },
      uOpacity: { value: 0.26 },
    };
    const smat = new THREE.ShaderMaterial({
      uniforms: this.sUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aData;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec2 uBox;
        uniform float uHeight;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float y = mod(aData.z * uHeight - uTime * aData.w, uHeight);
          vec2 drift = vec2(uTime * 1.2, uTime * 0.3);
          vec2 rel = mod(aData.xy * uBox + drift - uCamPos.xz, uBox) - uBox * 0.5;
          vec3 world = vec3(uCamPos.x + rel.x, y, uCamPos.z + rel.y);
          vec4 mv = viewMatrix * vec4(world, 1.0);
          float dist = max(-mv.z, 0.001);
          mv.xy += vec2(position.x * 0.035 + position.y * 0.14, position.y * 0.9);
          gl_Position = projectionMatrix * mv;
          vAlpha = (1.0 - smoothstep(22.0, 50.0, dist)) * smoothstep(0.4, 2.5, dist);
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
    this.streakMesh = new THREE.Mesh(sgeo, smat);
    this.streakMesh.frustumCulled = false;
    this.streakMesh.renderOrder = 5;
    this.group.add(this.streakMesh);

    const rgeo = instancedQuads(rings, 4, (d, n, s) => {
      for (let i = 0; i < n; i++) {
        d[i * s] = Math.random();
        d[i * s + 1] = Math.random();
        d[i * s + 2] = Math.random();
        d[i * s + 3] = 1.2 + Math.random() * 1.6;
      }
    });
    this.rUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uBox: { value: 50 },
      uColor: { value: new THREE.Color(0x7d8aa0) },
      uOpacity: { value: 0.4 },
    };
    const rmat = new THREE.ShaderMaterial({
      uniforms: this.rUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aData;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform float uBox;
        varying float vT;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float t = fract(uTime * aData.w + aData.z);
          vT = t;
          float r = mix(0.05, 0.45, t);
          vec2 rel = mod(aData.xy * uBox - uCamPos.xz, uBox) - uBox * 0.5;
          vec3 world = vec3(uCamPos.x + rel.x, 0.14, uCamPos.z + rel.y);
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
    this.ringMesh = new THREE.Mesh(rgeo, rmat);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 6;
    this.group.add(this.ringMesh);

    this.on = true;
  }

  setOn(on) {
    this.on = on;
    this.group.visible = on;
  }

  update(time, camPos) {
    if (!this.on) return;
    this.sUniforms.uTime.value = time;
    this.sUniforms.uCamPos.value.copy(camPos);
    this.rUniforms.uTime.value = time;
    this.rUniforms.uCamPos.value.copy(camPos);
  }
}
