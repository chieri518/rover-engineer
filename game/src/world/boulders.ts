// Boulders in the rocky areas (small fresh craters in terrain.json). Real counts near the south pole:
// boulders are dense on fresh crater rims and almost all are under 4 m (research/rover-engineering/08).
// One merged mesh (so the lunar lighting patch sees world positions) and static Rapier ball colliders.
// Mars: the flood boulder (rules/boulders.ts, flood conglomerate carried by a flood) is its own mesh,
// rounder and a little paler than the angular rocks around it, so it reads as the one to find. The list
// comes from world/boulderList.ts worldBoulders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Tuning } from '../rules/types';
import { seededRng } from '../rules/events';
import type { Boulder } from '../rules/boulders';

export type { Boulder };

type Rapier = typeof RAPIER;

const BOULDER_COLOR = 0x7d7a74;
// The flood boulder: a water-worn conglomerate, rounded (a finer icosahedron, less flattened) and paler.
const FLOOD_BOULDER_COLOR = 0x9a8c7c;
const FLOOD_BOULDER_DETAIL = 1;

export class Boulders {
  readonly mesh: THREE.Mesh;
  /** Mars: the flood boulder's own mesh (null when the list has none, as on the Moon). */
  readonly floodMesh: THREE.Mesh | null = null;
  readonly list: Boulder[];
  /** The height of each boulder's top (world y), in list order: where a marker on it sits. */
  readonly topY: number[] = [];
  private readonly bodies: RAPIER.Collider[] = [];

  constructor(
    rapier: Rapier,
    private readonly world: RAPIER.World,
    list: readonly Boulder[],
    tuning: Tuning['boulders'],
    groundAt: (x: number, z: number) => number,
  ) {
    this.list = [...list];
    const rng = seededRng(tuning.seed + 1);
    const parts: THREE.BufferGeometry[] = [];
    let flood: THREE.BufferGeometry | null = null;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (const bo of this.list) {
      const y = groundAt(bo.x, bo.z) + bo.radius * (1 - 2 * tuning.buriedShare);
      // The same random draws for every boulder, so the others keep their shapes.
      const sx = 0.9 + 0.3 * rng();
      const sy = 0.7 + 0.3 * rng();
      const sz = 0.9 + 0.3 * rng();
      // The flood boulder: a sixth of the spread, so it stays round (0.95 to 1 across, 0.85 to 0.9 high).
      const s = bo.flood
        ? new THREE.Vector3(bo.radius * (0.95 + (sx - 0.9) / 6), bo.radius * (0.85 + (sy - 0.7) / 6), bo.radius * (0.95 + (sz - 0.9) / 6))
        : new THREE.Vector3(bo.radius * sx, bo.radius * sy, bo.radius * sz);
      q.setFromEuler(e.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6));
      const g = new THREE.IcosahedronGeometry(1, bo.flood ? FLOOD_BOULDER_DETAIL : 0);
      g.applyMatrix4(m.compose(new THREE.Vector3(bo.x, y, bo.z), q, s));
      if (bo.flood && !flood) flood = g;
      else parts.push(g);
      this.topY.push(y + s.y);
      this.bodies.push(world.createCollider(rapier.ColliderDesc.ball(bo.radius * 0.9).setTranslation(bo.x, y, bo.z).setFriction(0.8)));
    }
    const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
    for (const p of parts) p.dispose();
    merged.computeVertexNormals();
    this.mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: BOULDER_COLOR, flatShading: true }));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    if (flood) {
      flood.computeVertexNormals();
      this.floodMesh = new THREE.Mesh(flood, new THREE.MeshLambertMaterial({ color: FLOOD_BOULDER_COLOR, flatShading: true }));
      this.floodMesh.castShadow = true;
      this.floodMesh.receiveShadow = true;
    }
  }

  /** The meshes to add to the scene (and patch for lighting): the merged boulders, and the flood boulder if any. */
  get meshes(): THREE.Mesh[] {
    return this.floodMesh ? [this.mesh, this.floodMesh] : [this.mesh];
  }

  dispose(): void {
    for (const c of this.bodies) this.world.removeCollider(c, false);
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
