import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Mirror puddles on the wet ground (+ one on the deck catching the string lights).
export class Puddles {
  constructor(scene) {
    this.add(scene, 3.0, 0.015, -8.5, 2.4, 1.5, 512);  // big yard puddle
    this.add(scene, -5.2, 0.015, -15.5, 1.6, 1.1, 256); // near the campfire
    this.add(scene, 3.5, 0.13, 0.2, 1.3, 0.9, 256);    // deck puddle
  }

  add(scene, x, y, z, sx, sz, res) {
    const rim = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0x05070a })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.scale.set(sx + 0.3, sz + 0.3, 1);
    rim.position.set(x, y - 0.004, z);
    scene.add(rim);

    const water = new Reflector(new THREE.CircleGeometry(1, 28), {
      clipBias: 0.003,
      textureWidth: res,
      textureHeight: res,
      color: 0x182435,
    });
    water.rotation.x = -Math.PI / 2;
    water.scale.set(sx, sz, 1);
    water.position.set(x, y, z);
    scene.add(water);
  }
}
