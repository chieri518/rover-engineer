// Loads the terrain pipeline outputs from each world's terrain folder (public/terrain/ for the Moon, see
// src/worlds.ts; game/tools/README.md and terrain.json). 16-bit PNGs are decoded with fast-png: a browser
// canvas would cut them to 8 bits.
import { decode } from 'fast-png';
import { terrainUrl, type WorldId } from '../worlds';

/** The parts of terrain.json the game reads. */
export interface TerrainInfo {
  frame: { originLatLon: [number, number] };
  sunAndEarth: { siteLatitude_deg: number; siteLongitude_deg: number };
  playArea: {
    size_m: number;
    pixel_m: number;
    samples: number;
    files: { heightmap: { file: string; min_m: number; max_m: number } };
  };
  distantTerrain: { name: string; file: string; min_m: number; max_m: number; pixel_m: number; samples: number }[];
  landing: { local: { x: number; y: number; z: number } };
}

/**
 * A square, vertex-centered height grid in the local frame: sample (col, row) sits at
 * x = (col − half) · pixel, z = (row − half) · pixel.
 */
export class HeightGrid {
  readonly half: number; // index of the center sample
  readonly extent: number; // meters from the center to the edge
  readonly maxHeight: number;

  constructor(
    readonly n: number,
    readonly pixel: number,
    readonly heights: Float32Array,
  ) {
    this.half = (n - 1) / 2;
    this.extent = this.half * pixel;
    let max = -Infinity;
    for (const h of heights) if (h > max) max = h;
    this.maxHeight = max;
  }

  at(col: number, row: number): number {
    const c = Math.min(Math.max(col, 0), this.n - 1);
    const r = Math.min(Math.max(row, 0), this.n - 1);
    return this.heights[r * this.n + c]!;
  }

  contains(x: number, z: number): boolean {
    return Math.abs(x) <= this.extent && Math.abs(z) <= this.extent;
  }

  /** Bilinear height at local (x, z), clamped to the grid. */
  sample(x: number, z: number): number {
    const fx = Math.min(Math.max(x / this.pixel + this.half, 0), this.n - 1);
    const fz = Math.min(Math.max(z / this.pixel + this.half, 0), this.n - 1);
    const c = Math.min(Math.floor(fx), this.n - 2);
    const r = Math.min(Math.floor(fz), this.n - 2);
    const tx = fx - c;
    const tz = fz - r;
    const i = r * this.n + c;
    const h = this.heights;
    const top = h[i]! * (1 - tx) + h[i + 1]! * tx;
    const bottom = h[i + this.n]! * (1 - tx) + h[i + this.n + 1]! * tx;
    return top * (1 - tz) + bottom * tz;
  }
}

export interface Terrain {
  info: TerrainInfo;
  /** 8 km play area at 5 m. */
  fine: HeightGrid;
  /** 50 km at 50 m. */
  near: HeightGrid;
  /** 400 km at 400 m. */
  far: HeightGrid;
  /** Height at (x, z) from the most detailed grid that covers it. */
  heightAt(x: number, z: number): number;
  /** Highest point of all grids (tangent-plane heights). */
  maxHeight: number;
}

async function fetchGrid(url: string, minM: number, maxM: number, pixel: number): Promise<HeightGrid> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
  const png = decode(new Uint8Array(await res.arrayBuffer()));
  if (png.width !== png.height || png.channels !== 1) throw new Error(`${url}: expected a square grayscale PNG`);
  const scale = (maxM - minM) / (png.depth === 16 ? 65535 : 255);
  const heights = new Float32Array(png.width * png.height);
  const src = png.data;
  for (let i = 0; i < heights.length; i++) heights[i] = minM + src[i]! * scale;
  return new HeightGrid(png.width, pixel, heights);
}

const cache = new Map<WorldId, Promise<Terrain>>();

