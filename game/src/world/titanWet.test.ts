import { describe, expect, it } from 'vitest';
import titanTuning from '../../data/titan/tuning.json';
import type { TitanLookTuning } from '../rules/titanTypes';
import { stepWetness } from './titanWet';

const wet = (titanTuning.look as unknown as TitanLookTuning).wet!;
const run = (w: number, rain: number, seconds: number) => {
  for (let s = 0; s < seconds; s += 0.1) w = stepWetness(w, rain, 0.1, wet);
  return w;
};

describe('titan wet ground', () => {
  it('wets within seconds of full rain', () => {
    expect(run(0, 1, 20)).toBeGreaterThan(0.9);
    expect(run(0, 0.5, 60)).toBeLessThanOrEqual(0.5);
  });

  it('dries over a few minutes after the rain', () => {
    expect(run(1, 0, 60)).toBeGreaterThan(0.5);
    expect(run(1, 0, 120)).toBeGreaterThan(0.2);
    expect(run(1, 0, 120)).toBeLessThan(0.5);
    expect(run(1, 0, wet.dryS + 1)).toBe(0);
  });

  it('a big jump in mission time dries it at once, and time never runs backward', () => {
    expect(stepWetness(1, 0, 1000, wet)).toBe(0);
    expect(stepWetness(0.6, 0, -5, wet)).toBe(0.6);
    expect(stepWetness(0.6, 0.3, 1000, wet)).toBe(0.3);
  });
});
