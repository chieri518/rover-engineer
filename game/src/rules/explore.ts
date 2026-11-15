// The area explored so far: a coarse grid over the play area, revealed in a circle around the rover.
// The minimap draws it; the Mapper milestone (Phase 5) can read its share. Pure (no DOM).
import type { Tuning } from './types';

export interface ExploredMap {
  sizeM: number; // play area width; the grid is centered on the origin
  cellM: number;
  n: number; // cells per side
  cells: Uint8Array; // 1 = explored
  count: number;
}

export function createExplored(sizeM: number, explore: Tuning['explore']): ExploredMap {
  const n = Math.ceil(sizeM / explore.cellM);
  return { sizeM, cellM: explore.cellM, n, cells: new Uint8Array(n * n), count: 0 };
}

/** Mark the cells whose centers lie within radiusM of (x, z). Returns how many cells were newly explored. */
export function reveal(map: ExploredMap, x: number, z: number, radiusM: number): number {
  const { n, cellM } = map;
  const half = map.sizeM / 2;
  const toCell = (v: number) => Math.floor((v + half) / cellM);
  const c0 = Math.max(0, toCell(x - radiusM));
  const c1 = Math.min(n - 1, toCell(x + radiusM));
  const r0 = Math.max(0, toCell(z - radiusM));
  const r1 = Math.min(n - 1, toCell(z + radiusM));
  let added = 0;
  for (let r = r0; r <= r1; r++) {
    const cz = (r + 0.5) * cellM - half;
    for (let c = c0; c <= c1; c++) {
      const cx = (c + 0.5) * cellM - half;
      const i = r * n + c;
      if (map.cells[i] === 0 && (cx - x) ** 2 + (cz - z) ** 2 <= radiusM * radiusM) {
        map.cells[i] = 1;
        added++;
      }
    }
  }
  map.count += added;
  return added;
}

export function exploredShare(map: ExploredMap): number {
  return map.count / (map.n * map.n);
}
