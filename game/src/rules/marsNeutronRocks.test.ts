// Mars step 5b: the hydrogen meter on Mars (the noise floor, Séítah and the delta foot, the hidden hydrated
// ground), the RTG's neutron noise (C6, MS4), and the Mars rock suites (MS9, MS10). Pure rules; the numbers
// come from the data, so the tests check how the rules behave, not the starting values.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import jezero from '../../public/terrain/mars/terrain.json';
import { buildZones, MilestoneTracker, zoneContains, type MilestoneFeatures, type Point3, type Zone } from './milestones';
import { resolveSites, type SiteFeatures } from './sites';
import { hasNeutronNoise, hydrogenReading, newRockType, rockTypeFor, rockTypeTotal } from './instruments';
import { selectedParts } from './rover';
import { seededRng } from './events';
import { MARS_ROCK_IDS, type MarsTerrainFeatures } from './marsTypes';
import type { Boulder } from './boulders';
import type { Build } from './types';

const mars = loadGameData('mars');
const moon = loadGameData('moon');
const n = mars.tuning.instruments.neutron;
const xray = mars.tuning.instruments.xray;
const f = jezero.features as unknown as MarsTerrainFeatures;
const L = jezero.landing.local;
const sites = resolveSites(mars.sites.sites, jezero.features as unknown as SiteFeatures);
const features: MilestoneFeatures = { landing: L, rockyAreas: f.rockyAreas, deltaFront: f.deltaFront, seitah: f.seitah, viewpoints: f.viewpoints };
const zones = buildZones(features, mars.tuning.milestones, { sites, neutron: n });
const core = zones.find((z) => z.id === 'hydrogen-anomaly')!;
const c = core.shape.kind === 'circle' ? core.shape : { x: NaN, z: NaN, r: NaN };
/** A point d meters from the hydrated ground's center, toward the landing point. */
const fromCore = (d: number) => {
  const l = Math.hypot(L.x - c.x, L.z - c.z);
  return { x: c.x + ((L.x - c.x) / l) * d, z: c.z + ((L.z - c.z) / l) * d };
};
const read = (p: { x: number; z: number }, jitter = 0.5, noisy = false, zs: Zone[] = zones) => hydrogenReading(p, false, zs, n, jitter, noisy);

