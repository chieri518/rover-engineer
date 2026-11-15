// Boulders in the rocky areas (small fresh craters in terrain.json). Real counts near the south pole:
// boulders are dense on fresh crater rims and almost all are under 4 m (research/rover-engineering/08).
// One merged mesh (so the lunar lighting patch sees world positions) and static Rapier ball colliders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Tuning } from '../rules/types';
import { seededRng } from '../rules/events';
import type { SoftArea } from '../rules/ground';

type Rapier = typeof RAPIER;

const BOULDER_COLOR = 0x7d7a74;

export interface Boulder {
  x: number;
  z: number;
  radius: number;
}

/** Deterministic boulder positions and sizes: small ones common, large ones rare. */
export function scatterBoulders(areas: SoftArea[], b: Tuning['boulders']): Boulder[] {
  const rng = seededRng(b.seed);
  const list: Boulder[] = [];
  for (const a of areas) {
    const spread = a.radiusM * b.spreadRadiusFactor;
    for (let i = 0; i < b.perRockyArea; i++) {
      const r = spread * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const size = b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
      list.push({ x: a.x + r * Math.cos(th), z: a.z + r * Math.sin(th), radius: size / 2 });
    }
  }
  return list;
}

export class Boulders {
  readonly mesh: THREE.Mesh;
  readonly list: Boulder[];
  private readonly bodies: RAPIER.Collider[] = [];

  constructor(
    rapier: Rapier,
    private readonly world: RAPIER.World,
    areas: SoftArea[],
    tuning: Tuning['boulders'],
    groundAt: (x: number, z: number) => number,
  ) {
    this.list = scatterBoulders(areas, tuning);
    const rng = seededRng(tuning.seed + 1);
    const parts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (const bo of this.list) {
      const y = groundAt(bo.x, bo.z) + bo.radius * (1 - 2 * tuning.buriedShare);
      const g = new THREE.IcosahedronGeometry(1, 0);
      const s = new THREE.Vector3(bo.radius * (0.9 + 0.3 * rng()), bo.radius * (0.7 + 0.3 * rng()), bo.radius * (0.9 + 0.3 * rng()));
      q.setFromEuler(e.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6));
      g.applyMatrix4(m.compose(new THREE.Vector3(bo.x, y, bo.z), q, s));
      parts.push(g);
      this.bodies.push(world.createCollider(rapier.ColliderDesc.ball(bo.radius * 0.9).setTranslation(bo.x, y, bo.z).setFriction(0.8)));
    }
    const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
    for (const p of parts) p.dispose();
    merged.computeVertexNormals();
    this.mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: BOULDER_COLOR, flatShading: true }));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  dispose(): void {
    for (const c of this.bodies) this.world.removeCollider(c, false);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
