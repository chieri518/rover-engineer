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
import { siteTerrainProblems, validateGameData } from './validate';
import { earnsMilestones } from './payload';
import { milestoneStages } from './payout';
import { worldGameData } from '../gameData';
import type { Milestone, SiteSpec } from './types';

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
      'milestone fresh-ejecta-sample requires instrument drill, which no part provides',
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

  it('has 6 bus slots with 2 options each, 3 tiers and 25 milestones', () => {
    expect(data.parts.slots).toEqual(['chassis', 'wheels', 'power', 'battery', 'lights', 'heater']);
    for (const slot of data.parts.slots) expect(data.parts.parts.filter((p) => p.slot === slot)).toHaveLength(2);
    expect(data.tiers.tiers.map((t) => t.name)).toEqual(['Small', 'Medium', 'Large']);
    expect(data.milestones.milestones).toHaveLength(25);
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

describe('Moon sites and milestones data (Phase 2)', () => {
  const byId = (id: string) => data.milestones.milestones.find((m) => m.id === id)!;
  const NEW = [
    'cold-trap-survey', 'hidden-hydrogen', 'ice-deposit-located', 'rock-collection', 'rare-rock', 'boulder-track',
    'documented-sample', 'fresh-ejecta-sample', 'moonquake-record', 'clean-seismogram', 'laser-ranging-site', 'science-station',
  ];
  const withMilestone = (id: string, change: Partial<Milestone>): GameData => ({
    ...data,
    milestones: { milestones: data.milestones.milestones.map((m) => (m.id === id ? { ...m, ...change } : m)) },
  });
  const withSites = (sites: SiteSpec[]): GameData => ({ ...data, sites: { sites } });

  it('has the twelve new milestones with their starting rewards, each with a how-to line, fact and source', () => {
    const rewards = NEW.map((id) => [id, byId(id).money, byId(id).rp]);
    expect(rewards).toEqual([
      ['cold-trap-survey', 50, 8], ['hidden-hydrogen', 100, 20], ['ice-deposit-located', 200, 30], ['rock-collection', 40, 8],
      ['rare-rock', 100, 30], ['boulder-track', 40, 10], ['documented-sample', 40, 10], ['fresh-ejecta-sample', 50, 15],
      ['moonquake-record', 80, 20], ['clean-seismogram', 40, 10], ['laser-ranging-site', 50, 15], ['science-station', 50, 10],
    ]);
    expect(data.milestones.milestones.filter((m) => m.record).map((m) => m.id)).toEqual(['touchdown', 'water-ice', 'rare-rock', 'science-station']);
    for (const m of data.milestones.milestones) expect(m.howTo?.length, m.id).toBeGreaterThan(0);
  });

  it('every Moon instrument now earns a milestone, so the desk card line "earns no milestones yet" goes away', () => {
    for (const inst of ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'] as const) {
      expect(earnsMilestones(inst, data.milestones), inst).toBe(true);
    }
  });

  it('combos need every listed instrument: Documented sample needs the camera and the X-ray spectrometer', () => {
    const doc = byId('documented-sample');
    const parts = (payload: string[]) => selectedParts({ ...reference, payload }, data.parts);
    expect(meetsRequirements(parts(['instrument-camera', 'instrument-xray']), doc)).toBe(true);
    expect(meetsRequirements(parts(['instrument-camera']), doc)).toBe(false);
    expect(meetsRequirements(parts(['instrument-xray']), doc)).toBe(false);
    expect(meetsRequirements(parts(['instrument-seismometer', 'instrument-reflector']), byId('science-station'))).toBe(true);
    expect(meetsRequirements(parts(['instrument-reflector']), byId('science-station'))).toBe(false);
  });

  it('staged counts: Cold trap survey has 3 stages (one per cold trap), Rock collection 3 (2, 3 and 4 types)', () => {
    expect(milestoneStages(byId('cold-trap-survey'))).toBe(3);
    expect(milestoneStages(byId('rock-collection'))).toBe(3);
    expect(milestoneStages(byId('hidden-hydrogen'))).toBe(1);
  });

  it('rock suites: five rock types in all, two per site, and magnesian norite only at the rolled boulder', () => {
    const suites = data.tuning.instruments.xray.suites;
    expect(new Set(suites.flatMap((s) => s.rocks.map((r) => r.id))).size).toBe(5);
    for (const s of suites) expect(s.rocks.length, s.id).toBe(s.id === 'rolled-boulder' ? 1 : 2);
    expect(suites.filter((s) => s.rocks.some((r) => r.id === 'magnesian-norite')).map((s) => s.id)).toEqual(['rolled-boulder']);
    const rare = data.sites.sites.filter((s) => s.rockSuite === 'rolled-boulder');
    expect(rare.map((s) => s.kind)).toEqual(['rolled-boulder']);
  });

  it('the hidden hydrogen zone reads 40 to 50%, above the cold traps; the ice signal zone is about 90 m around the spot', () => {
    const n = data.tuning.instruments.neutron;
    expect(n.anomalyEdge).toBeGreaterThanOrEqual(0.4);
    expect(n.anomalyPeak).toBeLessThanOrEqual(0.5);
    expect(n.anomalyEdge).toBeGreaterThan(n.coldBackground);
    expect((1 - n.iceSignalShare) * n.iceRangeM).toBeCloseTo(90, 0);
    // The Phase 0 values (45% falling to the noise floor at 80 m) read about 15% at the 60 m edge: validation says so.
    const phase0 = { ...data.tuning, instruments: { ...data.tuning.instruments, neutron: { ...n, anomalyPeak: 0.45, anomalyEdge: 0.15, anomalyRangeM: 80 } } };
    expect(validateGameData({ ...data, tuning: phase0 })).toEqual([
      'tuning.instruments.neutron.anomalyEdge must be above coldBackground (the hidden spot reads higher than the cold traps)',
    ]);
  });

  it('no new milestone text names a lesson cause or fix (the spoiler guard)', () => {
    // The crater's own map name says "shadowed"; that names the place, not a lesson.
    const crater = data.text.survey.shadowedCraterName.toLowerCase();
    for (const id of NEW) {
      const m = byId(id);
      const text = [m.name, m.summary, m.howTo ?? ''].join(' ').toLowerCase().replaceAll(crater, '');
      for (const word of ['quiet', 'drive away', 'heater', 'shadow', 'light', 'temperature', 'far from']) expect(text, `${id}: ${word}`).not.toContain(word);
    }
  });

  it('validation catches broken instrument triggers: zones, instruments, photo targets, rock types and counts', () => {
    const broken = [
      withMilestone('cold-trap-survey', { trigger: { type: 'transect', instrument: 'neutron', zone: 'cold-trp', meters: 50, sites: 3 } }),
      withMilestone('hidden-hydrogen', { trigger: { type: 'transect', instrument: 'drill', zone: 'hydrogen-anomaly', meters: 0 } }),
      withMilestone('rare-rock', { trigger: { type: 'reading', instrument: 'xray', rock: 'mare-basalt' } }),
      withMilestone('rock-collection', { trigger: { type: 'reading', instrument: 'xray', rocks: [2, 4, 6] } }),
      withMilestone('rare-rock', { trigger: { type: 'reading', instrument: 'xray', rock: 'magnesian-norite', target: 'pebble' as never } }),
      withMilestone('boulder-track', { trigger: { type: 'photo', target: 'boulder' as never } }),
      withMilestone('science-station', { requires: { instrument: 'reflector' } }),
      withMilestone('documented-sample', { requires: { instruments: ['camera', 'laser' as never] } }),
    ];
    expect(broken.map((d) => validateGameData(d))).toEqual([
      ['milestone cold-trap-survey names unknown zone cold-trp'],
      ['milestone hidden-hydrogen triggers on instrument drill but does not require it', 'milestone hidden-hydrogen needs a transect of more than 0 meters'],
      ['milestone rare-rock needs rock mare-basalt, which no rock suite holds'],
      ['milestone rock-collection asks for 6 rock types; the suites hold 5'],
      ['milestone rare-rock names unknown reading target pebble'],
      ['milestone boulder-track names unknown photo target boulder'],
      ['milestone science-station triggers on instrument seismometer but does not require it'],
      ['milestone documented-sample requires instrument laser, which no part provides'],
    ]);
  });

  it('validation catches broken sites: ids, kinds, positions, rock suites and the rolled boulder\'s crater', () => {
    const sites = data.sites.sites;
    const site = (id: string) => sites.find((s) => s.id === id)!;
    const broken = withSites([
      ...sites.filter((s) => !['east-crater', 'rolled-boulder', 'east-cold-trap'].includes(s.id)),
      // A provisional crater without a radius (as before the pipeline confirmed it), and a site with no position at all.
      { ...site('east-crater'), pipeline: undefined, provisional: true, local: { x: -240, z: -130 }, radiusM: undefined, rockSuite: 'granite' },
      { ...site('rolled-boulder'), within: 'east-cold-trap' },
      { ...site('east-cold-trap'), pipeline: undefined },
      { ...site('east-cold-trap'), id: 'nw-crater' },
    ]);
    expect(validateGameData(broken)).toEqual([
      'site east-crater is provisional and needs a radiusM',
      'site east-crater names unknown rock suite granite',
      'site east-cold-trap needs a terrain.json feature, a pipeline feature, or a provisional local position',
      'duplicate site id nw-crater',
      'site rolled-boulder lies within east-cold-trap, which is not a young crater in sites.json',
    ]);
  });

  it('sites match the real terrain.json: features exist, cold zones resolve, every new place is a pipeline feature', () => {
    expect(siteTerrainProblems(data, terrain.features)).toEqual([]);
    // Phase 4: the pipeline produced every new place, so none is provisional any more.
    expect(data.sites.sites.filter((s) => s.provisional).map((s) => s.id)).toEqual([]);
    expect(data.sites.sites.filter((s) => s.pipeline).map((s) => `${s.id}=${s.pipeline!.id}`)).toEqual([
      'nw-crater=young-crater-nw', 'east-crater=young-crater-east', 'se-crater=young-crater-se', 'rolled-boulder=boulder-track-1',
      'hidden-hydrogen=low-light-nw', 'rocky-area-1-cold-patch=cold-trap-rocky-area-1', 'east-cold-trap=cold-trap-east', 'south-cold-trap=cold-trap-south',
    ]);
  });

  it('site references against the pipeline lists: ids must exist once a list exists; provisional sites always pass', () => {
    // The pipeline lists as the checks see them: a cold trap list with one id, and no young crater list yet.
    const features = { ...terrain.features, coldTraps: [{ id: 'ct-east', name: 'East cold trap', centroidLocal: { x: -132, z: 122 } }], youngCraters: undefined };
    const sites = data.sites.sites;
    // Provisional stand-ins for the two cold traps (as they were before the pipeline produced them).
    const east: SiteSpec = { id: 'east-cold-trap', kind: 'cold-trap', name: 'East cold trap', provisional: true, local: { x: -132, z: 122 }, radiusM: 26 };
    const south: SiteSpec = { id: 'south-cold-trap', kind: 'cold-trap', name: 'South cold trap', provisional: true, local: { x: -972, z: 902 }, radiusM: 26 };
    const ra1 = sites.find((s) => s.id === 'rocky-area-1')!;
    const check = (changed: SiteSpec[], zones = data.tuning.cold.zones) =>
      siteTerrainProblems({ ...withSites(changed), tuning: { ...data.tuning, cold: { ...data.tuning.cold, zones } } }, features as never);
    // Confirmed by the pipeline: no longer provisional.
    expect(check([{ ...east, provisional: false, local: undefined, pipeline: { list: 'coldTraps', id: 'ct-east' } }, south])).toEqual([]);
    expect(check([{ ...east, provisional: false, pipeline: { list: 'coldTraps', id: 'ct-gone' } }, south])).toEqual([
      'site east-cold-trap names coldTraps id ct-gone, which terrain.json does not have',
    ]);
    expect(check([east, { ...south, provisional: false, pipeline: { list: 'youngCraters', id: 'yc-1' } }])).toEqual([
      'site south-cold-trap names terrain.json youngCraters, which the pipeline has not produced; mark it provisional',
    ]);
    expect(check([east, south, { ...ra1, feature: 'Rocky area 9' }])).toEqual(['site rocky-area-1 names terrain.json feature Rocky area 9, which does not exist']);
    expect(check([east, south], [...data.tuning.cold.zones, 'North cold trap'])).toEqual([
      'cold zone North cold trap resolves to no terrain.json feature and no cold trap in sites.json',
    ]);
    // A cold trap that is in sites.json but resolves to nothing (no position, no pipeline feature) is reported too.
    const lost: SiteSpec = { ...east, provisional: false, local: undefined, pipeline: { list: 'coldTraps', id: 'ct-gone' } };
    expect(check([lost, south])).toEqual([
      'site east-cold-trap names coldTraps id ct-gone, which terrain.json does not have',
      'cold zone East cold trap resolves to no terrain.json feature and no cold trap in sites.json',
    ]);
  });

  it('Mars has none of the Moon sites and still validates', () => {
    const mars = worldGameData('mars');
    expect(mars.sites.sites).toEqual([]);
    expect(validateGameData(mars)).toEqual([]);
    // Mars replaces the whole milestone list: the four new Moon instruments earn nothing there.
    for (const inst of ['neutron', 'xray', 'seismometer', 'reflector'] as const) expect(earnsMilestones(inst, mars.milestones), inst).toBe(false);
  });
});
