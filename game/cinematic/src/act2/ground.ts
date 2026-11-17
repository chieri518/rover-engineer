// The regolith around the lander, in close-up detail: patches laid exactly over the game's terrain mesh
// (same triangles, same ground material and photometry, lifted a centimetre or two and faded to nothing at
// their edges, so they join the terrain without a seam), carrying what the terrain cannot show at 5 m:
// the landing's blast halo, the footpads pressed into the soil with a berm, the rover's wheel ruts with
// chevron tread marks that appear as the wheels roll, and scattered pebbles casting long shadows.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchMoonLighting } from '../../../src/world/lunarLighting';
import type { HeightGrid } from '../../../src/world/terrainData';
import { cinePatch, type MoonUniforms } from '../rig/lighting';
import { seeded } from '../rig/textures';

const REGOLITH_COLOR = 0x9a968e; // as the game's terrain (moonScene.ts)

/** Height of the game's terrain mesh (the 5 m grid's triangles, as terrainChunks.ts builds them) at world (x, z). */
export function meshHeight(grid: HeightGrid, x: number, z: number): number {
  const fx = x / grid.pixel + grid.half;
  const fz = z / grid.pixel + grid.half;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = grid.at(i, j);
  const b = grid.at(i, j + 1);
  const c = grid.at(i + 1, j);
  const d = grid.at(i + 1, j + 1);
  if (tx + tz <= 1) return a + (c - a) * tx + (b - a) * tz;
  return d + (b - d) * (1 - tx) + (c - d) * (1 - tz);
}

/** The mesh's vertex normal, interpolated over the triangle like the terrain's own shading. */
export function meshNormal(grid: HeightGrid, x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const vn = (col: number, row: number) => {
    const dx = (grid.at(col + 1, row) - grid.at(col - 1, row)) / (2 * grid.pixel);
    const dz = (grid.at(col, row + 1) - grid.at(col, row - 1)) / (2 * grid.pixel);
    return new THREE.Vector3(-dx, 1, -dz).normalize();
  };
  const fx = x / grid.pixel + grid.half;
  const fz = z / grid.pixel + grid.half;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = vn(i, j);
  const b = vn(i, j + 1);
  const c = vn(i + 1, j);
  const d = vn(i + 1, j + 1);
  if (tx + tz <= 1) out.copy(a).multiplyScalar(1 - tx - tz).addScaledVector(c, tx).addScaledVector(b, tz);
  else out.copy(d).multiplyScalar(tx + tz - 1).addScaledVector(b, 1 - tx).addScaledVector(c, 1 - tz);
  return out.normalize();
}

/** Where the patches sit: the lander's frame on the ground (local x out of the door). */
export interface GroundFrame {
  /** World position of the lander's local origin (on the ground at its centre). */
  origin: THREE.Vector3;
  /** Rotation about y of the lander (local +x → world (cos θ, 0, −sin θ)). */
  yaw: number;
}

export interface TrackSpec {
  /** Wheel lines: local z of each rut's centre. */
  lines: number[];
  /** Rut half-width (the tyre's), depth and berm height (m). */
  halfWidth: number;
  depth: number;
  berm: number;
  /** Local x where the ruts begin (the first touch); they run toward +x. */
  startX: number;
  /** Chevron spacing along the rut (one cleat pitch) and slant (dx per dz). */
  pitch: number;
  slant: number;
}

function toWorld(f: GroundFrame, lx: number, lz: number): [number, number] {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  // Local +x → (c, −s); local +z → (s, c).
  return [f.origin.x + lx * c + lz * s, f.origin.z - lx * s + lz * c];
}

export interface GroundOptions {
  grid: HeightGrid;
  moon: MoonUniforms;
  frame: GroundFrame;
  tracks: TrackSpec;
  footpads: THREE.Vector3[]; // lander-local
  footPadR: number;
  envMap: THREE.Texture | null;
}