describe('the hydrogen meter on Mars', () => {
  it('has the hidden hydrated ground as its one hydrogen-anomaly zone, of hydrogenZoneRadiusM', () => {
    expect(zones.filter((z) => z.id === 'hydrogen-anomaly')).toHaveLength(1);
    expect(core.site).toBe('hydrated-ground');
    expect(c.r).toBe(mars.tuning.milestones.hydrogenZoneRadiusM);
    expect(zones.some((z) => z.id === 'cold-trap' || z.id === 'shadowed-crater' || z.id === 'ice-spot')).toBe(false);
  });

  it('reads the noise floor on ordinary ground (the landing point)', () => {
    expect(read(L)).toBe(n.noiseFloor);
  });

  it('reads anomalyPeak at the core, anomalyEdge at its edge, and falls in a straight line to the floor at anomalyRangeM', () => {
    expect(read(fromCore(0))).toBeCloseTo(n.anomalyPeak);
    expect(read(fromCore(c.r))).toBeCloseTo(n.anomalyEdge);
    expect(read(fromCore(c.r / 2))).toBeCloseTo((n.anomalyPeak + n.anomalyEdge) / 2);
    const mid = (c.r + n.anomalyRangeM) / 2;
    expect(read(fromCore(mid))).toBeCloseTo((n.anomalyEdge + n.noiseFloor) / 2);
    expect(read(fromCore(n.anomalyRangeM))).toBeCloseTo(n.noiseFloor);
    expect(read(fromCore(n.anomalyRangeM + 50))).toBe(n.noiseFloor);
    // It rises all the way in: a gradient to follow.
    let last = -1;
    for (let d = n.anomalyRangeM; d >= 0; d -= 5) {
      const v = read(fromCore(d));
      expect(v).toBeGreaterThan(last);
      last = v;
    }
  });

  it('reads the unit value inside Séítah (away from the hydrated ground), the floor just outside', () => {
    const seitah = zones.find((z) => z.id === 'seitah')!;
    const inside: { x: number; z: number }[] = [];
    const pts = f.seitah.outlineLocal_xz;
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 25) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += 25) {
        if (zoneContains(seitah, { x, y: 0, z }) && Math.hypot(x - c.x, z - c.z) > n.anomalyRangeM) inside.push({ x, z });
      }
    }
    expect(inside.length).toBeGreaterThan(0);
    for (const p of inside.slice(0, 20)) expect(read(p)).toBe(n.unitReadings!.seitah);
  });

  it('reads the unit value inside the delta foot zone (whatever shape step 5a builds)', () => {
    const foot = { id: 'delta-foot', key: 'delta-foot', name: 'Delta foot', shape: { kind: 'circle', x: -425, z: -1285, r: 50 } } as unknown as Zone;
    const zs = [...zones.filter((z) => z.id !== ('delta-foot' as string)), foot];
    expect(read({ x: -425, z: -1285 }, 0.5, false, zs)).toBe(n.unitReadings!['delta-foot']);
    expect(read({ x: -425, z: -1285 + 60 }, 0.5, false, zs)).toBe(n.noiseFloor);
  });

  it('the Moon reads as before: no unit readings or RTG values, so the noisy flag changes nothing there', () => {
    const mn = moon.tuning.instruments.neutron;
    expect(mn.unitReadings).toBeUndefined();
    expect(mn.rtgFloorRise).toBeUndefined();
    expect(mn.rtgJitter).toBeUndefined();
    for (const p of [L, fromCore(0), fromCore(40)]) {
      for (const j of [0, 0.5, 1]) expect(hydrogenReading(p, true, zones, mn, j, true)).toBe(hydrogenReading(p, true, zones, mn, j, false));
    }
  });
});

