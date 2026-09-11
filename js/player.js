import * as THREE from 'three';

export const LANES = [-2.2, 0, 2.2];
const GRAVITY = 26;
const JUMP_V = 9.5;

export class Player {
  constructor(scene) {
    this.group = new THREE.Group(); // world transform (lane x, jump y)
    this.body = new THREE.Group();  // visual lean / squash / bob
    this.group.add(this.body);

    // main hull
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.42, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x151538, metalness: 0.85, roughness: 0.35 })
    );
    hull.position.y = 0.55;
    hull.castShadow = true;
    this.body.add(hull);
    const hullEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(hull.geometry),
      new THREE.LineBasicMaterial({ color: 0x00eeff })
    );
    hullEdge.position.copy(hull.position);
    this.body.add(hullEdge);

    // glowing nose cone
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.7, 4),
      new THREE.MeshStandardMaterial({
        color: 0x00eeff, emissive: 0x00eeff, emissiveIntensity: 0.9,
        metalness: 0.4, roughness: 0.3,
      })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.55, -1.35);
    nose.castShadow = true;
    this.body.add(nose);

    // cockpit dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xff2fd6, emissive: 0xff2fd6, emissiveIntensity: 0.8,
        metalness: 0.3, roughness: 0.2,
      })
    );
    dome.position.set(0, 0.76, 0.25);
    this.body.add(dome);

    // neon side wings
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xff2fd6 });
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.1), wingMat);
      wing.position.set(s * 0.75, 0.5, 0.35);
      this.body.add(wing);
    }

    // glowing wheels
    const wheelGeo = new THREE.TorusGeometry(0.26, 0.09, 10, 20);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: 0xff2fd6, emissiveIntensity: 1.2,
    });
    this.wheels = [];
    for (const [x, z] of [[-0.62, -0.65], [0.62, -0.65], [-0.62, 0.7], [0.62, 0.7]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.28, z);
      w.rotation.y = Math.PI / 2;
      this.body.add(w);
      this.wheels.push(w);
    }

    // underglow light
    this.glow = new THREE.PointLight(0x00eeff, 6, 7, 2);
    this.glow.position.set(0, 0.4, 0);
    this.group.add(this.glow);

    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.lane = 1;
    this.targetX = LANES[1];
    this.group.position.set(0, 0, 0);
    this.group.visible = true;
    this.y = 0;
    this.vy = 0;
    this.jumping = false;
    this._wasAir = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.body.position.set(0, 0, 0);
  }

  move(dir) {
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    this.targetX = LANES[this.lane];
  }

  jump() {
    if (this.y <= 0.001 && !this.jumping) {
      this.vy = JUMP_V;
      this.jumping = true;
      this.sliding = false;
      this.slideTimer = 0;
      return true;
    }
    return false;
  }

  slide() {
    // slam down fast if airborne, otherwise slide
    if (this.jumping || this.y > 0.05) {
      this.vy = Math.min(this.vy, -16);
      return true;
    }
    this.sliding = true;
    this.slideTimer = 0.8;
    return true;
  }

  get bottom() { return this.y; }
  get top() { return this.y + (this.sliding ? 0.6 : 1.1); }

  hide() { this.group.visible = false; }

  // returns 'land' on the frame the player touches down
  update(dt, speed = 0, idle = false) {
    let event = null;
    const p = this.group.position;

    // smooth lane change
    p.x += (this.targetX - p.x) * Math.min(1, dt * 10);
    const lean = THREE.MathUtils.clamp((this.targetX - p.x) * -0.3, -0.5, 0.5);
    this.body.rotation.z += (lean - this.body.rotation.z) * Math.min(1, dt * 8);

    if (!idle) {
      if (this.jumping || this.y > 0) {
        this.vy -= GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y > 0.3) this._wasAir = true;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.jumping = false;
          if (this._wasAir) event = 'land';
          this._wasAir = false;
        }
      }
    }

    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }
    p.y = this.y;

    // squash & stretch while sliding
    const targetSY = this.sliding ? 0.55 : 1;
    this.body.scale.y += (targetSY - this.body.scale.y) * Math.min(1, dt * 12);

    // pitch in the air based on vertical velocity
    const targetRX = this.jumping ? THREE.MathUtils.clamp(-this.vy * 0.03, -0.35, 0.4) : 0;
    this.body.rotation.x += (targetRX - this.body.rotation.x) * Math.min(1, dt * 8);

    // hover bob
    this.body.position.y = Math.sin(performance.now() * 0.01) * 0.04 + (this.sliding ? -0.12 : 0);

    // spin wheels with speed
    for (const w of this.wheels) w.rotation.x += dt * (2 + speed * 0.4);

    return event;
  }
}
