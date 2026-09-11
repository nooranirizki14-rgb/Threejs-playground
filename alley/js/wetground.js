import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { makePuddle, makeNoise } from './signs.js';

// Wet asphalt: planar reflection + puddle mask + animated ripple distortion
// + roughness blur. (color/tDiffuse/textureMatrix uniforms are required by Reflector.)
const WetShader = {
  name: 'WetGround',

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
      // puddle mask — world locked so it never swims as the plane follows you
      float puddle = texture2D(tPuddle, wXZ * 0.035).r;
      puddle = smoothstep(0.32, 0.72, puddle);
      // two counter-scrolling ripple layers
      vec2 ruv1 = wXZ * 0.09 + vec2(uTime * 0.030, uTime * 0.017);
      vec2 ruv2 = wXZ * 0.061 - vec2(uTime * 0.021, uTime * 0.026);
      vec2 ripple = (texture2D(tRipple, ruv1).rg - 0.5)
                  + (texture2D(tRipple, ruv2).rg - 0.5);
      // distort the projective UVs (perspective-correct via w)
      vec4 uv = vUv;
      float distortAmt = 0.010 + 0.055 * (1.0 - puddle);
      uv.xy += ripple * distortAmt * uv.w;
      vec3 sharp = texture2DProj(tDiffuse, uv).rgb;
      // cheap roughness blur: 4 taps for non-puddle asphalt
      vec2 px = vec2(0.0045) * uv.w;
      vec3 rough = sharp * 0.4
        + texture2DProj(tDiffuse, uv + vec4(px.x, 0.0, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv - vec4(px.x, 0.0, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv + vec4(0.0, px.y, 0.0, 0.0)).rgb * 0.15
        + texture2DProj(tDiffuse, uv - vec4(0.0, px.y, 0.0, 0.0)).rgb * 0.15;
      vec3 refl = mix(rough, sharp, puddle);
      // asphalt base with subtle grain
      float grain = texture2D(tRipple, wXZ * 0.33).b;
      vec3 asphalt = vec3(0.012, 0.014, 0.026) * (0.7 + 0.6 * grain);
      vec3 col = asphalt * (1.0 - puddle * 0.55)
               + refl * color * (0.22 + 0.78 * puddle) * uReflectivity;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
};

export class WetGround {
  constructor(scene, { width = 70, length = 300 } = {}) {
    this.rippleTex = makeNoise({ size: 128 });
    this.puddleTex = makePuddle({ size: 512, blobs: 30 });

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

    // cheap fallback for low-end devices
    this.asphalt = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x0b0d18, roughness: 0.45, metalness: 0.6 })
    );
    this.asphalt.rotation.x = -Math.PI / 2;
    this.asphalt.visible = false;
    scene.add(this.asphalt);

    this.withReflections = true;
  }

  setReflections(on) {
    this.withReflections = on;
    this.reflector.visible = on;
    this.asphalt.visible = !on;
  }

  update(time, playerZ) {
    this.reflector.material.uniforms.uTime.value = time;
    const z = playerZ - 70;
    this.reflector.position.z = z;
    this.asphalt.position.z = z;
  }
}
