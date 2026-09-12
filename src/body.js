import * as THREE from 'three';
import { CHAIR_POS } from './porch.js';

// Your seated body on the chair (facing -Z). Visible only while sitting —
// look down and you'll see legs, shoes, torso, hands on the armrests.
export class Body {
  constructor(scene) {
    const g = new THREE.Group();
    const pants = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.95 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.95 });
    const shoeM = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.7 });

    const box = (mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    // torso + hips
    box(shirt, 0.42, 0.52, 0.24, 0, 0.95, 0.02);
    box(pants, 0.4, 0.2, 0.4, 0, 0.62, -0.02);
    // thighs (forward = -Z)
    box(pants, 0.16, 0.17, 0.46, -0.13, 0.56, -0.26);
    box(pants, 0.16, 0.17, 0.46, 0.13, 0.56, -0.26);
    // shins down to the deck
    box(pants, 0.14, 0.44, 0.14, -0.13, 0.32, -0.46);
    box(pants, 0.14, 0.44, 0.14, 0.13, 0.32, -0.46);
    // shoes
    box(shoeM, 0.15, 0.1, 0.3, -0.13, 0.05, -0.5);
    box(shoeM, 0.15, 0.1, 0.3, 0.13, 0.05, -0.5);
    // arms: down then forward onto the armrests
    box(shirt, 0.11, 0.34, 0.11, -0.26, 0.82, 0.0);
    box(shirt, 0.11, 0.34, 0.11, 0.26, 0.82, 0.0);
    box(shirt, 0.1, 0.1, 0.4, -0.3, 0.68, -0.2);
    box(shirt, 0.1, 0.1, 0.4, 0.3, 0.68, -0.2);
    // hands
    box(skin, 0.09, 0.07, 0.14, -0.3, 0.68, -0.44);
    box(skin, 0.09, 0.07, 0.14, 0.3, 0.68, -0.44);

    g.position.set(CHAIR_POS.x, 0.12, CHAIR_POS.z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    this.group = g;
  }

  setVisible(v) {
    this.group.visible = v;
  }
}
