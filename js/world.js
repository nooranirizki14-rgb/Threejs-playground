import * as THREE from 'three';

// Scrolling neon grid ground (custom shader — crisp lines at any distance).
const GRID_VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GRID_FRAG = `
varying vec3 vWorldPos;
uniform float uOffset;
void main() {
  vec2 p = vec2(vWorldPos.x, vWorldPos.z + uOffset);
  // minor grid (every 2 units)
  vec2 q1 = p / 2.0;
  vec2 g1 = abs(fract(q1 - 0.5) - 0.5) / fwidth(q1);
  float minorLine = 1.0 - min(min(g1.x, g1.y), 1.0);
  // major grid (every 10 units)
  vec2 q2 = p / 10.0;
  vec2 g2 = abs(fract(q2 - 0.5) - 0.5) / fwidth(q2);
  float majorLine = 1.0 - min(min(g2.x, g2.y), 1.0);
  float dist = length(vWorldPos.xz - cameraPosition.xz);
  float fade = exp(-dist * 0.022);
  vec3 col = vec3(0.012, 0.004, 0.045);
  col += vec3(0.05, 0.75, 1.0) * minorLine * 0.35 * fade;
  col += vec3(1.0, 0.18, 0.75) * majorLine * 0.8 * fade;
  // subtle glow on the track area
  float track = smoothstep(5.5, 1.5, abs(vWorldPos.x));
  col += vec3(0.10, 0.02, 0.16) * track * fade;
  // bright track edge rails
  float rail = smoothstep(0.25, 0.05, abs(abs(vWorldPos.x) - 4.4));
  col += vec3(1.0, 0.2, 0.85) * rail * (0.4 + 0.6 * fade);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Classic synthwave striped sun.
const SUN_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SUN_FRAG = `
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  vec3 top = vec3(1.0, 0.82, 0.25);
  vec3 mid = vec3(1.0, 0.35, 0.55);
  vec3 bot = vec3(0.75, 0.15, 0.85);
  vec3 col = mix(bot, mid, smoothstep(-0.5, 0.1, c.y));
  col = mix(col, top, smoothstep(0.05, 0.5, c.y));
  // slats in the lower half, drifting upward
  float y = vUv.y;
  if (y < 0.46) {
    float bars = fract((0.46 - y) * 16.0 - uTime * 0.7);
    float thickness = (0.46 - y) * 2.2;
    if (bars < thickness) discard;
  }
  col += vec3(0.35, 0.1, 0.3) * smoothstep(0.75, 1.0, r);
  gl_FragColor = vec4(col, 1.0);
}
`;

const PILLAR_COUNT = 44;
const RING_COUNT = 5;
const RING_SPACING = 45;
const DUST_COUNT = 220;
const STAR_COUNT = 700;

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030014);
    this.scene.fog = new THREE.Fog(0x0a0224, 25, 150);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(0, 4.6, 8);
    this.camera.lookAt(0, 1.3, -10);

    // ---- lights ----
    this.scene.add(new THREE.HemisphereLight(0x9988ff, 0x0a0a20, 0.8));
    const key = new THREE.DirectionalLight(0xff66ff, 1.4);
    key.position.set(-10, 16, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -20;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.002;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x00e5ff, 0.7);
    rim.position.set(8, 10, -18);
    this.scene.add(rim);

    this.time = 0;
    this.dummy = new THREE.Object3D();

    this.buildGround();
    this.buildSun();
    this.buildStars();
    this.buildPillars();
    this.buildRings();
    this.buildDust();

    window.addEventListener('resize', () => this.onResize());
  }

  buildGround() {
    this.gridUniforms = { uOffset: { value: 0 } };
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 440),
      new THREE.ShaderMaterial({
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
        uniforms: this.gridUniforms,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -120);
    this.scene.add(ground);

    // invisible catcher so the player/obstacles cast real shadows on the shader ground
    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 120),
      new THREE.ShadowMaterial({ opacity: 0.4 })
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(0, 0.02, -30);
    catcher.receiveShadow = true;
    this.scene.add(catcher);
  }

  buildSun() {
    this.sunUniforms = { uTime: { value: 0 } };
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(20, 48),
      new THREE.ShaderMaterial({
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
        uniforms: this.sunUniforms,
      })
    );
    sun.position.set(0, 15, -170);
    this.scene.add(sun);
  }

  buildStars() {
    const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 250 + Math.random() * 130;
      const theta = Math.random() * Math.PI * 2;
      const phi = 0.05 + Math.random() * 1.35;
      pos[i * 3] = r * Math.cos(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) + 4;
      pos[i * 3 + 2] = -Math.abs(r * Math.cos(phi) * Math.sin(theta)) - 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcfd8ff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    stars.frustumCulled = false;
    this.scene.add(stars);
  }

  buildPillars() {
    this.pillarData = [];
    for (let i = 0; i < PILLAR_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pillarData.push({
        side,
        x: side * (7.5 + Math.random() * 7),
        z: -174 + (i / PILLAR_COUNT) * 190 + Math.random() * 4,
        w: 1.6 + Math.random() * 1.8,
        h: 4 + Math.random() * 13,
      });
    }
    this.pillars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0c0c2c, emissive: 0x2a1a88, emissiveIntensity: 0.5,
        roughness: 0.7, metalness: 0.3,
      }),
      PILLAR_COUNT
    );
    this.pillarCaps = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff2fd6 }),
      PILLAR_COUNT
    );
    this.pillars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pillarCaps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pillars.frustumCulled = false;
    this.pillarCaps.frustumCulled = false;
    this.scene.add(this.pillars);
    this.scene.add(this.pillarCaps);
  }

  buildRings() {
    this.rings = [];
    const ringGeo = new THREE.TorusGeometry(6.2, 0.13, 12, 64);
    const mats = [
      new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
      new THREE.MeshBasicMaterial({ color: 0xff2fd6 }),
    ];
    for (let i = 0; i < RING_COUNT; i++) {
      const m = new THREE.Mesh(ringGeo, mats[i % 2]);
      m.position.set(0, 4.6, -20 - i * RING_SPACING);
      this.scene.add(m);
      this.rings.push(m);
    }
  }

  buildDust() {
    this.dustCount = DUST_COUNT;
    this.dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      this.dustPos[i * 3] = (Math.random() - 0.5) * 24;
      this.dustPos[i * 3 + 1] = Math.random() * 10;
      this.dustPos[i * 3 + 2] = -68 + Math.random() * 80;
    }
    const geo = new THREE.BufferGeometry();
    this.dustAttr = new THREE.BufferAttribute(this.dustPos, 3);
    this.dustAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.dustAttr);
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x66ddff, size: 0.12, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    dust.frustumCulled = false;
    this.scene.add(dust);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(dt, speed) {
    this.time += dt;
    this.gridUniforms.uOffset.value += speed * dt;
    this.sunUniforms.uTime.value = this.time;
    const dz = speed * dt;
    const d = this.dummy;

    // scrolling city pillars (instanced = 2 draw calls for the whole city)
    for (let i = 0; i < this.pillarData.length; i++) {
      const P = this.pillarData[i];
      P.z += dz;
      if (P.z > 16) {
        P.z -= 190;
        P.h = 4 + Math.random() * 13;
        P.x = P.side * (7.5 + Math.random() * 7);
      }
      d.position.set(P.x, P.h / 2 - 0.1, P.z);
      d.scale.set(P.w, P.h, P.w);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.pillars.setMatrixAt(i, d.matrix);
      d.position.set(P.x, P.h - 0.01, P.z);
      d.scale.set(P.w * 1.06, 0.18, P.w * 1.06);
      d.updateMatrix();
      this.pillarCaps.setMatrixAt(i, d.matrix);
    }
    this.pillars.instanceMatrix.needsUpdate = true;
    this.pillarCaps.instanceMatrix.needsUpdate = true;

    // light rings over the track
    const span = RING_COUNT * RING_SPACING;
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      r.position.z += dz;
      if (r.position.z > 15) r.position.z -= span;
      const s = 1 + Math.sin(this.time * 2 + i * 1.3) * 0.02;
      r.scale.set(s, s, 1);
    }

    // drifting dust motes
    const step = (1.2 + speed * 0.35) * dt;
    for (let i = 0; i < this.dustCount; i++) {
      let z = this.dustPos[i * 3 + 2] + step;
      if (z > 12) z -= 80;
      this.dustPos[i * 3 + 2] = z;
    }
    this.dustAttr.needsUpdate = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
