// Energy, damage, cold, soft ground, events and the explored map.
import { describe, expect, it } from 'vitest';
import { testEvents, testTuning as t } from './testData';
import { driveEnergy, flatRangeM, solarIncome } from './energy';
import { impactDamage, overloadDamage, steepSlopeDamage, tiltDeg } from './damage';
import { freezeRate, noLightsLookaheadM, secondsToFreeze, stepFreeze } from './cold';
import { sinkageCm, softGroundRating, softnessAt, stepDig, wheelSlip } from './ground';
import { flareProtected, formatFlareDate, scheduleEvents, seededRng } from './events';
import { createExplored, exploredShare, reveal } from './explore';

describe('energy', () => {
  it('charges per meter, more when climbing, flat rate downhill', () => {
    expect(driveEnergy(100, 0, 0.2, t.energy)).toBeCloseTo(20, 9);
    expect(driveEnergy(100, 10, 0.2, t.energy)).toBeCloseTo(20 * (1 + 10 * t.energy.slopeEnergyFactor), 9);
    expect(driveEnergy(100, -10, 0.2, t.energy)).toBeCloseTo(20, 9);
    expect(driveEnergy(-5, 0, 0.2, t.energy)).toBe(0);
  });

  it('earns solar income in proportion to sunlight, none in shadow', () => {
    expect(solarIncome(2, 1, 0.5)).toBe(1);
    expect(solarIncome(2, 0.25, 1)).toBe(0.5);
    expect(solarIncome(2, 0, 10)).toBe(0);
    expect(solarIncome(2, 3, 1)).toBe(2);
  });

  it('gives the flat range on a full battery', () => {
    expect(flatRangeM(400, 0.2)).toBe(2000);
    expect(flatRangeM(400, 0)).toBe(Infinity);
  });
});

describe('damage', () => {
  it('ignores small jolts and grows with impact speed', () => {
    expect(impactDamage(t.damage.impactMinMps - 0.1, t.damage)).toBe(0);
    expect(impactDamage(t.damage.impactMinMps, t.damage)).toBe(t.damage.rockHit);
    expect(impactDamage(t.damage.impactMinMps + 2, t.damage)).toBe(t.damage.rockHit + 2 * t.damage.impactPerMps);
  });

  it('damages only a driving rover on too-steep ground', () => {
    expect(steepSlopeDamage(25, true, 1, t)).toBe(t.damage.steepSlopePerSecond);
    expect(steepSlopeDamage(25, false, 1, t)).toBe(0);
    expect(steepSlopeDamage(t.ground.maxSlopeDegrees, true, 1, t)).toBe(0);
  });

  it('strains an overloaded frame per kg while driving', () => {
    expect(overloadDamage(0, true, 1, t.damage)).toBe(0);
    expect(overloadDamage(10, true, 2, t.damage)).toBeCloseTo(10 * 2 * t.damage.overloadPerKgSecond, 9);
    expect(overloadDamage(10, false, 2, t.damage)).toBe(0);
  });

  it('measures tilt from upright', () => {
    expect(tiltDeg(1)).toBe(0);
    expect(tiltDeg(0)).toBeCloseTo(90, 9);
    expect(tiltDeg(-1)).toBeCloseTo(180, 9);
  });
});

