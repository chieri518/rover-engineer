// 8-bit terrain masks for the mission systems: slope (slope.png) and the cold zones (cold-mask.png).
// Decode formulas are in public/terrain/terrain.json. Cold zones are the permanently shadowed
// patches (mask >= 128) connected to the terrain.json features listed in tuning.cold.zones: the
// shadowed crater and the small cold patch in Rocky area 1. Other tiny shadowed spots are ignored.
import { decode } from 'fast-png';
import type { Tuning } from '../rules/types';
import type { SoftArea } from '../rules/ground';

interface Point { x: number; z: number }

/** The parts of terrain.json the mission systems read. */
export interface FeatureInfo {
  playArea: { pixel_m: number; samples: number; files: { slope: { file: string }; coldMask: { file: string } } };
  landing: { local: Point };
  features: {
    rimViewpoints: { name: string; local: Point }[];
    rockyAreas: { name: string; local: Point; radius_m: number }[];
    shadowedCrater: { centroidLocal: Point; outlineLocal_xz: [number, number][]; entryPoint: { local: Point }; iceCandidate: { local: Point } };
    craterDescent: { name: string; local: Point };
  };
}

const PSR_THRESHOLD = 128; // terrain.json: value >= 128 means permanently shadowed

export class TerrainMasks {
  readonly n: number;
  readonly pixel: number;
  readonly half: number;
  readonly softAreas: SoftArea[];

  constructor(
    readonly info: FeatureInfo,
    private readonly slope: Uint8Array,
    /** 1 inside a cold zone. */
    readonly cold: Uint8Array,
  ) {
    this.n = info.playArea.samples;
    this.pixel = info.playArea.pixel_m;
    this.half = (this.n - 1) / 2;
    this.softAreas = info.features.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
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

/** Where each named cold zone's feature sits: a terrain.json feature key or a feature name. */
function zoneAnchor(info: FeatureInfo, zone: string): Point | null {
  const f = info.features;
  if (zone === 'shadowedCrater') return f.shadowedCrater.centroidLocal;
  const named = [...f.rimViewpoints, ...f.rockyAreas, f.craterDescent].find((p) => p.name === zone);
  return named?.local ?? null;
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

let cached: Promise<TerrainMasks> | null = null;

export function loadTerrainMasks(tuning: Tuning): Promise<TerrainMasks> {
  cached ??= (async () => {
    const base = `${import.meta.env.BASE_URL}terrain/`;
    const res = await fetch(`${base}terrain.json`);
    if (!res.ok) throw new Error(`could not load terrain.json: ${res.status}`);
    const info = (await res.json()) as FeatureInfo;
    const [slope, psr] = await Promise.all([
      fetchMask(base + info.playArea.files.slope.file),
      fetchMask(base + info.playArea.files.coldMask.file),
    ]);
    const anchors = tuning.cold.zones.map((z) => zoneAnchor(info, z)).filter((p): p is Point => p !== null);
    const cold = coldZones(psr.data, psr.n, info.playArea.pixel_m, anchors, tuning.cold.zoneSearchRadiusM);
    return new TerrainMasks(info, slope.data, cold);
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
