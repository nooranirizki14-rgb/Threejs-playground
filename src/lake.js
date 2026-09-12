import * as THREE from 'three';

// Animated night water: rippled normals, fresnel sky reflection,
// stretched moon glitter path, rain speckles. Fog-aware shader.
export class Lake {
  constructor(scene) {
    const moonDir = new THREE.Vector3(-30, 45, -130)
      .sub(new THREE.Vector3(0, 0, -57))
      .normalize();

    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uRain: { value: 1 },
        uMoonDir: { value: moonDir },
      },
    ]);

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      fog: true,
      vertexShader: /* glsl */`
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        uniform float uTime;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float w = sin(wp.x * 0.35 + uTime * 1.1) * sin(wp.z * 0.3 - uTime * 0.9);
          wp.y += w * 0.06;
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */`
        #include <fog_pars_fragment>
        varying vec3 vWorld;
        uniform float uTime;
        uniform float uRain;
        uniform vec3 uMoonDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 p = vWorld.xz;
          float t = uTime;
          // layered moving ripple normal (rain roughens the surface)
          float amp = 0.7 + 0.6 * uRain;
          float nx = (sin(p.x * 0.6 + t * 1.3) * 0.5
                   + sin(p.x * 1.7 - t * 2.1 + p.y * 0.8) * 0.3) * amp;
          float nz = (sin(p.y * 0.5 - t * 1.1) * 0.5
                   + sin(p.y * 1.9 + t * 1.7 + p.x * 0.6) * 0.3) * amp;
          vec3 n = normalize(vec3(nx * 0.18, 1.0, nz * 0.18));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);

          vec3 deep = vec3(0.012, 0.03, 0.05);
          vec3 skyRef = mix(vec3(0.05, 0.08, 0.14), vec3(0.02, 0.03, 0.07), fres);
          vec3 col = mix(deep, skyRef, 0.25 + 0.65 * fres);

          // moon glitter path, stretched toward the viewer
          vec3 ns = normalize(vec3(n.x * 0.3, n.y, n.z));
          vec3 R = reflect(-V, ns);
          float g = pow(max(dot(R, uMoonDir), 0.0), 180.0);
          float glitter = 0.5 + 0.5 * sin(t * 6.0 + hash(floor(p * 3.0)) * 40.0);
          col += vec3(0.75, 0.82, 1.0) * g * (1.2 + glitter);

          // cool spill near the moon's azimuth
          float az = 1.0 - clamp(abs(vWorld.x + 30.0) / 60.0, 0.0, 1.0);
          col += vec3(0.10, 0.13, 0.20) * az * az * 0.6;

          // rain speckles dancing on the surface
          if (uRain > 0.01) {
            vec2 cell = floor(p * 6.0) + floor(t * 10.0);
            float sp = step(0.994, hash(cell)) * uRain;
            col += vec3(0.35, 0.42, 0.55) * sp;
          }

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    });

    const geo = new THREE.PlaneGeometry(300, 66, 96, 24);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 0.02, -57);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.rainLevel = 1;
  }

  update(dt, t, rainOn) {
    const target = rainOn ? 1 : 0;
    this.rainLevel += (target - this.rainLevel) * Math.min(1, dt * 2);
    this.uniforms.uTime.value = t;
    this.uniforms.uRain.value = this.rainLevel;
  }
}
