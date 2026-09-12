import * as THREE from 'three';

// Wind chimes under the porch roof: sway with the gusts, sing pentatonic.
export class Chimes {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(-4.5, 2.9, -3.2);
    scene.add(this.group);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3421, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), wood);
    this.group.add(cap);
    const metal = new THREE.MeshStandardMaterial({
      color: 0x9aa0a8, metalness: 0.9, roughness: 0.3,
    });
    const stringMat = new THREE.LineBasicMaterial({ color: 0x111111 });
    this.tubes = new THREE.Group();
    this.group.add(this.tubes);
    const lens = [0.32, 0.28, 0.25, 0.22, 0.18];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * 0.09;
      const z = Math.sin(a) * 0.09;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, lens[i], 8), metal);
      tube.position.set(x, -0.06 - lens[i] / 2, z);
      this.tubes.add(tube);
      const sgeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -0.02, z),
        new THREE.Vector3(x, -0.06, z),
      ]);
      this.tubes.add(new THREE.Line(sgeo, stringMat));
    }
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.01), wood);
    sail.position.y = -0.5;
    this.tubes.add(sail);
    const sline = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0, -0.44, 0),
    ]);
    this.tubes.add(new THREE.Line(sline, stringMat));
    this.cooldown = 0;
    this.onChime = null;
  }

  gust(t) {
    return 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.11 + 1.7);
  }

  update(t, dt) {
    const g = this.gust(t);
    this.tubes.rotation.x = Math.sin(t * 1.3) * 0.08 * (0.3 + g);
    this.tubes.rotation.z = Math.cos(t * 1.1) * 0.08 * (0.3 + g);
    this.cooldown -= dt;
    if (g > 0.72 && this.cooldown <= 0) {
      this.cooldown = 3;
      if (this.onChime) this.onChime();
    }
  }
}