describe('cold', () => {
  it('freezes inside cold zones, slower with a heater, and recovers outside', () => {
    expect(freezeRate(true, 0, t.cold)).toBe(t.cold.freezeRatePerSecond);
    expect(freezeRate(true, 2, t.cold)).toBeCloseTo(t.cold.freezeRatePerSecond - 2 * t.cold.heaterReductionPerHeat, 9);
    expect(freezeRate(true, 100, t.cold)).toBe(0);
    expect(freezeRate(false, 0, t.cold)).toBe(-t.cold.warmRecoveryPerSecond);
  });

  it('clamps the meter between zero and the maximum', () => {
    expect(stepFreeze(0, false, 0, 10, t.cold)).toBe(0);
    expect(stepFreeze(90, true, 0, 10, t.cold)).toBe(t.cold.freezeMax);
  });

  it('a heater buys time in the cold', () => {
    expect(secondsToFreeze(0, t.cold)).toBe(25);
    expect(secondsToFreeze(2, t.cold)).toBe(100);
    expect(secondsToFreeze(100, t.cold)).toBe(Infinity);
  });

  it('a rover without lights looks ahead by its braking distance', () => {
    expect(noLightsLookaheadM(0, 4, t.cold)).toBe(t.cold.noLightsMarginM);
    expect(noLightsLookaheadM(-8, 4, t.cold)).toBe(t.cold.noLightsMarginM + 8);
  });
});

describe('soft ground', () => {
  const areas = [{ x: 0, z: 0, radiusM: 100 }];

  it('is soft inside a fresh crater, fading out past its radius', () => {
    expect(softnessAt(50, 0, areas, t.ground)).toBe(1);
    expect(softnessAt(125, 0, areas, t.ground)).toBeCloseTo(0.5, 9);
    expect(softnessAt(200, 0, areas, t.ground)).toBe(0);
    expect(softnessAt(0, 0, [], t.ground)).toBe(0);
  });

  it('sinks like the Apollo rover: about 1.5 cm on normal ground, 6 cm on soft rims, at reference mass and grip', () => {
    const g = t.ground.referenceGrip;
    expect(sinkageCm(0, t.mass.referenceMass, g, t)).toBeCloseTo(1.5, 9);
    expect(sinkageCm(1, t.mass.referenceMass, g, t)).toBeCloseTo(6, 9);
    expect(sinkageCm(1, t.mass.referenceMass * 1.5, g, t)).toBeCloseTo(9, 9);
    expect(sinkageCm(1, t.mass.referenceMass, g * 2, t)).toBeCloseTo(3, 9);
  });

  it("rates a build on soft ground from its sinkage at the reference softness: Good, Fair, Poor", () => {
    const r = t.ground.softGroundRating;
    const ref = t.mass.referenceMass;
    const g = t.ground.referenceGrip;
    // The reference rover (60 kg, solid-wheel grip) sinks 6 cm on the softest ground: Fair.
    expect(softGroundRating(ref, g, t)).toEqual({ rating: 'fair', sinkageCm: sinkageCm(r.referenceSoftness, ref, g, t) });
    expect(softGroundRating(ref, g, t).sinkageCm).toBeCloseTo(6, 9);
    // Lighter or grippier sinks less (Good); heavier sinks more (Poor). The thresholds are inclusive from below.
    expect(softGroundRating(ref * 0.7, 0.95, t).rating).toBe('good');
    expect(softGroundRating(ref * 1.5, g, t).rating).toBe('poor');
    const massAt = (cm: number) => (cm / 6) * ref; // at reference grip, sinkage is 6 cm x mass / reference mass
    expect(softGroundRating(massAt(r.fairFromCm) - 0.01, g, t).rating).toBe('good');
    expect(softGroundRating(massAt(r.fairFromCm) + 0.01, g, t).rating).toBe('fair');
    expect(softGroundRating(massAt(r.poorFromCm) - 0.01, g, t).rating).toBe('fair');
    expect(softGroundRating(massAt(r.poorFromCm) + 0.01, g, t).rating).toBe('poor');
    // Poor starts just under the dig-in limit on flat soft ground.
    expect(r.poorFromCm * t.ground.slipPerSinkageCm).toBeLessThanOrEqual(t.ground.slipLimit);
    expect(r.poorFromCm * t.ground.slipPerSinkageCm).toBeGreaterThan(t.ground.slipLimit * 0.9);
  });

  it('slips more with soft ground, mass, weak wheels and steep climbs', () => {
    const ref = t.mass.referenceMass;
    const base = wheelSlip(0, ref, 0.55, 0, t);
    expect(base).toBeLessThan(t.ground.slipLimit);
    expect(wheelSlip(1, ref, 0.55, 0, t)).toBeGreaterThan(base);
    expect(wheelSlip(1, ref * 1.5, 0.55, 0, t)).toBeGreaterThan(t.ground.slipLimit); // heavy on a soft rim digs in
    expect(wheelSlip(1, ref * 0.8, 0.8, 0, t)).toBeLessThan(t.ground.slipLimit); // light with good wheels does not
    expect(wheelSlip(0, ref, 0.55, t.ground.slopeSlipFreeDeg, t)).toBeCloseTo(base, 9);
    expect(wheelSlip(0, ref, 0.55, 20, t)).toBeCloseTo(base + 10 * t.ground.slipPerUphillDeg, 9);
  });

  it('digs in only while throttling above the slip limit; full after stuckSeconds', () => {
    let dig = 0;
    for (let i = 0; i < 10; i++) dig = stepDig(dig, 0.3, true, t.ground.stuckSeconds / 10, t.ground);
    expect(dig).toBeCloseTo(1, 9);
    expect(stepDig(0.5, 0.3, false, 1, t.ground)).toBeCloseTo(0.5 - t.ground.digRecoveryPerSecond, 9);
    expect(stepDig(0.5, 0.1, true, 1, t.ground)).toBeCloseTo(0.5 - t.ground.digRecoveryPerSecond, 9);
    expect(stepDig(0, 0.1, true, 1, t.ground)).toBe(0);
  });
});

