import * as THREE from 'three';

// Renderer, camera, night lights, fog. One shadow-casting lamp.
// v2: brighter exposure, stronger moonlight, thinner fog so the view reads.
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

    this.camera = new THREE.PerspectiveCamera(
      68, window.innerWidth / window.innerHeight, 0.05, 800
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.22, 2.6);

    this.hemi = new THREE.HemisphereLight(0x33405c, 0x0a0a0c, 0.55);
    this.scene.add(this.hemi);

    this.moon = new THREE.DirectionalLight(0xb8c4e8, 0.5);
    this.moon.position.set(-30, 45, -110);
    this.scene.add(this.moon);

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
