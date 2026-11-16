// Boulder positions in the rocky areas (small fresh craters in terrain.json). Deterministic, so the
// world (world/boulders.ts) draws the same boulders the instruments find. Pure.
import type { Tuning } from './types';
import { seededRng } from './events';
import type { SoftArea } from './ground';
import type { ResolvedSite } from './sites';

export interface Boulder {
  x: number;
  z: number;
  radius: number;
  site?: string; // the sites.json id it belongs to, which picks its rock suite (absent: the fallback rock list)
  rolled?: boolean; // the one rolled boulder
}

/** Deterministic boulder positions and sizes: small ones common, large ones rare. */
export function scatterBoulders(areas: (SoftArea & { site?: string })[], b: Tuning['boulders']): Boulder[] {
  const rng = seededRng(b.seed);
  const list: Boulder[] = [];
  for (const a of areas) {
    const spread = a.radiusM * b.spreadRadiusFactor;
    for (let i = 0; i < b.perRockyArea; i++) {
      const r = spread * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const size = b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
      list.push({ x: a.x + r * Math.cos(th), z: a.z + r * Math.sin(th), radius: size / 2, ...(a.site ? { site: a.site } : {}) });
    }
  }
  return list;
}

/**
 * Boulders at the Moon's young craters and the rolled boulder (sites.json). Its own random stream, so
 * the rocky-area boulders from scatterBoulders keep their places. Rocky areas are not included here.
 */
export function scatterSiteBoulders(sites: readonly ResolvedSite[], b: Tuning['boulders']): Boulder[] {
  const rng = seededRng(b.seed + 1);
  const list: Boulder[] = [];
  for (const s of sites) {
    if (s.kind === 'young-crater' && s.radiusM !== undefined) {
      const spread = s.radiusM * b.spreadRadiusFactor;
      for (let i = 0; i < b.perYoungCrater; i++) {
        const r = spread * Math.sqrt(rng());
        const th = rng() * Math.PI * 2;
        const size = b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
        list.push({ x: s.center.x + r * Math.cos(th), z: s.center.z + r * Math.sin(th), radius: size / 2, site: s.id });
      }
    } else if (s.kind === 'rolled-boulder') {
      list.push({ x: s.center.x, z: s.center.z, radius: b.rolledBoulderDiameterM / 2, site: s.id, rolled: true });
    }
  }
  return list;
}
