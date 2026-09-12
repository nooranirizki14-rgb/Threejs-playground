import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Cinematic chain: render (MSAA) -> bloom -> vignette/grain grade -> tonemap.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 13.0) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - 0.42 * smoothstep(0.32, 0.85, d);
      c.rgb += (hash(vUv * vec2(1920.0, 1080.0)) - 0.5) * 0.045;
      gl_FragColor = c;
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.5, 0.75
    );
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }

  render(t) {
    this.grade.uniforms.uTime.value = t;
    this.composer.render();
  }
}
