// Black sky with stars, the Sun's disc and Earth. Drawn first, from a camera at the origin that only
// copies the view's rotation, so terrain drawn afterwards hides whatever is below the horizon.
import * as THREE from 'three';
import type { SkyDirection } from '../rules/sun';

export const SKY_RADIUS = 5000;
const STAR_COUNT = 4000;
const EARTH_RADIUS_DEG = 0.95; // Earth seen from the Moon: about 1.9° across
const SUN_RADIUS_DEG = 0.267;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The star field (shared with the Mars sky). */
export function makeStars(): THREE.Points {
  const rand = seededRandom(7);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions.set([r * Math.cos(phi) * SKY_RADIUS, u * SKY_RADIUS, r * Math.sin(phi) * SKY_RADIUS], i * 3);
    // Many faint stars, few bright ones; slight color variation.
    const b = 0.15 + 0.85 * Math.pow(rand(), 6);
    const tint = rand();
    colors.set([b * (0.85 + 0.15 * tint), b * 0.92, b * (1 - 0.15 * tint)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.Points(geometry, material);
}

export function glowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // The core (inner 1/12 of the radius) is the Sun's disc; the rest is a faint glare.
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,253,245,1)');
  g.addColorStop(0.1, 'rgba(255,245,225,0.35)');
  g.addColorStop(0.3, 'rgba(255,240,220,0.08)');
  g.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A simple procedural Earth: oceans, land and cloud bands. Phase 6 can swap in a real image. */
export function earthTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b4a8a';
  ctx.fillRect(0, 0, w, h);
  const rand = seededRandom(42);
  const blob = (color: string, count: number, size: number, alpha: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * w, h * (0.15 + 0.7 * rand()), size * (0.5 + rand()), size * (0.3 + 0.5 * rand()), rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blob('#6f7d4c', 40, 26, 0.9);
  blob('#a08a5c', 20, 18, 0.7);
  blob('#ffffff', 70, 22, 0.55);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, w, h * 0.07);
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly sunSprite: THREE.Sprite;
  private readonly earthLight: THREE.DirectionalLight;

  constructor(earth: SkyDirection) {
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(60, 1, 1, SKY_RADIUS * 2);
    this.scene.add(makeStars());

    const glare = (SUN_RADIUS_DEG * Math.PI) / 180 / 0.08; // disc fills 8% of the sprite radius
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    const size = 2 * SKY_RADIUS * 0.9 * Math.tan(glare);
    this.sunSprite.scale.set(size, size, 1);
    this.scene.add(this.sunSprite);

    const earthDistance = SKY_RADIUS * 0.8;
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(earthDistance * Math.tan((EARTH_RADIUS_DEG * Math.PI) / 180), 48, 32),
      new THREE.MeshLambertMaterial({ map: earthTexture() }),
    );
    earthMesh.position.set(earth.x, earth.y, earth.z).multiplyScalar(earthDistance);
    earthMesh.rotation.set(0.4, 1.2, 0.2);
    this.scene.add(earthMesh);
    this.earthLight = new THREE.DirectionalLight(0xffffff, 3.5);
    this.scene.add(this.earthLight, this.earthLight.target);
    // Faint fill so the night side of a crescent Earth is not pure black.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.04));
  }

  update(view: THREE.PerspectiveCamera, sun: SkyDirection): void {
    this.camera.quaternion.copy(view.quaternion);
    if (this.camera.fov !== view.fov || this.camera.aspect !== view.aspect) {
      this.camera.fov = view.fov;
      this.camera.aspect = view.aspect;
      this.camera.updateProjectionMatrix();
    }
    this.sunSprite.position.set(sun.x, sun.y, sun.z).multiplyScalar(SKY_RADIUS * 0.9);
    this.earthLight.position.set(sun.x, sun.y, sun.z).multiplyScalar(100);
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material & { map?: THREE.Texture | null };
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }
}
