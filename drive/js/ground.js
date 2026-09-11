import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { makePuddle, makeNoise } from './textures.js';

// Wet asphalt highway: planar reflection + puddles + ripple + roughness blur.
const WetShader = {
  name: 'WetRoad',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    tRipple: { value: null },
    tPuddle: { value: null },
    uReflectivity: { value: 1.0 },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPos;
    #include <common>
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform sampler2D tRipple;
    uniform sampler2D tPuddle;
    uniform float uReflectivity;
    varying vec4 vUv;
    varying vec3 vWorldPos;
    #include <fog_pars_fragment>
    void main() {
      vec2 wXZ = vWorldPos.xz;
      float puddle = texture2D(tPuddle, wXZ * 0.03).r;
      puddle = smoothstep(0.30, 0.70, puddle);
      vec2 ruv1 = wXZ * 0.09 + vec2(uTime * 0.030, uTime * 0.017);
      vec2 ruv2 = wXZ * 0.061 - vec2(uTime * 0.021, uTime * 0.026);
      vec2 ripple = (texture2D(tRipple, ruv1).rg - 0.5)
                  + (texture2D(tRipple, ruv2).rg - 0.5);
      vec4 uv = vUv;
      float distortAmt = 0.010 + 0.055 * (1.0 - puddle);
      uv.xy += ripple * distortAmt * uv.w;
      vec3 sharp = texture2DProj(tDiffuse, uv).rgb;
      vec2 px = vec2(0.0045) * uv.w;
      vec3 rough = sharp * 0.4
        + texture2DProj(tDiffuse, uv + vec4(px.x, 0.0, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv - vec4(px.x, 0.0, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv + vec4(0.0, px.y, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv - vec4(0.0, px.y, 0.0, 0.0)).rgb * 0.15;
      vec3 refl = mix(rough, sharp, puddle);
      float grain = texture2D(tRipple, wXZ * 0.33).b;
      vec3 asphalt = vec3(0.014, 0.015, 0.028) * (0.7 + 0.6 * grain);
      vec3 col = asphalt * (1.0 - puddle * 0.55)
               + refl * color * (0.20 + 0.80 * puddle) * uReflectivity;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
};

export class Ground {
  constructor(scene, { width = 26, length = 440 } = {}) {
    this.rippleTex = makeNoise({ size: 128 });
    this.puddleTex = makePuddle({ size: 512, blobs: 34 });

    const geo = new THREE.PlaneGeometry(width, length);
    this.reflector = new Reflector(geo, {
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.003,
      multisample: 0,
      color: 0xdfeaf5,
      shader: WetShader,
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.material.uniforms.tRipple.value = this.rippleTex;
    this.reflector.material.uniforms.tPuddle.value = this.puddleTex;
    this.reflector.material.fog = true;
    scene.add(this.reflector);

    this.asphalt = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.45, metalness: 0.6 })
    );
    this.asphalt.rotation.x = -Math.PI / 2;
    this.asphalt.visible = false;
    scene.add(this.asphalt);

    // infinite dark earth under everything
    this.earth = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshBasicMaterial({ color: 0x03050b })
    );
    this.earth.rotation.x = -Math.PI / 2;
    this.earth.position.y = -0.08;
    scene.add(this.earth);

    this.withReflections = true;
  }

  setReflections(on) {
    this.withReflections = on;
    this.reflector.visible = on;
    this.asphalt.visible = !on;
  }

  update(time, px, pz) {
    this.reflector.material.uniforms.uTime.value = time;
    this.reflector.position.set(0, 0, pz - 100);
    this.asphalt.position.set(0, 0, pz - 100);
    this.earth.position.set(px, -0.08, pz - 60);
  }
}
