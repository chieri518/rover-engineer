// Rapier heightfield colliders for the play area, streamed in tiles around the rover.
// A single 1601 × 1601 heightfield would be heavy; only the tiles near the rover exist at a time.
import type RAPIER from '@dimforge/rapier3d-compat';
import type { HeightGrid } from './terrainData';

type Rapier = typeof RAPIER;

const TILE_CELLS = 40; // 200 m tiles at 5 m
const KEEP_RADIUS_M = 300; // tiles closer than this to the rover exist

export class TerrainColliders {
  private readonly tiles = new Map<number, RAPIER.Collider>();
  private readonly perSide: number;

  constructor(
    private readonly rapier: Rapier,
    private readonly world: RAPIER.World,
    private readonly grid: HeightGrid,
  ) {
    this.perSide = Math.ceil((grid.n - 1) / TILE_CELLS);
  }

  get count(): number {
    return this.tiles.size;
  }

  update(x: number, z: number): void {
    const { grid } = this;
    const tileM = TILE_CELLS * grid.pixel;
    const wanted = new Set<number>();
    for (let j = 0; j < this.perSide; j++) {
      for (let i = 0; i < this.perSide; i++) {
        const minX = (i * TILE_CELLS - grid.half) * grid.pixel;
        const minZ = (j * TILE_CELLS - grid.half) * grid.pixel;
        const dist = Math.hypot(
          Math.max(minX - x, 0, x - (minX + tileM)),
          Math.max(minZ - z, 0, z - (minZ + tileM)),
        );
        if (dist < KEEP_RADIUS_M) wanted.add(j * this.perSide + i);
      }
    }
    for (const [key, collider] of this.tiles) {
      if (!wanted.has(key)) {
        this.world.removeCollider(collider, false);
        this.tiles.delete(key);
      }
    }
    for (const key of wanted) {
      if (!this.tiles.has(key)) this.tiles.set(key, this.createTile(key % this.perSide, Math.floor(key / this.perSide)));
    }
  }

  private createTile(i: number, j: number): RAPIER.Collider {
    const { grid } = this;
    const col0 = i * TILE_CELLS;
    const row0 = j * TILE_CELLS;
    const cols = Math.min(TILE_CELLS, grid.n - 1 - col0); // cells along x
    const rows = Math.min(TILE_CELLS, grid.n - 1 - row0); // cells along z
    // Rapier: rows run along z, columns along x, column-major, centered on the collider.
    const heights = new Float32Array((rows + 1) * (cols + 1));
    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows; r++) heights[c * (rows + 1) + r] = grid.at(col0 + c, row0 + r);
    }
    const sizeX = cols * grid.pixel;
    const sizeZ = rows * grid.pixel;
    const desc = this.rapier.ColliderDesc.heightfield(
      rows,
      cols,
      heights,
      { x: sizeX, y: 1, z: sizeZ },
      this.rapier.HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setTranslation((col0 - grid.half) * grid.pixel + sizeX / 2, 0, (row0 - grid.half) * grid.pixel + sizeZ / 2)
      .setFriction(0.9);
    return this.world.createCollider(desc);
  }
}