/** Loads and decodes a world's terrain once; later missions on that world reuse it. */
export function loadTerrain(world: WorldId): Promise<Terrain> {
  let cached = cache.get(world);
  if (cached) return cached;
  cached = (async () => {
    const base = terrainUrl(world);
    const res = await fetch(`${base}terrain.json`);
    if (!res.ok) throw new Error(`could not load terrain.json: ${res.status}`);
    const info = (await res.json()) as TerrainInfo;
    const hm = info.playArea.files.heightmap;
    const nearInfo = info.distantTerrain[0]!;
    const farInfo = info.distantTerrain[1]!;
    const [fine, near, far] = await Promise.all([
      fetchGrid(base + hm.file, hm.min_m, hm.max_m, info.playArea.pixel_m),
      fetchGrid(base + nearInfo.file, nearInfo.min_m, nearInfo.max_m, nearInfo.pixel_m),
      fetchGrid(base + farInfo.file, farInfo.min_m, farInfo.max_m, farInfo.pixel_m),
    ]);
    return {
      info,
      fine,
      near,
      far,
      maxHeight: Math.max(fine.maxHeight, near.maxHeight, far.maxHeight),
      heightAt(x: number, z: number) {
        if (fine.contains(x, z)) return fine.sample(x, z);
        if (near.contains(x, z)) return near.sample(x, z);
        return far.sample(x, z);
      },
    };
  })();
  cache.set(world, cached);
  cached.catch(() => cache.delete(world));
  return cached;
}

/**
 * Share of the Sun's disc visible from ground level at (x, z), marching the heights toward the Sun.
 * The same test the GPU sun mask runs; Phase 4 can use it for solar income at the rover.
 */
export function sunVisibility(terrain: Terrain, x: number, z: number, sun: { x: number; y: number; z: number }): number {
  const horiz = Math.hypot(sun.x, sun.z);
  if (horiz < 1e-6) return 1;
  const dx = sun.x / horiz;
  const dz = sun.z / horiz;
  const tanEl = sun.y / horiz;
  const h0 = terrain.heightAt(x, z) + GROUND_EYE_M;
  let maxTan = -Infinity;
  for (let t = terrain.fine.pixel; t < MARCH_MAX_M; t *= MARCH_GROWTH) {
    const px = x + dx * t;
    const pz = z + dz * t;
    if (!terrain.far.contains(px, pz)) break;
    maxTan = Math.max(maxTan, (terrain.heightAt(px, pz) - h0) / t);
    if ((terrain.maxHeight - h0) / t < tanEl - SUN_RADIUS_TAN) break;
  }
  return smoothstep(-SUN_RADIUS_TAN, SUN_RADIUS_TAN, tanEl - maxTan);
}

/**
 * How far a body in direction `dir` stands above the terrain horizon seen from (x, eyeY, z), as a
 * difference of slope tangents: positive when its center is above the horizon. Used for Earth photos.
 */
export function horizonMarginTan(terrain: Terrain, x: number, z: number, eyeY: number, dir: { x: number; y: number; z: number }): number {
  const horiz = Math.hypot(dir.x, dir.z);
  if (horiz < 1e-6) return dir.y > 0 ? Infinity : -Infinity;
  const dx = dir.x / horiz;
  const dz = dir.z / horiz;
  const tanEl = dir.y / horiz;
  let maxTan = -Infinity;
  for (let t = terrain.fine.pixel; t < MARCH_MAX_M; t *= MARCH_GROWTH) {
    const px = x + dx * t;
    const pz = z + dz * t;
    if (!terrain.far.contains(px, pz)) break;
    maxTan = Math.max(maxTan, (terrain.heightAt(px, pz) - eyeY) / t);
    if ((terrain.maxHeight - eyeY) / t < tanEl) break;
  }
  return tanEl - maxTan;
}

/** Height above the ground at which sunlight is tested (m). */
export const GROUND_EYE_M = 1.0;
/** March step growth and range shared by the CPU and GPU sun tests. */
export const MARCH_GROWTH = 1.04;
export const MARCH_MAX_M = 200_000;
/** Tangent of the Sun's angular radius (0.267°): sets the width of the soft shadow edge. */
export const SUN_RADIUS_TAN = Math.tan((0.267 * Math.PI) / 180);

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
