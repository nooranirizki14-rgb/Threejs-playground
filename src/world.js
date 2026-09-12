import * as THREE from 'three';
import { applyEnvironment } from './envmap.js';

// Renderer, camera, night lights, fog. Shadow-casting moonlight,
// HDRI environment for PBR response, faint cool fill for shaping.
export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070c16);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.008);
    applyEnvironment(this.scene, this.renderer);

    this.camera = new THREE.PerspectiveCamera(
      68, window.innerWidth / window.innerHeight, 0.05, 800
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.22, 2.6);

    this.hemi = new THREE.HemisphereLight(0x33405c, 0x0a0a0c, 0.55);
    this.scene.add(this.hemi);

    this.moon = new THREE.DirectionalLight(0xb8c4e8, 0.5);
    this.moon.position.set(-30, 45, -110);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(1024, 1024);
    this.moon.shadow.camera.left = -28;
    this.moon.shadow.camera.right = 28;
    this.moon.shadow.camera.top = 28;
    this.moon.shadow.camera.bottom = -28;
    this.moon.shadow.camera.near = 20;
    this.moon.shadow.camera.far = 260;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.05;
    this.scene.add(this.moon);

    // cool eastern fill so shadow sides are never pitch black
    this.fill = new THREE.DirectionalLight(0x4a5a8a, 0.12);
    this.fill.position.set(40, 20, 30);
    this.scene.add(this.fill);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
