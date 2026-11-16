// Boulder positions in the rocky areas (small fresh craters in terrain.json). Deterministic, so the
// world (world/boulders.ts) draws the same boulders the instruments find. Pure.
import type { Tuning } from './types';
import { seededRng } from './events';
import type { SoftArea } from './ground';

export interface Boulder {
  x: number;
  z: number;
  radius: number;
  site?: string; // the sites.json id it belongs to, which picks its rock suite (absent: the fallback rock list)
}

/** Deterministic boulder positions and sizes: small ones common, large ones rare. */
export function scatterBoulders(areas: SoftArea[], b: Tuning['boulders']): Boulder[] {
  const rng = seededRng(b.seed);
  const list: Boulder[] = [];
  for (const a of areas) {
    const spread = a.radiusM * b.spreadRadiusFactor;
    for (let i = 0; i < b.perRockyArea; i++) {
      const r = spread * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const size = b.minDiameterM * (b.maxDiameterM / b.minDiameterM) ** (rng() ** 3);
      list.push({ x: a.x + r * Math.cos(th), z: a.z + r * Math.sin(th), radius: size / 2 });
    }
  }
  return list;
}
