import { describe, expect, it } from 'vitest';
import { driveSpeed, driveStats, gameSpeed, massEnergyFactor, roverParams } from './drive';
import { testTuning } from './testData';
import type { Part } from './types';

const mass = testTuning.mass;
const k = testTuning.speed.compression;

const parts: Part[] = [
  { id: 'c', slot: 'chassis', name: 'c', description: '', cost: 0, mass: 50, size: 1, effects: { maxLoad: 90 } },
  { id: 'w', slot: 'wheels', name: 'w', description: '', cost: 0, mass: 20, size: 1, effects: { baseSpeed: 3, grip: 0.7, energyPerMeter: 0.02 } },
  { id: 'p', slot: 'power', name: 'p', description: '', cost: 0, mass: 0, size: 1, effects: { energyIncome: 1.5 } },
  { id: 'b', slot: 'battery', name: 'b', description: '', cost: 0, mass: 0, size: 1, effects: { batteryCapacity: 300 } },
];

describe('drive', () => {
  it('keeps the base speed at or below the reference mass', () => {
    expect(driveSpeed(3, mass.referenceMass, mass)).toBe(3);
    expect(driveSpeed(3, mass.referenceMass - 20, mass)).toBe(3);
  });

  it('makes a heavier rover slower, down to a floor', () => {
    expect(driveSpeed(3, 80, mass)).toBeLessThan(driveSpeed(3, 70, mass));
    expect(driveSpeed(3, 10_000, mass)).toBeCloseTo(3 * mass.minSpeedFactor, 9);
  });

  it('compresses speed like time', () => {
    expect(gameSpeed(3, testTuning.speed)).toBe(3 * k);
    expect(gameSpeed(0, testTuning.speed)).toBe(0);
  });

  it('reads mass, compressed speed and grip from the parts', () => {
    const p = roverParams(parts, testTuning);
    expect(p.massKg).toBe(70);
    expect(p.grip).toBe(0.7);
    expect(p.topSpeed).toBeCloseTo(3 * (1 - mass.speedLossPerKg * 10) * k, 9);
  });

  it('adds energy per meter only above the reference mass', () => {
    expect(massEnergyFactor(mass.referenceMass - 10, mass)).toBe(1);
    expect(massEnergyFactor(mass.referenceMass + 10, mass)).toBeCloseTo(1 + 10 * mass.energyGainPerKg, 9);
  });

  it('derives the driving stats the design screen shows', () => {
    const s = driveStats(parts, testTuning);
    expect(s.topSpeed).toBeCloseTo(s.realTopSpeed * k, 9);
    expect(s.realTopSpeed).toBeCloseTo(driveSpeed(3, 70, mass), 9);
    expect(s.energyPerMeter).toBeCloseTo(0.02 * (1 + 10 * mass.energyGainPerKg), 9);
    expect(s.batteryCapacity).toBe(300);
    expect(s.energyIncome).toBe(1.5);
  });
});
