// Chunked terrain meshes with distance-based level of detail.
// One ChunkLayer per height grid: the 8 km play area, the 50 km near ring and the 400 km far ring.
// Rings cover the grid inside them too; there their vertices are sunk under the inner terrain
// (and match it exactly on the shared edge), so the layers join without visible seams.
// Chunk edges between different detail levels are hidden by skirts.
import * as THREE from 'three';
import type { HeightGrid } from './terrainData';

export interface ChunkLayerOptions {
  grid: HeightGrid;
  chunkCells: number; // cells per chunk side; must divide n − 1
  /** Vertex step (in cells) by distance: use steps[i] while the chunk is closer than distances[i]. */
  lod: { steps: number[]; distances: number[] };
  /** The grid inside this one: its area is sunk and its edge matched. */
  inner?: HeightGrid;
}

interface Chunk {
  col0: number;
  row0: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  step: number; // 0 = not built yet
  mesh: THREE.Mesh | null;
}

const LOD_HYSTERESIS = 1.1;
const SINK_BASE_M = 2;

export class ChunkLayer {
  readonly group = new THREE.Group();
  private readonly chunks: Chunk[] = [];

  constructor(
    private readonly opts: ChunkLayerOptions,
    private readonly material: THREE.Material,
  ) {
    const { grid, chunkCells } = opts;
    const perSide = (grid.n - 1) / chunkCells;
    if (!Number.isInteger(perSide)) throw new Error('chunkCells must divide the grid');
    for (let j = 0; j < perSide; j++) {
      for (let i = 0; i < perSide; i++) {
        const col0 = i * chunkCells;
        const row0 = j * chunkCells;
        const minX = (col0 - grid.half) * grid.pixel;
        const minZ = (row0 - grid.half) * grid.pixel;
        const size = chunkCells * grid.pixel;
        this.chunks.push({ col0, row0, minX, maxX: minX + size, minZ, maxZ: minZ + size, step: 0, mesh: null });
      }
    }
    this.group.matrixAutoUpdate = false;
  }

  /** Total vertex count currently built (for performance checks). */
  get vertexCount(): number {
    let n = 0;
    for (const c of this.chunks) n += c.mesh ? c.mesh.geometry.getAttribute('position').count : 0;
    return n;
  }

  /**
   * Rebuild chunks whose detail level should change for a viewer at (x, z).
   * At most `budget` chunks are rebuilt per call, nearest first; pass Infinity to build everything.
   */
  update(x: number, z: number, budget: number): void {
    const pending: { chunk: Chunk; step: number; dist: number }[] = [];
    for (const chunk of this.chunks) {
      const dist = Math.hypot(
        Math.max(chunk.minX - x, 0, x - chunk.maxX),
        Math.max(chunk.minZ - z, 0, z - chunk.maxZ),
      );
      const step = this.stepFor(dist, chunk.step);
      if (step !== chunk.step) pending.push({ chunk, step, dist });
    }
    pending.sort((a, b) => a.dist - b.dist);
    for (let k = 0; k < Math.min(budget, pending.length); k++) {
      const { chunk, step } = pending[k]!;
      this.build(chunk, step);
    }
  }

  private stepFor(dist: number, current: number): number {
    const { steps, distances } = this.opts.lod;
    for (let i = 0; i < steps.length; i++) {
      // Only coarsen once clearly past the threshold, to avoid flicking between levels.
      const limit = current !== 0 && steps[i]! >= current ? distances[i]! * LOD_HYSTERESIS : distances[i]!;
      if (dist < limit) return steps[i]!;
    }
    return steps[steps.length - 1]!;
  }

  private build(chunk: Chunk, step: number): void {
    const geometry = this.buildGeometry(chunk, step);
    if (chunk.mesh) {
      chunk.mesh.geometry.dispose();
      chunk.mesh.geometry = geometry;
    } else {
      chunk.mesh = new THREE.Mesh(geometry, this.material);
      chunk.mesh.matrixAutoUpdate = false;
      chunk.mesh.receiveShadow = true;
      this.group.add(chunk.mesh);
    }
    chunk.step = step;
  }

