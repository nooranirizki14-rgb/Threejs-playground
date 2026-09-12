import * as THREE from 'three';

// Renderer, camera, night lights, fog. One shadow-casting lamp.
export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060c);
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.02);

    this.camera = new THREE.PerspectiveCamera(
      68, window.innerWidth / window.innerHeight, 0.05, 800
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 1.22, 2.6);

    this.hemi = new THREE.HemisphereLight(0x2a3348, 0x050505, 0.35);
    this.scene.add(this.hemi);

    this.moon = new THREE.DirectionalLight(0xaab4d8, 0.22);
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