describe('events', () => {
  it('schedules one event in each window, with the flare warning ahead of the hit', () => {
    const list = scheduleEvents(testEvents, seededRng(7));
    const flares = list.filter((e) => e.kind === 'flare');
    const quakes = list.filter((e) => e.kind === 'quake');
    expect(flares).toHaveLength(2);
    expect(quakes).toHaveLength(1);
    testEvents.flare.windowsSeconds.forEach(([a, b], i) => {
      expect(flares[i]!.at).toBeGreaterThanOrEqual(a);
      expect(flares[i]!.at).toBeLessThanOrEqual(b);
      expect(flares[i]!.at - flares[i]!.warningAt).toBeCloseTo(testEvents.flare.warningSeconds, 9);
    });
    expect(flares[0]!.kind === 'flare' && flares[1]!.kind === 'flare' && flares[0]!.flare.donkiId !== flares[1]!.flare.donkiId).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i]!.at).toBeGreaterThanOrEqual(list[i - 1]!.at);
  });

  it('is repeatable from a seed', () => {
    expect(scheduleEvents(testEvents, seededRng(3))).toEqual(scheduleEvents(testEvents, seededRng(3)));
  });

  it('protects a rover that is powered down or in shadow', () => {
    expect(flareProtected(true, 1, testEvents)).toBe(true);
    expect(flareProtected(false, 0, testEvents)).toBe(true);
    expect(flareProtected(false, 1, testEvents)).toBe(false);
  });

  it('formats the flare date for the warning', () => {
    expect(formatFlareDate('2017-09-06')).toBe('6 September 2017');
  });
});

describe('explored map', () => {
  it('reveals a disc once and reports the share', () => {
    const map = createExplored(1000, { cellM: 10, revealRadiusM: 50 });
    expect(map.n).toBe(100);
    const first = reveal(map, 0, 0, 50);
    expect(first).toBeGreaterThan(70); // about π × 5² cells
    expect(first).toBeLessThan(90);
    expect(reveal(map, 0, 0, 50)).toBe(0);
    expect(exploredShare(map)).toBeCloseTo(first / 10000, 9);
  });

  it('clips at the edge of the play area', () => {
    const map = createExplored(1000, { cellM: 10, revealRadiusM: 50 });
    const corner = reveal(map, 500, 500, 50);
    expect(corner).toBeGreaterThan(15);
    expect(corner).toBeLessThan(25);
  });
});
