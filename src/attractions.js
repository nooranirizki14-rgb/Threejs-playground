import * as THREE from 'three';
import { makeCanvas } from './utils.js';
import { makeWood, addAO } from './textures.js';

// Porch attractions: strummable guitar, stargazing telescope (+ Saturn),
// mailbox with letters at the gate.
export const GUITAR_POS = new THREE.Vector3(-6.3, 0.12, -2.2);
export const TELESCOPE_POS = new THREE.Vector3(5.8, 0.12, -1.5);
export const MAILBOX_POS = new THREE.Vector3(2.2, 0, -19.4);

export const CELESTIALS = [
  "Saturn's rings, clear as day 🪐",
  'a satellite drifts silently by 🛰️',
  'the Milky Way spills overhead 🌌',
  'a double star — can you split it? ✨',
  "the moon's craters in sharp relief 🌙",
];

export const LETTERS = [
  '💌 "Lake froze early this year…" wrong season. Just bills. Again.',
  '🐕 "Biscuit chased his tail 47 times today. New record." — the mailman watches.',
  '🎣 "Reminder: feed the fish. There are no fish. Or are there? Check the dock…"',
  '🌌 "The aurora is brightest when the rain stops. Look up. — M."',
  '🐈 "Miso has been fed. Probably. Feed her again just in case. — also M."',
];

function saturnTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 22);
  g.addColorStop(0, '#f2e2b8');
  g.addColorStop(1, '#8a7648');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,210,160,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(64, 64, 44, 13, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,210,160,0.35)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(64, 64, 44, 13, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

export class Attractions {
  constructor(scene) {
    this.circles = [];
    this.lettersRead = 0;
    this.strumT = 0;
    const woodTex = makeWood({ base: '#6b4a2a', dark: '#2a1a0c', planks: 2, gaps: false, weather: 0.15 });
    const wood = new THREE.MeshStandardMaterial({ ...woodTex, roughness: 0.7 });

    // guitar leaning on the porch post
    {
      const g = new THREE.Group();
      g.position.copy(GUITAR_POS);
      g.rotation.set(-0.2, 0.4, 0.22);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), wood);
      body.scale.set(1, 1.3, 0.45);
      body.position.y = 0.32;
      body.castShadow = true;
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.055, 12),
        new THREE.MeshBasicMaterial({ color: 0x050505 })
      );
      hole.position.set(0, 0.38, 0.1);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.04), wood);
      neck.position.y = 0.85;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.05), wood);
      head.position.y = 1.25;
      g.add(body, hole, neck, head);
      scene.add(g);
      this.guitar = g;
      addAO(scene, GUITAR_POS.x, 0.145, GUITAR_POS.z, 0.7, 0.7, 0.7);
      this.circles.push({ x: GUITAR_POS.x, z: GUITAR_POS.z, r: 0.35 });
    }

    // telescope aimed at the sky over the lake
    {
      const g = new THREE.Group();
      g.position.copy(TELESCOPE_POS);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.6, roughness: 0.5 });
      const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(Math.cos(a) * 0.25, 0.55, Math.sin(a) * 0.25);
        leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        leg.castShadow = true;
        g.add(leg);
      }
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), legMat);
      hub.position.y = 1.05;
      g.add(hub);
      const tubeG = new THREE.Group();
      tubeG.position.y = 1.05;
      tubeG.rotation.x = -0.8;
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 0.9, 14),
        new THREE.MeshStandardMaterial({ color: 0x1c1e24, metalness: 0.7, roughness: 0.35 })
      );
      const brass = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.02, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xb89a5a, metalness: 0.9, roughness: 0.3 })
      );
      brass.rotation.x = Math.PI / 2;
      brass.position.y = 0.45;
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), legMat);
      eye.position.y = -0.5;
      tubeG.add(tube, brass, eye);
      tubeG.rotation.y = Math.PI;
      g.add(tubeG);
      scene.add(g);
      addAO(scene, TELESCOPE_POS.x, 0.145, TELESCOPE_POS.z, 0.9, 0.9, 0.7);
      this.circles.push({ x: TELESCOPE_POS.x, z: TELESCOPE_POS.z, r: 0.4 });
    }

    // Saturn (only visible through the scope)
    this.saturn = new THREE.Sprite(new THREE.SpriteMaterial({
      map: saturnTexture(), transparent: true, opacity: 0.95,
      fog: false, depthWrite: false,
    }));
    this.saturn.scale.set(26, 26, 1);
    this.saturn.position.set(60, 75, -250);
    this.saturn.visible = false;
    scene.add(this.saturn);

    // mailbox at the gate
    {
      const g = new THREE.Group();
      g.position.copy(MAILBOX_POS);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood);
      post.position.y = 0.55;
      post.castShadow = true;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.5), wood);
      box.position.y = 1.2;
      box.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x3d4148, metalness: 0.7, roughness: 0.5 })
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = 1.3;
      this.flag = new THREE.Group();
      this.flag.position.set(0.14, 1.2, 0.1);
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), wood);
      stick.position.y = 0.15;
      const flagMat = new THREE.MeshStandardMaterial({ color: 0xb83030, roughness: 0.7 });
      const flagTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.18), flagMat);
      flagTop.position.set(0, 0.28, 0.08);
      this.flag.add(stick, flagTop);
      g.add(post, box, roof, this.flag);
      scene.add(g);
      addAO(scene, MAILBOX_POS.x, 0.012, MAILBOX_POS.z, 0.7, 0.7, 0.7);
      this.circles.push({ x: MAILBOX_POS.x, z: MAILBOX_POS.z, r: 0.3 });
    }
  }

  showSaturn(v) {
    this.saturn.visible = v;
  }

  readLetter() {
    if (this.lettersRead >= LETTERS.length) return null;
    const text = LETTERS[this.lettersRead];
    this.lettersRead++;
    if (this.lettersRead >= LETTERS.length) this.flag.rotation.x = 1.4;
    return text;
  }

  strum() {
    this.strumT = 1;
  }

  update(dt) {
    if (this.strumT > 0) {
      this.strumT = Math.max(0, this.strumT - dt * 2.5);
      this.guitar.rotation.z = 0.22 + Math.sin(this.strumT * 18) * 0.06 * this.strumT;
    }
  }
}