  /** Height used for a vertex, sinking it under the inner grid where that grid takes over. */
  private vertexHeight(col: number, row: number, cellM: number): number {
    const { grid, inner } = this.opts;
    const own = grid.at(col, row);
    if (!inner) return own;
    const x = (col - grid.half) * grid.pixel;
    const z = (row - grid.half) * grid.pixel;
    const e = inner.extent;
    const ax = Math.abs(x);
    const az = Math.abs(z);
    if (ax > e + 1e-3 || az > e + 1e-3) return own;
    const innerH = inner.sample(x, z);
    const inside = Math.min(e - ax, e - az);
    if (inside < 1e-3) return innerH; // shared edge: match the inner grid exactly
    // Just inside: barely below; deeper inside: far below, out of sight under the inner terrain.
    return innerH - SINK_BASE_M - Math.max(0, inside - cellM);
  }

  private buildGeometry(chunk: Chunk, step: number): THREE.BufferGeometry {
    const { grid, chunkCells } = this.opts;
    const m = chunkCells / step + 1; // vertices per side
    const cellM = step * grid.pixel;
    const skirtDepth = 2 + cellM * 0.5;
    const count = m * m + 4 * m;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const n = new THREE.Vector3();

    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const col = chunk.col0 + i * step;
        const row = chunk.row0 + j * step;
        const v = j * m + i;
        positions[v * 3] = (col - grid.half) * grid.pixel;
        positions[v * 3 + 1] = this.vertexHeight(col, row, cellM);
        positions[v * 3 + 2] = (row - grid.half) * grid.pixel;
        // Normal from the raw grid, using neighbors one step away (same on both sides of a chunk edge).
        const dx = (grid.at(col + step, row) - grid.at(col - step, row)) / (2 * cellM);
        const dz = (grid.at(col, row + step) - grid.at(col, row - step)) / (2 * cellM);
        n.set(-dx, 1, -dz).normalize();
        normals[v * 3] = n.x;
        normals[v * 3 + 1] = n.y;
        normals[v * 3 + 2] = n.z;
      }
    }

    // Skirts: a copy of each edge vertex, hanging down.
    const edges: number[][] = [[], [], [], []];
    for (let k = 0; k < m; k++) {
      edges[0]!.push(k); // top row (row0)
      edges[1]!.push((m - 1) * m + k); // bottom row
      edges[2]!.push(k * m); // left column
      edges[3]!.push(k * m + m - 1); // right column
    }
    let next = m * m;
    const skirtOf: number[][] = edges.map((edge) =>
      edge.map((src) => {
        const v = next++;
        positions[v * 3] = positions[src * 3]!;
        positions[v * 3 + 1] = positions[src * 3 + 1]! - skirtDepth;
        positions[v * 3 + 2] = positions[src * 3 + 2]!;
        normals[v * 3] = normals[src * 3]!;
        normals[v * 3 + 1] = normals[src * 3 + 1]!;
        normals[v * 3 + 2] = normals[src * 3 + 2]!;
        return v;
      }),
    );

    const indices: number[] = [];
    for (let j = 0; j < m - 1; j++) {
      for (let i = 0; i < m - 1; i++) {
        const a = j * m + i;
        const b = a + m; // next row (+z)
        const c = a + 1; // next column (+x)
        const d = b + 1;
        indices.push(a, b, c, c, b, d); // counter-clockwise seen from above
      }
    }
    // Skirt quads, emitted with both windings so they show from either side.
    edges.forEach((edge, e) => {
      const skirt = skirtOf[e]!;
      for (let k = 0; k < m - 1; k++) {
        const t0 = edge[k]!;
        const t1 = edge[k + 1]!;
        const s0 = skirt[k]!;
        const s1 = skirt[k + 1]!;
        indices.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0);
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  dispose(): void {
    for (const c of this.chunks) c.mesh?.geometry.dispose();
    this.group.clear();
  }
}
