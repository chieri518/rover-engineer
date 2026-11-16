import { describe, expect, it } from 'vitest';
import titanTuning from '../../data/titan/tuning.json';
import type { TitanLookTuning } from '../rules/titanTypes';
import { beamStrength, lampMounts } from './titanBeams';

const t = (titanTuning.look as unknown as TitanLookTuning).beams!;

describe('titan beams (titan-fx: beams)', () => {
  it('are off by day and full at night', () => {
    expect(beamStrength(40, 0, t)).toBeCloseTo(t.dayStrength);
    expect(beamStrength(-20, 0, t)).toBeCloseTo(1);
  });

  it('show at dusk when the lights come on, weaker than at night', () => {
    const dusk = beamStrength(0, 0, t);
    expect(dusk).toBeGreaterThan(0.2);
    expect(dusk).toBeLessThan(1);
  });

  it('grow stronger in rain', () => {
    expect(beamStrength(-20, 1, t)).toBeCloseTo(1 + t.rainBoost);
    expect(beamStrength(-20, 0.5, t)).toBeGreaterThan(beamStrength(-20, 0, t));
  });

  it('start at the front face of the two lamp housings', () => {
    const [a, b] = lampMounts({ lengthM: 1.8, widthM: 1.3, heightM: 0.45 });
    expect(a!.x).toBeCloseTo(0.93); // 1.8 / 2 - 0.02 + 0.05
    expect(a!.z).toBeCloseTo(-b!.z);
  });
});