/** Regolith patches, the ruts' progress, and pebbles. */
export class Ground {
  readonly group = new THREE.Group();
  /** Lander-local x the front wheels' contact has reached (ruts are pressed up to here). */
  readonly front = { value: -1e9 };
  private readonly material: THREE.MeshLambertMaterial;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly opts: GroundOptions;
  private readonly NEAR = { x0: 1.6, x1: 17, z0: -2.55, z1: 2.55, step: 0.03, lift: 0.02, fade: 0.45 };
  private readonly HALO = { half: 26, step: 0.22, lift: 0.01, fade: 1.5 };

  constructor(opts: GroundOptions) {
    this.opts = opts;
    this.group.name = 'act2:ground';
    const m = new THREE.MeshLambertMaterial({ color: REGOLITH_COLOR });
    patchMoonLighting(m, opts.moon as never, true, true);
    this.material = this.extend(m);
    this.disposables.push(this.material);

    const near = this.NEAR;
    this.group.add(this.patch(near.x0, near.x1, near.z0, near.z1, near.step, near.lift, near.fade, true));
    const h = this.HALO;
    this.group.add(this.patch(-h.half, h.half, -h.half, h.half, h.step, h.lift, h.fade, false));
    for (const p of opts.footpads) {
      const r = opts.footPadR + 0.5;
      this.group.add(this.patch(p.x - r, p.x + r, p.z - r, p.z + r, 0.018, 0.015, 0.2, false, p));
    }
    this.group.add(this.pebbles());
  }

  /** Ground height at lander-local (x, z), in the lander's frame (relative to its origin), with the patches' lift. */
  heightLocal(lx: number, lz: number): number {
    const [wx, wz] = toWorld(this.opts.frame, lx, lz);
    return meshHeight(this.opts.grid, wx, wz) - this.opts.frame.origin.y + this.liftNear(lx, lz);
  }

  private liftNear(lx: number, lz: number): number {
    const n = this.NEAR;
    const e = Math.min(lx - n.x0, n.x1 - lx, lz - n.z0, n.z1 - lz);
    if (e <= 0) return this.HALO.lift;
    return Math.max(this.HALO.lift, n.lift * Math.min(1, e / n.fade));
  }

