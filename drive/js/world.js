import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CinematicShader } from './cinematic.js';

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.basePR = Math.min(window.devicePixelRatio || 1, 1.5);
    this.pixelRatio = this.basePR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.baseFog = new THREE.Color(0x04040e);
    this.scene.background = new THREE.Color().copy(this.baseFog);
    this.scene.fog = new THREE.FogExp2(0x04040e, 0.024);

    this.camera = new THREE.PerspectiveCamera(
      70, window.innerWidth / window.innerHeight, 0.08, 700
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.7, 0);

    this.hemi = new THREE.HemisphereLight(0x3a4356, 0x030208, 0.3);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xc4cbe8, 0.22);
    this.moon.position.set(-30, 60, -40);
    this.scene.add(this.moon);

    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      samples: 4, type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.85
    );
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(CinematicShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.onResize());
  }

  setQuality(q) {
    // 'high' = full pixels + bloom, 'low' = cheap and fast
    this.quality = q;
    const pr = q === 'low' ? 1 : this.basePR;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    if (this.bloom) this.bloom.enabled = q !== 'low';
  }

  degrade() {
    // one-step auto quality drop for weak GPUs
    this.setQuality('low');
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.composer.render();
  }
}
