// 8-bit terrain masks for the mission systems: slope (slope.png) and the cold zones (cold-mask.png).
// Decode formulas are in each world's terrain.json. Cold zones are the permanently shadowed
// patches (mask >= 128) connected to the terrain.json features listed in tuning.cold.zones: on the Moon
// the shadowed crater and the small cold patch in Rocky area 1. Other tiny shadowed spots are ignored.
// Mars has no cold mask (its night cold is map-wide), so it has no cold zones.
import { decode } from 'fast-png';
import type { SiteSpec, Tuning } from '../rules/types';
import { coldZoneAnchor, type SiteFeatures } from '../rules/sites';
import type { SoftArea } from '../rules/ground';
import type { MarsTerrainFeatures } from '../rules/marsTypes';
import { terrainUrl, type WorldId } from '../worlds';

interface Point { x: number; z: number }

/** Moon terrain.json features (absent on Mars). */
export interface MoonTerrainFeatures {
  rimViewpoints: { name: string; local: Point; lookToward: Point }[];
  shadowedCrater: { centroidLocal: Point; outlineLocal_xz: [number, number][]; entryPoint: { local: Point }; iceCandidate: { local: Point } };
  craterDescent: { name: string; local: Point };
}

/**
 * terrain.json features: rocky areas on every world; the Moon's and Mars's own features are optional,
 * so each world's code checks for the ones it uses.
 */
export type TerrainFeatures = { rockyAreas: { name: string; local: Point; radius_m: number }[] }
  & Partial<MoonTerrainFeatures> & Partial<Omit<MarsTerrainFeatures, 'rockyAreas'>>;

/** The parts of terrain.json the mission systems read. */
export interface FeatureInfo {
  playArea: { pixel_m: number; samples: number; files: { slope: { file: string }; coldMask?: { file: string }; softGround?: { file: string } } };
  landing: { local: Point & { y: number } };
  features: TerrainFeatures;
}

const PSR_THRESHOLD = 128; // terrain.json: value >= 128 means permanently shadowed

export class TerrainMasks {
  readonly n: number;
  readonly pixel: number;
  readonly half: number;
  /** Soft ground: the Moon's fresh crater rims (its rocky areas); Mars's sand-ripple fields. */
  readonly softAreas: SoftArea[];
  /** Where boulders lie: the rocky areas on every world. */
  readonly boulderAreas: SoftArea[];

  constructor(
    readonly info: FeatureInfo,
    private readonly slope: Uint8Array,
    /** 1 inside a cold zone. */
    readonly cold: Uint8Array,
  ) {
    this.n = info.playArea.samples;
    this.pixel = info.playArea.pixel_m;
    this.half = (this.n - 1) / 2;
    const circles = (list: { local: Point; radius_m: number }[]) => list.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
    this.boulderAreas = circles(info.features.rockyAreas);
    const sand = info.features.softGround?.areas;
    this.softAreas = sand ? circles(sand) : this.boulderAreas;
  }

  private index(x: number, z: number): number {
    const c = Math.min(this.n - 1, Math.max(0, Math.round(x / this.pixel + this.half)));
    const r = Math.min(this.n - 1, Math.max(0, Math.round(z / this.pixel + this.half)));
    return r * this.n + c;
  }

  /** Terrain slope in degrees at (x, z) (nearest 5 m sample). */
  slopeAt(x: number, z: number): number {
    return this.slope[this.index(x, z)]! / 4;
  }

  inColdZone(x: number, z: number): boolean {
    return this.cold[this.index(x, z)] === 1;
  }
}

async function fetchMask(url: string): Promise<{ data: Uint8Array; n: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
  const png = decode(new Uint8Array(await res.arrayBuffer()));
  if (png.width !== png.height || png.channels !== 1 || png.depth !== 8) throw new Error(`${url}: expected a square 8-bit grayscale PNG`);
  return { data: png.data as Uint8Array, n: png.width };
}

/** Flood-fill the permanently shadowed patch nearest each anchor (within the search radius). */
function coldZones(psr: Uint8Array, n: number, pixel: number, anchors: Point[], radiusM: number): Uint8Array {
  const half = (n - 1) / 2;
  const zone = new Uint8Array(n * n);
  const stack: number[] = [];
  for (const a of anchors) {
    const ac = Math.round(a.x / pixel + half);
    const ar = Math.round(a.z / pixel + half);
    const rad = Math.ceil(radiusM / pixel);
    let best = -1;
    let bestD = Infinity;
    for (let r = Math.max(0, ar - rad); r <= Math.min(n - 1, ar + rad); r++) {
      for (let c = Math.max(0, ac - rad); c <= Math.min(n - 1, ac + rad); c++) {
        const d = (r - ar) ** 2 + (c - ac) ** 2;
        if (psr[r * n + c]! >= PSR_THRESHOLD && d < bestD && d <= rad * rad) {
          bestD = d;
          best = r * n + c;
        }
      }
    }
    if (best < 0 || zone[best]) continue;
    zone[best] = 1;
    stack.push(best);
    while (stack.length) {
      const i = stack.pop()!;
      const c = i % n;
      const r = (i - c) / n;
      const next = [c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1, r > 0 ? i - n : -1, r < n - 1 ? i + n : -1];
      for (const j of next) {
        if (j >= 0 && !zone[j] && psr[j]! >= PSR_THRESHOLD) {
          zone[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return zone;
}

const cache = new Map<WorldId, Promise<TerrainMasks>>();

/**
 * A world's masks, loaded once per world (the cold zones depend on that world's tuning.cold). Each cold
 * zone is anchored by rules/sites.ts coldZoneAnchor: a terrain.json feature, or a cold trap in `sites`.
 * TODO(Phase 4 of the Moon sites plan): pass data.sites.sites from the callers, so the East and South
 * cold traps join the cold zones; until then only terrain features anchor, as before.
 */
export function loadTerrainMasks(tuning: Tuning, world: WorldId, sites: readonly SiteSpec[] = []): Promise<TerrainMasks> {
  let cached = cache.get(world);
  if (cached) return cached;
  cached = (async () => {
    const base = terrainUrl(world);
    const res = await fetch(`${base}terrain.json`);
    if (!res.ok) throw new Error(`could not load terrain.json: ${res.status}`);
    const info = (await res.json()) as FeatureInfo;
    const coldFile = info.playArea.files.coldMask?.file;
    const [slope, psr] = await Promise.all([
      fetchMask(base + info.playArea.files.slope.file),
      coldFile ? fetchMask(base + coldFile) : null,
    ]);
    const anchors = tuning.cold.zones.map((z) => coldZoneAnchor(z, info.features as SiteFeatures, sites)).filter((p): p is Point => p !== null);
    const cold = psr
      ? coldZones(psr.data, psr.n, info.playArea.pixel_m, anchors, tuning.cold.zoneSearchRadiusM)
      : new Uint8Array(slope.n * slope.n);
    return new TerrainMasks(info, slope.data, cold);
  })();
  cache.set(world, cached);
  cached.catch(() => cache.delete(world));
  return cached;
}