  /** The ground material with ruts (vertex displacement, chevrons), the blast halo, in the game's ground shader. */
  private extend(m: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
    const prev = m.onBeforeCompile.bind(m);
    const t = this.opts.tracks;
    const f = this.opts.frame;
    m.onBeforeCompile = (shader, renderer) => {
      prev(shader, renderer);
      shader.uniforms.uFrontX = this.front;
      shader.uniforms.uLanderOrigin = { value: new THREE.Vector2(f.origin.x, f.origin.z) };
      shader.uniforms.uLanderYaw = { value: f.yaw };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec4 aTrack; // x: local x, y: signed offset from the rut centre, z: displacement once pressed, w: 1 in a rut
          attribute vec3 aNormalT;
          uniform float uFrontX;
          varying vec3 vTrack;
          float trackPressed() { return aTrack.w * step( aTrack.x, uFrontX ); }`,
        )
        .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize( mix( vec3( normal ), aNormalT, trackPressed() ) );\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif`)
        .replace('#include <begin_vertex>', `vec3 transformed = vec3( position );\ntransformed.y += aTrack.z * trackPressed();\nvTrack = vec3( aTrack.x, aTrack.y, trackPressed() );`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTrack;
          uniform vec2 uLanderOrigin;
          uniform float uLanderYaw;
          float cineHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
          // The chevron cleats' imprint: height across one pitch, a sharp-edged groove.
          float chevron( vec2 tq ) {
            float u = ( tq.x - abs( tq.y ) * ${t.slant.toFixed(3)} ) / ${t.pitch.toFixed(4)};
            float k = fract( u );
            return smoothstep( 0.0, 0.12, k ) * ( 1.0 - smoothstep( 0.32, 0.5, k ) );
          }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            // Blast halo: the landing's exhaust swept the finest dust off, a brighter ring with radial streaks.
            vec2 d = vMoonWorld.xz - uLanderOrigin;
            float r = length( d );
            float ang = atan( d.y, d.x );
            float streak = 0.55 + 0.45 * sin( ang * 37.0 + sin( ang * 11.0 ) * 2.0 ) * sin( ang * 23.0 + 1.3 );
            float halo = smoothstep( 2.2, 5.0, r ) * ( 1.0 - smoothstep( 8.0, 24.0, r ) );
            float scour = 1.0 - 0.1 * ( 1.0 - smoothstep( 1.0, 3.2, r ) );
            diffuseColor.rgb *= ( 1.0 + 0.16 * halo * ( 0.6 + 0.4 * streak ) ) * scour;
            // Ruts: compacted soil a little darker, the cleats' imprints darker still.
            if ( vTrack.z > 0.5 ) {
              float across = abs( vTrack.y ) / ${t.halfWidth.toFixed(3)};
              float inRut = 1.0 - smoothstep( 0.85, 1.05, across );
              diffuseColor.rgb *= 1.0 - inRut * ( 0.05 + 0.06 * chevron( vTrack.xy ) );
            }
          }`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          if ( vTrack.z > 0.5 ) {
            float across = abs( vTrack.y ) / ${t.halfWidth.toFixed(3)};
            float inRut = 1.0 - smoothstep( 0.8, 1.0, across );
            vec2 e = vec2( 0.0025, 0.0 );
            float h0 = chevron( vTrack.xy );
            float hx = chevron( vTrack.xy + e.xy );
            float hz = chevron( vTrack.xy + e.yx );
            // Slope in the rut's own axes (x along, y across) → world (rotate by the lander's yaw).
            vec2 g = vec2( hx - h0, hz - h0 ) / e.x * 0.0028 * inRut;
            float c = cos( uLanderYaw ), s = sin( uLanderYaw );
            vec3 gw = vec3( g.x * c + g.y * s, 0.0, -g.x * s + g.y * c );
            vec3 nw = inverseTransformDirection( normal, viewMatrix );
            nw = normalize( nw - ( gw - nw * dot( gw, nw ) ) );
            normal = normalize( ( viewMatrix * vec4( nw, 0.0 ) ).xyz );
          }`,
        );
    };
    m.customProgramCacheKey = () => 'act2-ground';
    m.needsUpdate = true;
    return m;
  }

  /**
   * One patch: a grid in the lander's frame from (x0, z0) to (x1, z1), on the terrain mesh, lifted by `lift`
   * (fading to 0 over `fade` at the edges). `ruts`: carries the wheel ruts. `pad`: a footpad pressed in here.
   */
  private patch(x0: number, x1: number, z0: number, z1: number, step: number, lift: number, fade: number, ruts: boolean, pad?: THREE.Vector3): THREE.Mesh {
    const { grid, frame, tracks } = this.opts;
    const nx = Math.ceil((x1 - x0) / step) + 1;
    const nz = Math.ceil((z1 - z0) / step) + 1;
    const count = nx * nz;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const norT = new Float32Array(count * 3);
    const trk = new Float32Array(count * 4);
    const n = new THREE.Vector3();
    const c = Math.cos(frame.yaw);
    const s = Math.sin(frame.yaw);
    const padR = this.opts.footPadR;
    // Extra relief (lander-local heights): the footpad's berm.
    const relief = (lx: number, lz: number) => {
      if (!pad) return 0;
      const r = Math.hypot(lx - pad.x, lz - pad.z);
      const a = Math.atan2(lz - pad.z, lx - pad.x);
      const rough = 0.004 * Math.sin(a * 13 + 1.7) + 0.003 * Math.sin(a * 29);
      if (r < padR - 0.02) return -0.04;
      const berm = 0.028 * Math.exp(-(((r - (padR + 0.05)) / 0.075) ** 2)) + 0.006 * Math.exp(-(((r - padR - 0.22) / 0.12) ** 2));
      return berm + rough * Math.exp(-(((r - padR - 0.08) / 0.1) ** 2));
    };
    // The rut profile across the tyre (signed offset from its centre): pressed depth, raised berms beside.
    // The rut profile across the tyre (signed offset from its centre) at distance lx along it: a pressed
    // floor, soft walls (crumbling, so their edge wanders), and a low berm of pushed-out soil beside.
    const wander = (lx: number, seed: number) =>
      Math.sin(lx * 7.3 + seed) * 0.5 + Math.sin(lx * 17.1 + 1.3 + seed * 2) * 0.3 + Math.sin(lx * 43.7 + 2 + seed * 3) * 0.2;
    const rut = (off: number, lx: number) => {
      const side = off < 0 ? 0 : 5;
      const a = Math.abs(off) / tracks.halfWidth;
      const depth = tracks.depth * (1 + 0.22 * wander(lx, 11));
      const edge = 0.72 + 0.1 * wander(lx, side);
      const wall = 0.45 + 0.12 * wander(lx, side + 3);
      const berm = tracks.berm * (1 + 0.5 * wander(lx, side + 7));
      if (a < edge) return -depth * (1 - 0.12 * (a / edge) ** 2);
      if (a < edge + wall) {
        const k = (a - edge) / wall;
        const sm = k * k * (3 - 2 * k);
        return THREE.MathUtils.lerp(-depth * 0.88, berm, sm);
      }
      const b = (a - edge - wall) / 0.7;
      return b < 1 ? berm * (1 - b) ** 2 : 0;
    };
    const heightAt = (lx: number, lz: number, withRut: boolean) => {
      const wx = frame.origin.x + lx * c + lz * s;
      const wz = frame.origin.z - lx * s + lz * c;
      const e = Math.min(lx - x0, x1 - lx, lz - z0, z1 - lz);
      const k = Math.min(1, Math.max(0, e / fade));
      let y = meshHeight(grid, wx, wz) + lift * k + relief(lx, lz) * k;
      if (withRut) {
        for (const line of tracks.lines) {
          const off = lz - line;
          if (Math.abs(off) < tracks.halfWidth * 2.2 && lx >= tracks.startX) y += rut(off, lx) * k * Math.min(1, (lx - tracks.startX) / 0.08);
        }
      }
      return { y, wx, wz };
    };
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const v = j * nx + i;
        const lx = Math.min(x1, x0 + i * step);
        const lz = Math.min(z1, z0 + j * step);
        const base = heightAt(lx, lz, false);
        pos[v * 3] = base.wx;
        pos[v * 3 + 1] = base.y;
        pos[v * 3 + 2] = base.wz;
        meshNormal(grid, base.wx, base.wz, n);
        // Tilt by the relief's slope (footpad berms).
        if (pad) {
          const e = 0.01;
          const dx = (heightAt(lx + e, lz, false).y - heightAt(lx - e, lz, false).y) / (2 * e) - 0; // includes terrain slope
          const dz = (heightAt(lx, lz + e, false).y - heightAt(lx, lz - e, false).y) / (2 * e);
          // Local slope → world normal.
          const gx = dx * c + dz * s;
          const gz = -dx * s + dz * c;
          n.set(-gx, 1, -gz).normalize();
        }
        nor[v * 3] = n.x;
        nor[v * 3 + 1] = n.y;
        nor[v * 3 + 2] = n.z;
        norT[v * 3] = n.x;
        norT[v * 3 + 1] = n.y;
        norT[v * 3 + 2] = n.z;
        trk[v * 4] = lx;
        trk[v * 4 + 3] = 0;
        if (ruts && lx >= tracks.startX) {
          let best = 1e9;
          let bestLine = 0;
          for (const line of tracks.lines) if (Math.abs(lz - line) < Math.abs(best)) {
            best = lz - line;
            bestLine = line;
          }
          if (Math.abs(best) < tracks.halfWidth * 2.2) {
            const pressed = heightAt(lx, lz, true);
            trk[v * 4 + 1] = best;
            trk[v * 4 + 2] = pressed.y - base.y;
            trk[v * 4 + 3] = 1;
            const e = 0.012;
            const dx = (heightAt(lx + e, lz, true).y - heightAt(lx - e, lz, true).y) / (2 * e);
            const dz = (heightAt(lx, lz + e, true).y - heightAt(lx, lz - e, true).y) / (2 * e);
            const gx = dx * c + dz * s;
            const gz = -dx * s + dz * c;
            const nt = new THREE.Vector3(-gx, 1, -gz).normalize();
            norT[v * 3] = nt.x;
            norT[v * 3 + 1] = nt.y;
            norT[v * 3 + 2] = nt.z;
            void bestLine;
          }
        }
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + nx;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aNormalT', new THREE.BufferAttribute(norT, 3));
    g.setAttribute('aTrack', new THREE.BufferAttribute(trk, 4));
    g.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    // Winding: in world space the grid may be mirrored by the yaw (it is not: a rotation), but check the
    // first triangle faces up and flip if not.
    const p0 = new THREE.Vector3().fromArray(pos, idx[0]! * 3);
    const p1 = new THREE.Vector3().fromArray(pos, idx[1]! * 3);
    const p2 = new THREE.Vector3().fromArray(pos, idx[2]! * 3);
    if (p1.sub(p0).cross(p2.sub(p0)).y < 0) {
      const index = g.getIndex()!;
      for (let k = 0; k < index.count; k += 3) {
        const t = index.getX(k + 1);
        index.setX(k + 1, index.getX(k + 2));
        index.setX(k + 2, t);
      }
    }
    this.disposables.push(g);
    const mesh = new THREE.Mesh(g, this.material);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Pebbles and small rocks around the ramp's foot and along the drive, clear of the wheel lines. */
  private pebbles(): THREE.InstancedMesh {
    const { tracks, frame, envMap } = this.opts;
    const rand = seeded(1234);
    // A lumpy rock: an icosahedron with noise, flattened.
    const ico = new THREE.IcosahedronGeometry(1, 3);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    const geo = mergeVertices(ico);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = 1 + 0.22 * Math.sin(v.x * 3.1 + 1) * Math.sin(v.y * 2.7 + 2) * Math.sin(v.z * 3.3) + 0.12 * Math.sin(v.x * 7 + v.z * 5);
      v.multiplyScalar(k);
      p.setXYZ(i, v.x, v.y * 0.7, v.z);
    }
    geo.computeVertexNormals();
    this.disposables.push(geo);
    const mat = cinePatch(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.27, 0.26, 0.245), roughness: 0.95, metalness: 0, envMap }), { moon: this.opts.moon, key: 'pebble' });
    this.disposables.push(mat);
    const count = 900;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let n = 0;
    const c = Math.cos(frame.yaw);
    const s = Math.sin(frame.yaw);
    for (let tries = 0; n < count && tries < count * 6; tries++) {
      const lx = 3.2 + rand() * 13;
      const lz = (rand() * 2 - 1) * 2.3;
      if (tracks.lines.some((line) => Math.abs(lz - line) < tracks.halfWidth * 1.9)) continue;
      // Sizes: mostly grit and pebbles, a few fist-sized rocks.
      const u = rand();
      const size = u < 0.8 ? 0.006 + rand() * 0.018 : u < 0.97 ? 0.025 + rand() * 0.03 : 0.06 + rand() * 0.06;
      const y = this.heightLocal(lx, lz) + frame.origin.y - size * 0.35;
      const wx = frame.origin.x + lx * c + lz * s;
      const wz = frame.origin.z - lx * s + lz * c;
      q.setFromEuler(new THREE.Euler(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6));
      m.compose(new THREE.Vector3(wx, y, wz), q, new THREE.Vector3(size * (0.8 + rand() * 0.5), size, size * (0.8 + rand() * 0.5)));
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
