// Dust devils on Mars (Mars step 6a): a translucent, slowly turning dust column for each devil standing now.
// The mission places the devils (rules/dust.ts placeDustDevil, MissionState.mars.devils); this draws them at
// the scene's clock (dustDevilPosition, dustDevilStrength) and tells the photo test where they are.
// Cheap: one shared lathe geometry and one shared alpha texture, one draw call per standing devil (rarely
// more than one). Not fogged, so a devil a few hundred meters off still reads against the dusty sky (the
// generous rule: a first-time player should notice one passing). Size: events.dustdevil radiusM, heightM.
import * as THREE from 'three';
import { dustDevilPosition, dustDevilStrength } from '../rules/dust';
import type { DustDevil, DustDevilSpec } from '../rules/marsTypes';

// Presentation settings, not game rules.
const DUST_COLOR = 0x8c5f3c; // a little darker than the daytime sky, so the column stands out against it
const MAX_OPACITY = 0.85;
const SPIN_RAD_PER_S = 1.2;
const SWAY_RAD = 0.04; // the column leans a little, back and forth
const SWAY_PER_S = 0.35;
const SEGMENTS = 24;
const TEXTURE_PX = 64;
/** The column's profile: [radius, height] as multiples of radiusM and heightM, from the dusty skirt at the ground up to the flared top. */
const PROFILE: [number, number][] = [[2.2, 0], [1.6, 0.02], [0.9, 0.06], [0.8, 0.15], [1.0, 0.4], [1.5, 0.7], [2.4, 1]];
/** Where up the column the photo test looks, as shares of heightM: any one in frame counts (generous). */
export const DEVIL_FRAME_HEIGHTS = [0.08, 0.3, 0.6] as const;

interface Point { x: number; z: number }

/** A devil standing now: where it is and how strong (0..1, ramping in and out; rules/dust.ts dustDevilStrength). */
export interface DustDevilColumn extends Point {
  strength: number;
}

/** The devils standing at `seconds`, with their positions and strengths. Pure. */
export function dustDevilColumns(devils: readonly DustDevil[], seconds: number, spec: DustDevilSpec): DustDevilColumn[] {
  const out: DustDevilColumn[] = [];
  for (const d of devils) {
    const strength = dustDevilStrength(d, seconds, spec);
    if (strength <= 0) continue;
    out.push({ ...dustDevilPosition(d, seconds), strength });
  }
  return out;
}

/** The points up a column the photo test tries (world coordinates), lowest first. Pure. */
export function devilFramePoints(c: Point, groundY: number, heightM: number): { x: number; y: number; z: number }[] {
  return DEVIL_FRAME_HEIGHTS.map((k) => ({ x: c.x, y: groundY + k * heightM, z: c.z }));
}

/** Alpha of the column's surface at (u around, v up): fades out toward the top, in three helical bands. */
export function devilAlpha(u: number, v: number): number {
  const fade = Math.min(1, 0.7 + 3 * v) * (1 - v) ** 1.5;
  const swirl = 0.55 + 0.45 * Math.sin(2 * Math.PI * (3 * u + 2 * v));
  const grain = 0.85 + 0.15 * fract(Math.sin(u * 127.1 + v * 311.7) * 43758.5453);
  return Math.min(1, Math.max(0, fade * swirl * grain));
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function alphaTexture(): THREE.DataTexture {
  const n = TEXTURE_PX;
  const px = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = Math.round(255 * devilAlpha(i / n, j / (n - 1)));
      const k = (j * n + i) * 4;
      px[k] = px[k + 1] = px[k + 2] = a; // alphaMap reads green
      px[k + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(px, n, n);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class DustDevils {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.LatheGeometry;
  private readonly texture = alphaTexture();
  private readonly meshes: THREE.Mesh<THREE.LatheGeometry, THREE.MeshBasicMaterial>[] = [];
  private standing: DustDevilColumn[] = [];
  private time = 0;

  constructor(private readonly spec: DustDevilSpec) {
    const pts = PROFILE.map(([r, h]) => new THREE.Vector2(r * spec.radiusM, h * spec.heightM));
    this.geometry = new THREE.LatheGeometry(pts, SEGMENTS);
  }

  /** The columns drawn this frame (the devils standing at the last update). */
  get columns(): readonly DustDevilColumn[] {
    return this.standing;
  }

  get heightM(): number {
    return this.spec.heightM;
  }

  /**
   * Draw the devils standing at mission time `seconds`, each on the ground under it. `dt`: real seconds
   * since the last frame, for the swirl.
   */
  update(devils: readonly DustDevil[], seconds: number, groundAt: (x: number, z: number) => number, dt: number): void {
    this.time += dt;
    this.standing = dustDevilColumns(devils, seconds, this.spec);
    while (this.meshes.length < this.standing.length) {
      const material = new THREE.MeshBasicMaterial({
        color: DUST_COLOR,
        alphaMap: this.texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.rotation.y = this.meshes.length * 2.1; // devils standing together do not turn in step
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.meshes.forEach((mesh, i) => {
      const c = this.standing[i];
      mesh.visible = c !== undefined;
      if (!c) return;
      mesh.position.set(c.x, groundAt(c.x, c.z), c.z);
      mesh.rotation.y += SPIN_RAD_PER_S * dt;
      mesh.rotation.x = SWAY_RAD * Math.sin(2 * Math.PI * SWAY_PER_S * this.time + i);
      mesh.rotation.z = SWAY_RAD * Math.cos(2 * Math.PI * SWAY_PER_S * 0.8 * this.time + i);
      mesh.material.opacity = MAX_OPACITY * c.strength;
    });
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.material.dispose();
    this.geometry.dispose();
    this.texture.dispose();
    this.group.removeFromParent();
  }
}