describe("the RTG's neutron noise (C6, MS4)", () => {
  const build = (power: string): Build => ({
    chassis: 'chassis-steel', wheels: 'wheels-grouser', power, battery: 'battery-large', lights: 'lights-led', heater: 'heater-none',
    payload: ['instrument-neutron'], support: { arm: 'arm-none', mast: 'mast-none' },
  });
  const rtg = selectedParts(build('power-rtg'), mars.parts);
  const solar = selectedParts(build('power-fixed-panel'), mars.parts);

  it('only a rover with a neutronNoise part (the RTG) is noisy', () => {
    expect(hasNeutronNoise(rtg)).toBe(true);
    expect(solar.some((p) => p.slot === 'power')).toBe(true);
    expect(hasNeutronNoise(solar)).toBe(false);
  });

  it('raises the floor by rtgFloorRise and wobbles by up to rtgJitter instead of jitter', () => {
    const floor = n.noiseFloor + n.rtgFloorRise!;
    expect(read(L, 0.5, true)).toBeCloseTo(floor);
    expect(read(L, 1, true)).toBeCloseTo(floor + n.rtgJitter!);
    expect(read(L, 0, true)).toBeCloseTo(floor - n.rtgJitter!);
    expect(read(L, 1, false)).toBeCloseTo(n.noiseFloor + n.jitter);
  });

  it('signals above the raised floor read as before; the weaker ones drown in it', () => {
    expect(read(fromCore(0), 0.5, true)).toBeCloseTo(n.anomalyPeak);
    expect(read(fromCore(c.r), 0.5, true)).toBeCloseTo(Math.max(n.anomalyEdge, n.noiseFloor + n.rtgFloorRise!));
    expect(read(fromCore(n.anomalyRangeM - 1), 0.5, true)).toBeCloseTo(n.noiseFloor + n.rtgFloorRise!);
  });

  it('is deterministic for a given jitter input and stays within 0..1', () => {
    const rng = seededRng(7);
    const js = Array.from({ length: 50 }, () => rng());
    const a = js.map((j) => read(fromCore(30), j, true));
    const b = js.map((j) => read(fromCore(30), j, true));
    expect(a).toEqual(b);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('a noisy rover that drives over the core still earns Hydrated ground (a search cost, not a rule)', () => {
    const tr = new MilestoneTracker(mars.milestones.milestones, rtg, zones, mars.tuning.milestones);
    const at = (x: number, z: number): Point3 => ({ x, y: 0, z });
    let odo = 0;
    const reached: string[] = [];
    for (let x = c.x - c.r - 20; x <= c.x + c.r + 20; x += 5) {
      const u = tr.step({ position: at(x, c.z), distanceM: odo, exploredShare: 0, switchedOn: ['neutron'] });
      reached.push(...u.reached.map((r) => r.milestone.id));
      odo += 5;
    }
    expect(reached).toContain('hydrated-ground');
  });
});

describe('Mars rock suites (MS9, MS10)', () => {
  const suiteOf = (site: string) => {
    const id = mars.sites.sites.find((s) => s.id === site)?.rockSuite;
    return xray.suites.find((s) => s.id === id)!.rocks.map((r) => r.id);
  };
  const rng = seededRng(42);
  const boulders = (site: string | undefined, count: number): Boulder[] =>
    Array.from({ length: count }, () => ({ x: rng() * 3000 - 1500, z: rng() * 3000 - 1500, radius: 0.2 + rng(), ...(site ? { site } : {}) }));

  it('the same boulder reads the same rock every time', () => {
    for (const b of boulders('rocky-area-1', 30)) {
      expect(rockTypeFor({ ...b }, xray, mars.sites.sites)).toBe(rockTypeFor(b, xray, mars.sites.sites));
    }
  });

  it('each site reads only its own suite, and a visit finds every rock of it', () => {
    const withSuite = mars.sites.sites.filter((s) => s.rockSuite);
    expect(withSuite.length).toBeGreaterThan(0);
    for (const s of withSuite) {
      const suite = suiteOf(s.id);
      const found = new Set(boulders(s.id, 200).map((b) => rockTypeFor(b, xray, mars.sites.sites)));
      for (const r of found) expect(suite, `${s.id} ${r}`).toContain(r);
      expect([...found].sort(), s.id).toEqual([...new Set(suite)].sort());
    }
  });

  it('the flood boulder is always flood conglomerate, and no other site gives it', () => {
    for (const b of boulders('flood-boulder', 50)) expect(rockTypeFor(b, xray, mars.sites.sites)).toBe('flood-conglomerate');
    for (const s of mars.sites.sites.filter((x) => x.rockSuite && x.id !== 'flood-boulder')) {
      for (const b of boulders(s.id, 50)) expect(rockTypeFor(b, xray, mars.sites.sites)).not.toBe('flood-conglomerate');
    }
  });

  it('a boulder with no site reads the fallback list; every rock is a Mars rock with a name and readout', () => {
    const fallback = xray.rocks.map((r) => r.id);
    for (const b of boulders(undefined, 30)) expect(fallback).toContain(rockTypeFor(b, xray, mars.sites.sites));
    const all = [...xray.rocks, ...xray.suites.flatMap((s) => s.rocks)].map((r) => r.id);
    for (const id of all) {
      expect(MARS_ROCK_IDS as readonly string[]).toContain(id);
      expect(mars.text.rocks[id]?.name, id).toBeTruthy();
      expect(mars.text.rocks[id]?.elements, id).toBeTruthy();
    }
  });

  it('the readout counts toward all six Mars types: "New type: n of 6"', () => {
    expect(rockTypeTotal(xray)).toBe(MARS_ROCK_IDS.length);
    expect(newRockType([], 'maaz-basalt', xray)).toEqual({ count: 1, total: MARS_ROCK_IDS.length });
    expect(newRockType(['maaz-basalt', 'maaz-basalt'], 'lake-mudstone', xray)).toEqual({ count: 2, total: MARS_ROCK_IDS.length });
    expect(newRockType(['maaz-basalt', 'lake-mudstone'], 'maaz-basalt', xray)).toBeNull();
    expect(newRockType([], 'maaz-basalt', { ...xray, suites: [] })).toBeNull();
  });
});
