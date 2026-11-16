// titan-fx: ground. Huygens-like water-ice pebbles around the rover: two InstancedMeshes (near and far shapes),
// rebuilt from the deterministic scatter (titanPebbleScatter.ts) whenever the rover has moved rebuildStepM.
// Visual only: no colliders. Lit like the Titan boulders (patchMoonLighting 'titan'), so the orange light tints
// the pale ice. Numbers in data/titan/tuning.json `look.pebbles`.
import * as THREE from 'three';
import type { TitanPebbleTuning } from '../rules/titanTypes';
import { patchMoonLighting, type MoonLightUniforms } from './lunarLighting';
import { scatterPebbles } from './titanPebbleScatter';

export class TitanPebbles {
  /** Near (rounder) and far (coarser) pebbles: two instanced draw calls. */
  readonly object = new THREE.Group();
  private readonly near: THREE.InstancedMesh;
  private readonly far: THREE.InstancedMesh;
  private readonly material: THREE.MeshLambertMaterial;
  private center: { x: number; z: number } | null = null;
  /** Pebbles drawn after the last rebuild (for the dev hook and the cost check). */
  count = 0;

  constructor(
    uniforms: MoonLightUniforms,
    private readonly t: TitanPebbleTuning,
    private readonly landing: { x: number; z: number },
    private readonly groundAt: (x: number, z: number) => number,
    private readonly softnessAt: (x: number, z: number) => number,
  ) {
    const material = patchMoonLighting(new THREE.MeshLambertMaterial({ color: new THREE.Color(t.color) }), uniforms, 'titan');
    // The shared patch takes the world position without the instance transform: add it, so the Sun mask is
    // sampled where each pebble lies.
    const patch = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      patch.call(material, shader, renderer);
      shader.vertexShader = shader.vertexShader.replace(
        'vMoonWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
        'vMoonWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;',
      );
    };
    material.customProgramCacheKey = () => 'moon-titan-pebbles';
    this.material = material;
    // Unit-wide pebbles with smooth normals: 80 triangles near the camera, 20 farther out.
    this.near = this.instanced(new THREE.IcosahedronGeometry(0.5, 1));
    this.far = this.instanced(new THREE.IcosahedronGeometry(0.5, 0));
  }

  private instanced(geometry: THREE.BufferGeometry): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, this.material, this.t.maxInstances);
    mesh.count = 0;
    mesh.frustumCulled = false; // always around the camera
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // allocate the per-pebble tone
    this.object.add(mesh);
    return mesh;
  }

  /** Rebuild around (x, z) once it is rebuildStepM from the last center. */
  update(x: number, z: number): void {
    if (this.center && Math.hypot(x - this.center.x, z - this.center.z) < this.t.rebuildStepM) return;
    this.center = { x, z };
    const list = scatterPebbles(x, z, this.landing, this.softnessAt, this.t);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tiltQ = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const color = new THREE.Color();
    let n = 0;
    let f = 0;
    for (const b of list) {
      p.set(b.x, this.groundAt(b.x, b.z) + b.height * (0.5 - this.t.buriedShare), b.z);
      q.setFromAxisAngle(up, b.yaw);
      tiltQ.setFromAxisAngle(axis.set(Math.cos(b.tiltDir), 0, Math.sin(b.tiltDir)), b.tilt);
      q.premultiply(tiltQ);
      s.set(b.width, b.height, b.width * b.aspect);
      m.compose(p, q, s);
      // Slight tone spread, from the pebble's own shape values so it is deterministic too.
      color.setScalar(0.82 + 0.22 * ((b.yaw * 7.13) % 1));
      const near = Math.hypot(b.x - x, b.z - z) < this.t.nearRadiusM;
      const mesh = near ? this.near : this.far;
      const i = near ? n++ : f++;
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color);
    }
    this.near.count = n;
    this.far.count = f;
    this.count = list.length;
    for (const mesh of [this.near, this.far]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of [this.near, this.far]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
  }
}
