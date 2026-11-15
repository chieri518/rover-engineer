import { describe, expect, it } from 'vitest';
import { driveSpeed, roverParams } from './drive';
import { testTuning } from './testData';
import type { Part } from './types';

const mass = testTuning.mass;

describe('drive', () => {
  it('keeps the base speed at or below the reference mass', () => {
    expect(driveSpeed(3, mass.referenceMass, mass)).toBe(3);
    expect(driveSpeed(3, mass.referenceMass - 20, mass)).toBe(3);
  });

  it('makes a heavier rover slower, down to a floor', () => {
    expect(driveSpeed(3, 80, mass)).toBeLessThan(driveSpeed(3, 70, mass));
    expect(driveSpeed(3, 10_000, mass)).toBeCloseTo(3 * mass.minSpeedFactor, 9);
  });

  it('reads mass, speed and grip from the parts', () => {
    const parts: Part[] = [
      { id: 'c', slot: 'chassis', name: 'c', description: '', cost: 0, mass: 50, size: 1, effects: {} },
      { id: 'w', slot: 'wheels', name: 'w', description: '', cost: 0, mass: 20, size: 1, effects: { baseSpeed: 3, grip: 0.7 } },
    ];
    const p = roverParams(parts, testTuning);
    expect(p.massKg).toBe(70);
    expect(p.grip).toBe(0.7);
    expect(p.topSpeed).toBeCloseTo(3 * (1 - mass.speedLossPerKg * 10), 9);
  });
});
