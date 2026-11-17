// Small rocks and pebbles strewn along the drive (Act 3, Moon): regolith detail near the camera that the 5 m terrain
// cannot carry, and something for the low Sun and the floodlights to throw long shadows from. Instanced, lit with the
// world's own lighting (offline.patch: the Sun masked by terrain shadows), casting and receiving shadows. Placed
// deterministically along the recorded track, thinning away from it.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from '../../clock';
import type { MoonOfflineScene } from '../../../../src/world/moonScene';
import type { DriveTrack } from '../track';

/** A chipped, angular rock: a sphere cut by random planes (a convex polytope), flattened, with flat facets. */
function rockGeometry(seed: number): THREE.BufferGeometry {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'));
  const rnd = seeded(seed);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const planes = Array.from({ length: 11 }, () => ({ n: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), d: 0.62 + 0.33 * rnd() }));
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    for (const p of planes) {
      const c = v.dot(p.n);
      if (c > 1e-3) r = Math.min(r, p.d / c);
    }
    v.multiplyScalar(r);
    v.y *= 0.6;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

export class Rocks {
  readonly object = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly material: THREE.MeshLambertMaterial;

  constructor(o: MoonOfflineScene, track: DriveTrack, groundAt: (x: number, z: number) => number, opts: { from: number; to: number; count: number; halfWidthM: number; aheadM: number; color: THREE.ColorRepresentation; sizeM: [number, number]; layer?: number; sunLine?: THREE.Vector4 }) {
    this.material = new THREE.MeshLambertMaterial({ color: opts.color });
    o.patch(new THREE.Mesh(new THREE.BufferGeometry(), this.material));
    // The world's patch takes the world position without the instance transform: add it, so the Sun mask is
    // sampled where each rock lies.
    const patch = this.material.onBeforeCompile.bind(this.material);
    this.material.onBeforeCompile = (shader, renderer) => {
      patch(shader, renderer);
      shader.uniforms.act3SunLine = { value: opts.sunLine ?? new THREE.Vector4(0, 0, -1, 1) };
      // The crest's shadow covers rocks a few metres past the line where the ground falls away from the Sun.
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 act3SunLine;')
        .replace('moonSunVis = moonSunVisibility( vMoonWorld.xz );', 'moonSunVis = moonSunVisibility( vMoonWorld.xz ) * smoothstep( act3SunLine.w, -act3SunLine.w, dot( act3SunLine.xy, vMoonWorld.xz ) + act3SunLine.z );');
      shader.vertexShader = shader.vertexShader.replace(
        'vMoonWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
        'vMoonWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;',
      );
    };
    const prevKey = this.material.customProgramCacheKey.bind(this.material);
    this.material.customProgramCacheKey = () => `act3-rocks|${prevKey()}`;
    const shapes = [rockGeometry(11), rockGeometry(23), rockGeometry(37)];
    const per = Math.ceil(opts.count / shapes.length);
    const rnd = seeded(0x60c5);
    const p = new THREE.Vector3();
    const f = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    shapes.forEach((geo) => {
      const mesh = new THREE.InstancedMesh(geo, this.material, per);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      if (opts.layer !== undefined) mesh.layers.enable(opts.layer);
      for (let i = 0; i < per; i++) {
        const t = opts.from + rnd() * (opts.to - opts.from);
        track.position(t, p);
        track.forward(t, f);
        f.y = 0;
        f.normalize();
        const along = rnd() * opts.aheadM;
        const side = (rnd() - 0.5) * 2 * opts.halfWidthM * Math.sqrt(rnd());
        const x = p.x + f.x * along - f.z * side;
        const z = p.z + f.z * along + f.x * side;
        // Keep the rover's own wheel path clear (it drives over the ground, not through rocks).
        const offPath = Math.abs(side);
        const k = Math.pow(rnd(), 3.2);
        let size = opts.sizeM[0] + (opts.sizeM[1] - opts.sizeM[0]) * k;
        if (offPath < 1.3) size = Math.min(size, 0.05);
        s.set(size * (0.8 + 0.4 * rnd()), size * (0.6 + 0.6 * rnd()), size * (0.8 + 0.4 * rnd()));
        q.setFromEuler(e.set((rnd() - 0.5) * 0.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.6));
        m.compose(new THREE.Vector3(x, groundAt(x, z) + s.y * 0.25, z), q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.object.add(mesh);
    });
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.material.dispose();
  }
}
