// titan-fx: ground. Where the Huygens-like ice pebbles lie around a point: pure and deterministic (no three),
// so the scene (titanPebbles.ts) can rebuild the field around the rover and get the same pebbles back.
// Each square cell of the ground has its own seeded candidates; a candidate is kept with probability
// density / peak density, where the density is highest at the landing (Huygens landed on a pebble-strewn
// plain) and none on soft dune sand. Numbers in data/titan/tuning.json `look.pebbles`.
import { seededRng } from '../rules/events';
import type { TitanPebbleTuning } from '../rules/titanTypes';

export interface Pebble {
  x: number;
  z: number;
  /** Width across (m) and height (m). */
  width: number;
  height: number;
  /** Rotation about the vertical (rad), small tilt (rad) and the tilt's direction (rad). */
  yaw: number;
  tilt: number;
  tiltDir: number;
  /** Width along its other horizontal axis, as a share of `width` (pebbles are not perfectly round). */
  aspect: number;
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Pebbles per m² at (x, z), before the softness gate. */
export function pebbleDensity(x: number, z: number, landing: { x: number; z: number }, t: TitanPebbleTuning): number {
  const d = Math.hypot(x - landing.x, z - landing.z) / t.landingFalloffM;
  return t.farPerM2 + (t.landingPerM2 - t.farPerM2) * Math.exp(-d * d);
}

function cellSeed(seed: number, ix: number, iz: number): number {
  return (seed ^ Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) >>> 0;
}

/**
 * The pebbles within t.drawRadiusM of (cx, cz), at most t.maxInstances. `softnessAt` gives ground softness 0..1.
 * A pebble's shape and place depend only on its cell and index, never on the center; the center only decides
 * which are drawn (all of them within edgeFadeShare × drawRadiusM, fewer toward the edge).
 */
export function scatterPebbles(
  cx: number,
  cz: number,
  landing: { x: number; z: number },
  softnessAt: (x: number, z: number) => number,
  t: TitanPebbleTuning,
): Pebble[] {
  const out: Pebble[] = [];
  const c = t.cellM;
  const r = t.drawRadiusM;
  const peak = Math.max(t.landingPerM2, t.farPerM2);
  const perCell = Math.ceil(peak * c * c);
  const x0 = Math.floor((cx - r) / c);
  const x1 = Math.floor((cx + r) / c);
  const z0 = Math.floor((cz - r) / c);
  const z1 = Math.floor((cz + r) / c);
  for (let iz = z0; iz <= z1; iz++) {
    for (let ix = x0; ix <= x1; ix++) {
      // Skip cells wholly outside the radius.
      const nx = Math.min(Math.max(cx, ix * c), (ix + 1) * c);
      const nz = Math.min(Math.max(cz, iz * c), (iz + 1) * c);
      if ((nx - cx) ** 2 + (nz - cz) ** 2 > r * r) continue;
      const rng = seededRng(cellSeed(t.seed, ix, iz));
      for (let k = 0; k < perCell; k++) {
        // Draw every value first, so a candidate's shape never depends on whether earlier ones were kept.
        const x = (ix + rng()) * c;
        const z = (iz + rng()) * c;
        const keep = rng();
        const u = rng();
        const hs = rng();
        const yaw = rng() * Math.PI * 2;
        const tilt = rng() * 0.25;
        const tiltDir = rng() * Math.PI * 2;
        const aspect = 0.75 + 0.25 * rng();
        const d = Math.hypot(x - cx, z - cz);
        if (d > r) continue;
        // Thinning toward the edge: a pebble fades in as the rover approaches, with no ring at the radius.
        const edge = 1 - smoothstep(t.edgeFadeShare * r, r, d);
        const density = pebbleDensity(x, z, landing, t) * edge * (1 - smoothstep(t.softLow, t.softHigh, softnessAt(x, z)));
        if (keep * peak >= density) continue;
        const width = t.sizeMinM + (t.sizeMaxM - t.sizeMinM) * Math.pow(u, t.sizePower);
        const height = width * (t.heightShareMin + (t.heightShareMax - t.heightShareMin) * hs);
        out.push({ x, z, width, height, yaw, tilt, tiltDir, aspect });
        if (out.length >= t.maxInstances) return out;
      }
    }
  }
  return out;
}
