// Sanity checks on the real data in game/data/. These encode the balance targets, not exact numbers.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { quoteBuild } from './quote';
import { cheapestBuild } from './rover';
import { meetsRequirements, selectedParts } from './rover';
import type { Build, GameData } from './types';
import terrain from '../../public/terrain/terrain.json';
import { missionSetup, startMission, stepMission, type MissionState } from './mission';
import { allBuilds as everyBuild, dominatedPairs, evaluateBuild, simulate } from './balance';
import { flareDamage } from './events';
import { validateGameData } from './validate';

const data: GameData = loadGameData();
const allBuilds = () => everyBuild(data);
const craterM = terrain.features.shadowedCrater.entryPoint.driveDistanceFromLanding_m;
/** A middle-of-the-road build used as a reference (the old default build). */
const reference: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
};

describe('game data', () => {
  it('passes validation', () => {
    expect(() => loadGameData()).not.toThrow();
  });

  it('validation catches a chassis without mounting points, an instrument part without an instrument, and an unknown zone', () => {
    const parts = data.parts.parts.map((p) =>
      p.id === 'chassis-steel' ? { ...p, effects: { maxLoad: 100 } } : p.id === 'instrument-drill' ? { ...p, effects: {} } : p);
    const milestones = data.milestones.milestones.map((m) =>
      m.id === 'crater-layers' ? { ...m, trigger: { type: 'photo' as const, zone: 'crater-wal' } } : m);
    expect(validateGameData({ ...data, parts: { ...data.parts, parts }, milestones: { milestones } })).toEqual([
      'chassis chassis-steel needs a whole number of mountingPoints',
      'instrument part instrument-drill has no instrument effect',
      'milestone crater-layers names unknown zone crater-wal',
      'milestone regolith-sample requires instrument drill, which no part provides',
      'milestone water-ice requires instrument drill, which no part provides',
    ]);
  });

  it('validation catches negative instrument costs and a cold slowdown below 1', () => {
    const parts = data.parts.parts.map((p) => (p.id === 'instrument-drill' ? { ...p, effects: { ...p.effects, energyPerUse: -1 } } : p));
    const tuning = { ...data.tuning, instruments: { ...data.tuning.instruments, coldSlowdown: 0.5 } };
    expect(validateGameData({ ...data, parts: { ...data.parts, parts }, tuning })).toEqual([
      'part instrument-drill has a negative or non-finite energyPerUse',
      'tuning.instruments.coldSlowdown must be at least 1 (the cold never speeds an instrument up)',
    ]);
  });

  it('validation: a switch has no use, hold or deploy; instrument effects only on instruments; numbers finite', () => {
    const parts = data.parts.parts.map((p) =>
      p.id === 'instrument-neutron' ? { ...p, effects: { ...p.effects, useSeconds: 2, deploy: true } }
      : p.id === 'heater-rhu' ? { ...p, effects: { ...p.effects, energyPerUse: 1 } }
      : p.id === 'instrument-xray' ? { ...p, effects: { ...p.effects, shadowHoldFactor: 2 } }
      : p.id === 'battery-nih2' ? { ...p, effects: { batteryCapacity: Infinity } }
      : p);
    const tuning = { ...data.tuning, instruments: { ...data.tuning.instruments, seismometer: { recordWindowSeconds: -1, quietDistanceM: NaN } } };
    expect(validateGameData({ ...data, parts: { ...data.parts, parts }, tuning })).toEqual([
      'part battery-nih2 has a negative or non-finite batteryCapacity',
      'part heater-rhu is not an instrument but has energyPerUse',
      'instrument part instrument-neutron has a standby draw, so it cannot also have useSeconds',
      'instrument part instrument-neutron has a standby draw, so it cannot also have deploy',
      'instrument part instrument-xray needs a shadowHoldFactor above 0 and at most 1',
      'tuning.instruments.seismometer.recordWindowSeconds must be a finite number, not negative',
      'tuning.instruments.seismometer.quietDistanceM must be a finite number, not negative',
    ]);
  });

  it('validation: deploy and the boulder and Earth checks need a held use (useSeconds above 0)', () => {
    const parts = data.parts.parts.map((p) =>
      p.id === 'instrument-seismometer' ? { ...p, effects: { ...p.effects, useSeconds: 0 } }
      : p.id === 'instrument-xray' ? { ...p, effects: { ...p.effects, useSeconds: undefined } }
      : p.id === 'instrument-camera' ? { ...p, effects: { ...p.effects, needsEarth: true } }
      : p);
    expect(validateGameData({ ...data, parts: { ...data.parts, parts } })).toEqual([
      'instrument part instrument-camera has needsEarth, so it needs useSeconds above 0',
      'instrument part instrument-xray has needsBoulder, so it needs useSeconds above 0',
      'instrument part instrument-seismometer has deploy, so it needs useSeconds above 0',
    ]);
  });

  it('instrument operating costs: the drill uses 10 energy per sample and holds 3 s; the camera is free and instant', () => {
    const effects = (id: string) => data.parts.parts.find((p) => p.id === id)!.effects;
    expect(effects('instrument-drill')).toMatchObject({ energyPerUse: 10, useSeconds: 3 });
    expect(effects('instrument-camera').energyPerUse ?? 0).toBe(0);
    expect(effects('instrument-camera').useSeconds ?? 0).toBe(0);
    expect(data.parts.parts.filter((p) => (p.effects.standbyEnergy ?? 0) > 0).map((p) => p.id)).toEqual(['instrument-neutron']);
  });

  it('the four new Moon instruments: neutron spectrometer a switch, X-ray a held reading, two stations that deploy', () => {
    const part = (id: string) => data.parts.parts.find((p) => p.id === id)!;
    expect(part('instrument-neutron')).toMatchObject({ cost: 80, mass: 4, size: 2, effects: { standbyEnergy: 0.1 } });
    expect(part('instrument-xray')).toMatchObject({ cost: 60, mass: 2, size: 1, effects: { energyPerUse: 3, useSeconds: 4, needsBoulder: true, coldTolerant: true } });
    expect(part('instrument-seismometer')).toMatchObject({ cost: 70, mass: 4, size: 2, effects: { useSeconds: 3, deploy: true } });
    expect(part('instrument-reflector')).toMatchObject({ cost: 30, mass: 3, size: 1, effects: { useSeconds: 3, deploy: true, needsEarth: true } });
  });

  it('has 6 bus slots with 2 options each, 3 tiers and 13 milestones', () => {
    expect(data.parts.slots).toEqual(['chassis', 'wheels', 'power', 'battery', 'lights', 'heater']);
    for (const slot of data.parts.slots) expect(data.parts.parts.filter((p) => p.slot === slot)).toHaveLength(2);
    expect(data.tiers.tiers.map((t) => t.name)).toEqual(['Small', 'Medium', 'Large']);
    expect(data.milestones.milestones).toHaveLength(13);
  });

  it('in the air the rover falls at the time-lapse gravity (speed compression squared), on the ground at less', () => {
    const { rover, speed } = data.tuning;
    expect(rover.airGravityScale).toBe(speed.compression ** 2);
    expect(rover.gravityScale).toBeLessThan(rover.airGravityScale);
  });

  it('offers the six Moon instruments', () => {
    const instruments = data.parts.parts.filter((p) => p.slot === 'instrument').map((p) => p.effects.instrument);
    expect(instruments.sort()).toEqual(['camera', 'drill', 'neutron', 'reflector', 'seismometer', 'xray']);
  });

  it('the chassis sets the payload bay: steel 3 mounting points, titanium 2', () => {
    const points = (id: string) => data.parts.parts.find((p) => p.id === id)!.effects.mountingPoints;
    expect(points('chassis-steel')).toBe(3);
    expect(points('chassis-titanium')).toBe(2);
  });

  it('every bay that fits is enumerated: 64 bus builds; steel takes up to 3 of the 6 instruments (42 bays), titanium up to 2 (22)', () => {
    const builds = allBuilds();
    expect(builds).toHaveLength(32 * 42 + 32 * 22);
    expect(builds.filter((b) => b.payload.length === 2 && b.chassis === 'chassis-titanium').length).toBe(32 * 15);
    expect(builds.some((b) => b.payload.length === 3 && b.chassis === 'chassis-titanium')).toBe(false);
  });

  it('a mid build fits the Medium tier and is affordable from the starting budget', () => {
    const mid: Build = {
      chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
      lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
    };
    const q = quoteBuild(mid, data, data.tuning.budget.startingBudget);
    expect(q.tier?.id).toBe('medium');
    expect(q.canAfford).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it('every tier is used by some build, and the starting budget cannot buy the best of everything', () => {
    const quotes = allBuilds().map((b) => quoteBuild(b, data, data.tuning.budget.startingBudget));
    for (const tier of data.tiers.tiers) expect(quotes.some((q) => q.tier?.id === tier.id)).toBe(true);
    expect(quotes.some((q) => q.canLaunch && !q.canAfford)).toBe(true);
  });

  it('the top tier is a real limit: the bulkiest builds cannot launch', () => {
    const quotes = allBuilds().map((b) => quoteBuild(b, data, data.tuning.budget.startingBudget));
    expect(quotes.some((q) => !q.canLaunch)).toBe(true);
    // Most builds can launch; full steel bays with the bulky drill and wheels are the ones that cannot.
    expect(quotes.filter((q) => q.canLaunch).length).toBeGreaterThan(quotes.length * 0.85);
  });

  it('the Moon minimum budget is enough to buy at least one launchable rover', () => {
    const min = data.tuning.budget.minimumBudget.moon;
    const quotes = allBuilds().map((b) => quoteBuild(b, data, min));
    expect(quotes.some((q) => q.canLaunch && q.canAfford)).toBe(true);
  });

  it('the starting budget is above the Moon minimum, and the cheapest build can launch', () => {
    expect(data.tuning.budget.startingBudget).toBeGreaterThanOrEqual(data.tuning.budget.minimumBudget.moon);
    expect(quoteBuild(cheapestBuild(data.parts), data, data.tuning.budget.startingBudget).canLaunch).toBe(true);
  });

  it('the reference build fits exactly the Medium ticket, is affordable and not overloaded', () => {
    const q = quoteBuild(reference, data, data.tuning.budget.startingBudget);
    expect(q.tier?.id).toBe('medium');
    expect(q.canAfford).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it('cheap parts are heavy, light parts are expensive: in every slot with two real parts, the cheaper one is heavier', () => {
    for (const slot of ['chassis', 'wheels', 'power', 'battery'] as const) {
      const [a, b] = data.parts.parts.filter((p) => p.slot === slot).sort((x, y) => x.cost - y.cost);
      expect(a!.cost, slot).toBeLessThan(b!.cost);
      expect(a!.mass, slot).toBeGreaterThan(b!.mass);
    }
  });

  it('no build dominates another: a better build always costs more (ticket included)', () => {
    const pairs = dominatedPairs(allBuilds().map((b) => evaluateBuild(b, data)));
    expect(pairs.map(([a, b]) => `${a.label} (${a.total}) beats ${b.label} (${b.total})`)).toEqual([]);
  });

  it('tier jumps matter: several sensible builds sit just over a tier limit', () => {
    // Launchable, affordable, not overloaded, and within 3 kg or 1 size unit of the tier below.
    const tiers = data.tiers.tiers;
    const near = allBuilds()
      .map((b) => evaluateBuild(b, data))
      .filter((e) => {
        const i = tiers.findIndex((t) => t.name === e.tier);
        if (i < 1 || e.total > data.tuning.budget.startingBudget || e.overloadKg > 0) return false;
        const below = tiers[i - 1]!;
        return e.mass - below.massLimit <= 3 && e.size - below.sizeLimit <= 1;
      });
    expect(near.length).toBeGreaterThanOrEqual(5);
  });

  it('flare damage grows modestly with the flare class, and a protected rover takes none', () => {
    const flares = data.events.flare!.realFlares;
    const dmg = (cls: string) => flareDamage({ ...flares[0]!, class: cls }, data.events);
    expect(dmg('X1.0')).toBe(data.events.flare!.damage);
    expect(dmg('X9.0')).toBeGreaterThan(1.4 * dmg('X1.0'));
    expect(dmg('X9.0')).toBeLessThan(2.5 * dmg('X1.0'));
    expect(dmg('X9.3')).toBeGreaterThan(dmg('X3.3'));
    // The two worst real flares plus the moonquake do not destroy an otherwise undamaged rover.
    const worst = flares.map((f) => flareDamage(f, data.events)).sort((a, b) => b - a);
    expect(worst[0]! + worst[1]! + data.events.quake!.damage).toBeLessThan(data.tuning.damage.max);
    // Powered down in full sun, even the strongest flare does nothing.
    const strongest = [...flares].sort((a, b) => flareDamage(b, data.events) - flareDamage(a, data.events))[0]!;
    const setup = missionSetup(selectedParts(reference, data.parts), data.tuning, [
      { kind: 'flare', at: 1, warningAt: 0, flare: strongest },
    ]);
    const s = { ...startMission(setup), poweredDown: true };
    const step = stepMission(s, {
      dt: 2, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0,
      throttling: false, impactMps: 0, upY: 1,
    }, setup, data.tuning, data.events);
    expect(step.state.damageBy.flare).toBe(0);
    expect(step.state.flaresProtected).toBe(1);
  });

  it('death penalties are ordered energy < stuck < froze < destroyed', () => {
    const p = data.tuning.payout.deathPenalty;
    expect(p.energy).toBeLessThan(p.stuck);
    expect(p.stuck).toBeLessThan(p.froze);
    expect(p.froze).toBeLessThan(p.destroyed);
  });

  it('speed: a light build can just reach the dark crater in one mission, a heavy build cannot', () => {
    const seconds = data.tuning.mission.lengthSeconds;
    const dark = data.milestones.milestones.find((m) => m.id === 'into-the-dark')!;
    const quotes = allBuilds().map((b) => ({ b, q: quoteBuild(b, data, data.tuning.budget.startingBudget) }));
    const launchable = quotes.filter(({ q }) => q.canLaunch && q.canAfford);
    // Fastest build that can buy and is equipped for the dark crater (lights and heater).
    const crater = launchable.filter(({ b }) => meetsRequirements(selectedParts(b, data.parts), dark));
    const fastest = Math.max(...crater.map(({ q }) => q.drive.topSpeed));
    const slowest = Math.min(...launchable.map(({ q }) => q.drive.topSpeed));
    expect(fastest).toBeGreaterThanOrEqual(10);
    expect(fastest).toBeLessThanOrEqual(14);
    expect(slowest).toBeGreaterThanOrEqual(5);
    expect(slowest).toBeLessThanOrEqual(7.5);
    // Top speed for the whole mission, with room for slopes, turns and stops.
    expect(fastest * seconds).toBeGreaterThan(craterM * 1.1);
    expect(slowest * seconds).toBeLessThan(craterM * 0.75);
  });

  // Drive flat out at top speed for the whole mission with a given share of sunlight.
  function nonstop(build: Build, sunlight: number, uphillDeg = 0): MissionState {
    const parts = selectedParts(build, data.parts);
    const setup = missionSetup(parts, data.tuning, []);
    let s = startMission(setup);
    const dt = 0.5;
    while (!s.end) {
      const v = setup.stats.topSpeed;
      s = stepMission(s, {
        dt, distanceM: v * dt, speedMps: v, uphillDeg, slopeDeg: 5, sunlight, inColdZone: false, softness: 0,
        throttling: true, impactMps: 0, upY: 1,
      }, setup, data.tuning, data.events).state;
    }
    return s;
  }

  it('energy: driving nonstop in full sun slowly drains the reference build; a solar mast about breaks even', () => {
    const d = reference;
    const capacity = quoteBuild(d, data, 0).drive.batteryCapacity;
    const sun = nonstop(d, 1);
    expect(sun.end?.survived).toBe(true);
    expect(sun.energy).toBeGreaterThan(0.05 * capacity);
    expect(sun.energy).toBeLessThan(0.5 * capacity);
    const mast = evaluateBuild({ ...d, power: 'power-solar-mast' }, data);
    expect(Math.abs(mast.income - mast.driveDrain)).toBeLessThan(0.3);
  });

  it('energy: careless play runs out, careful play survives (reference build, half sunlight)', () => {
    const d = reference;
    const careless = simulate(d, data, { sunlight: 0.5, driveShare: 1 });
    expect(careless.end.cause).toBe('energy');
    expect(careless.end.seconds).toBeGreaterThan(200);
    const careful = simulate(d, data, { sunlight: 0.5, driveShare: 0.7 });
    expect(careful.end.survived).toBe(true);
    const dark = nonstop(d, 0);
    expect(dark.end?.cause).toBe('energy');
    expect(dark.end!.seconds).toBeLessThan(200);
  });

  it('energy: the dark crater dash needs a big battery or a solar mast', () => {
    // Fast crater-equipped builds (entry before ~265 s): drive there in mostly sun, then into the shadow.
    const dark = data.milestones.milestones.find((m) => m.id === 'into-the-dark')!;
    const fast = allBuilds()
      .filter((b) => meetsRequirements(selectedParts(b, data.parts), dark))
      .map((b) => evaluateBuild(b, data))
      .filter((e) => e.tier !== null && craterM / e.topSpeed < 265);
    const dash = (b: Build) => simulate(b, data, { sunlight: (m) => (m < craterM ? 0.8 : 0), driveShare: 1 });
    const plain = fast.filter((e) => e.build.battery === 'battery-li-ion' && e.build.power === 'power-fixed-panel');
    const invested = fast.filter((e) => e.build.battery === 'battery-nih2' || e.build.power === 'power-solar-mast');
    expect(plain.length).toBeGreaterThan(0);
    expect(invested.length).toBeGreaterThan(0);
    for (const e of plain) expect(dash(e.build).end.cause).toBe('energy');
    for (const e of invested) expect(dash(e.build).end.survived).toBe(true);
  });

  it('energy: climbing all mission long in little sunlight drains the cheapest build', () => {
    const s = nonstop(cheapestBuild(data.parts), 0.25, 5);
    expect(s.end?.cause).toBe('energy');
  });
});
