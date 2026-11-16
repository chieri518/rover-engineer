// titan-fx: ground. The pebble scatter is deterministic, stays off soft sand, and thins away from the landing.
import { describe, expect, it } from 'vitest';
import titanTuning from '../../data/titan/tuning.json';
import type { TitanPebbleTuning } from '../rules/titanTypes';
import { scatterPebbles } from './titanPebbleScatter';

const t = (titanTuning.look as unknown as { pebbles: TitanPebbleTuning }).pebbles;
const landing = { x: -1280, z: -1050 };
const firm = () => 0;

describe('Titan ice pebbles', () => {
  it('are the same pebbles whatever the center they are built around', () => {
    const a = scatterPebbles(landing.x, landing.z, landing, firm, t);
    const b = scatterPebbles(landing.x + 1.5, landing.z - 1, landing, firm, t);
    const key = (p: { x: number; z: number; width: number }) => `${p.x.toFixed(4)},${p.z.toFixed(4)},${p.width.toFixed(5)}`;
    const inB = new Set(b.map(key));
    // Every pebble well inside both circles is in both lists.
    const inner = t.edgeFadeShare * t.drawRadiusM;
    const shared = a.filter((p) => Math.hypot(p.x - landing.x, p.z - landing.z) < inner - 2);
    expect(shared.length).toBeGreaterThan(500);
    for (const p of shared) expect(inB.has(key(p))).toBe(true);
  });

  it('lie within the draw radius, sized 5 to 15 cm, and stay under the instance cap', () => {
    const list = scatterPebbles(landing.x, landing.z, landing, firm, t);
    expect(list.length).toBeLessThanOrEqual(t.maxInstances);
    for (const p of list) {
      expect(Math.hypot(p.x - landing.x, p.z - landing.z)).toBeLessThanOrEqual(t.drawRadiusM);
      expect(p.width).toBeGreaterThanOrEqual(0.05);
      expect(p.width).toBeLessThanOrEqual(0.15);
      expect(p.height).toBeLessThan(p.width);
    }
  });

  it('are densest at the landing and thin with distance', () => {
    const near = scatterPebbles(landing.x, landing.z, landing, firm, t).length;
    const far = scatterPebbles(landing.x + 600, landing.z, landing, firm, t).length;
    expect(near).toBeGreaterThan(3 * far);
    expect(far).toBeGreaterThan(0);
  });

  it('none lie on soft dune sand', () => {
    expect(scatterPebbles(landing.x, landing.z, landing, () => t.softHigh, t)).toHaveLength(0);
    const half = scatterPebbles(landing.x, landing.z, landing, (x) => (x > landing.x ? 0.9 : 0), t);
    expect(half.every((p) => p.x <= landing.x)).toBe(true);
  });
});
