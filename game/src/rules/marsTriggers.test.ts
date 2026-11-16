// The twenty new Mars milestones (Mars step 5a) through the pure tracker, on the real Jezero terrain and
// data/mars: the Mars zones (delta foot, young-crater rings, the hydrated ground's core, crater rims), the
// shared triggers' Mars extensions (transect zone lists and no zone, per-instrument readings, timed
// records, the crater-wall and dust devil photos), and Clean run and Sand crossing. Each milestone has a
// firing and a non-firing case; the last test checks all 28 Mars milestones fired somewhere in this file.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import jezero from '../../public/terrain/mars/terrain.json';
import { buildZones, distanceToPath, MilestoneTracker, zoneContains, type MilestoneFeatures, type MilestoneUpdate, type Point, type Point3, type StepInput } from './milestones';
import { resolveSites, type SiteFeatures } from './sites';
import { selectedParts } from './rover';
import type { MarsTerrainFeatures } from './marsTypes';
import { validateGameData } from './validate';
import type { Build, GameData, Instrument, Milestone } from './types';

const data = loadGameData('mars');
const t = data.tuning.milestones;
const f = jezero.features as unknown as MarsTerrainFeatures;
const L = jezero.landing.local;
const features: MilestoneFeatures = {
  landing: L,
  rockyAreas: f.rockyAreas,
  deltaFront: f.deltaFront,
  seitah: f.seitah,
  viewpoints: f.viewpoints,
  youngCraters: f.youngCraters,
};
const sites = resolveSites(data.sites.sites, jezero.features as unknown as SiteFeatures);
const zones = buildZones(features, t, { sites, neutron: data.tuning.instruments.neutron });
const zonesOf = (id: string) => zones.filter((z) => z.id === id);
const zone = (id: string) => zonesOf(id)[0]!;
const siteZone = (site: string) => zones.find((z) => z.site === site && z.id === 'young-crater')!;

const base: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-mesh', power: 'power-rtg', battery: 'battery-large',
  lights: 'lights-led', heater: 'heater-rhu', payload: [], support: { arm: 'arm-robotic', mast: 'mast-remote' },
};
const carrying = (...instruments: Instrument[]): Build => ({ ...base, payload: instruments.map((i) => `instrument-${i}`) });
const tracker = (build: Build) => new MilestoneTracker(data.milestones.milestones, selectedParts(build, data.parts), zones, t);

const firedAnywhere = new Set<string>();
const ids = (u: MilestoneUpdate) => {
  const got = u.reached.map((r) => r.milestone.id);
  for (const id of got) firedAnywhere.add(id);
  return got;
};
const stagesOf = (u: MilestoneUpdate, id: string) => (ids(u), u.reached.filter((r) => r.milestone.id === id).map((r) => r.stage));
const at = (x: number, z: number): Point3 => ({ x, y: L.y, z });
const inZones = (p: Point3) => zones.filter((z) => zoneContains(z, p)).map((z) => z.id);
/** 300 m east of the lander: outside the near-lander zone and every other zone. */
const open = at(L.x + 300, L.z);
const nearLander = at(L.x + 10, L.z);

/** Drives a switched-on instrument along the points (straight legs), stepping every few meters. */
function drive(tr: MilestoneTracker, points: Point[], on: Instrument[], extra: Partial<StepInput> = {}, startM = 0): { u: MilestoneUpdate; m: number } {
  const u: MilestoneUpdate = { reached: [], missed: [], partialCrossings: [] };
  let m = startM;
  const take = (r: MilestoneUpdate) => {
    u.reached.push(...r.reached);
    u.missed.push(...r.missed);
  };
  take(tr.step({ position: at(points[0]!.x, points[0]!.z), distanceM: m, exploredShare: 0, switchedOn: on, ...extra }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 5));
    for (let k = 1; k <= n; k++) {
      m += len / n;
      take(tr.step({ position: at(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n), distanceM: m, exploredShare: 0, switchedOn: on, ...extra }));
    }
  }
  return { u, m };
}

const foot = f.deltaFront.footNear!;
const footStart = { x: foot.lineLocal_xz[0]![0], z: foot.lineLocal_xz[0]![1] };
/** A scarp vertex on the delta front zone but well away from the delta foot. */
const frontOnly = (() => {
  const [x, z] = f.deltaFront.scarpLocal_xz.find(([x, z]) => distanceToPath(foot.lineLocal_xz, x, z) > 300)!;
  return at(x, z);
})();
const seitahIn = at(f.seitah.centroidLocal.x, f.seitah.centroidLocal.z);
const hydrated = sites.find((s) => s.kind === 'hidden-hydrogen')!.center;

describe('Mars zones (Mars step 5a)', () => {
  it('the delta foot: within deltaFootRadiusM of the nearest 400 m of the scarp foot, much narrower than the delta front', () => {
    const r = t.deltaFootRadiusM!;
    const z = zone('delta-foot');
    expect(z.shape.kind).toBe('path');
    expect(zoneContains(z, at(footStart.x, footStart.z))).toBe(true);
    // Outward from the foot line's first point, along the line's backward direction (away from the rest of it).
    const [x1, z1] = foot.lineLocal_xz[1]!;
    const len = Math.hypot(footStart.x - x1, footStart.z - z1);
    const out = (d: number) => at(footStart.x + ((footStart.x - x1) / len) * d, footStart.z + ((footStart.z - z1) / len) * d);
    expect(zoneContains(z, out(r - 1))).toBe(true);
    expect(zoneContains(z, out(r + 1))).toBe(false);
    expect(zoneContains(zone('delta-front'), frontOnly)).toBe(true);
    expect(zoneContains(z, frontOnly)).toBe(false);
    expect(z.site).toBe('delta-foot');
  });

  it('young-crater rings at every young crater and rocky area; only real craters carry a rim for Crater wall', () => {
    const rings = zonesOf('young-crater');
    expect(rings.map((z) => z.site).sort()).toEqual(['east-crater', 'ese-crater', 'rocky-area-1', 'rocky-area-2', 's-crater', 'sse-crater', 'sw-crater', 'wsw-crater']);
    const east = siteZone('east-crater');
    const ene = f.youngCraters!.find((c) => c.id === 'young-crater-ene')!;
    expect(east.shape).toEqual({ kind: 'circle', x: ene.local.x, z: ene.local.z, r: ene.radius_m * t.youngCraterEjectaFactor });
    expect(east.crater).toEqual({ x: ene.local.x, z: ene.local.z, radiusM: ene.radius_m });
    // Rocky area 2 is a crater with a rim (the pipeline's crater, its center and rim crest); Rocky area 1 is a boulder field.
    const ra2 = f.youngCraters!.find((c) => c.rockyArea === 'Rocky area 2')!;
    expect(siteZone('rocky-area-2').crater).toEqual({ x: ra2.local.x, z: ra2.local.z, radiusM: ra2.radius_m });
    expect(siteZone('rocky-area-1').crater).toBeUndefined();
  });

  it('the hydrated ground: its hidden 25 m core (hydrogenZoneRadiusM)', () => {
    const z = zone('hydrogen-anomaly');
    expect(z.shape).toEqual({ kind: 'circle', x: hydrated.x, z: hydrated.z, r: t.hydrogenZoneRadiusM });
    expect(zoneContains(z, at(hydrated.x + t.hydrogenZoneRadiusM - 1, hydrated.z))).toBe(true);
    expect(zoneContains(z, at(hydrated.x + t.hydrogenZoneRadiusM + 1, hydrated.z))).toBe(false);
  });

  it('the test points are where they should be', () => {
    expect(inZones(open)).toEqual([]);
    expect(inZones(nearLander)).toEqual(['near-lander']);
    expect(inZones(seitahIn)).toContain('seitah');
  });

  it('the Moon builds no delta foot and no crater rims for Crater wall without the Mars tuning', () => {
    const moon = loadGameData('moon');
    expect(buildZones(features, moon.tuning.milestones).some((z) => z.id === 'delta-foot')).toBe(false);
    const tr = new MilestoneTracker(data.milestones.milestones, selectedParts(carrying('camera'), data.parts), zones, moon.tuning.milestones);
    const east = siteZone('east-crater').crater!;
    expect(tr.craterWallsNear(at(east.x + east.radiusM, east.z))).toEqual([]);
  });
});

describe('photo: Crater wall and Dust devil', () => {
  const east = siteZone('east-crater').crater!;
  const rim = (k: number) => at(east.x + k * east.radiusM, east.z);
  const centerInFrame = (c: Point) => (p: Point) => Math.hypot(p.x - c.x, p.z - c.z) < 1;

  it('Crater wall: the crater\'s center in frame, the rover inside the rim band', () => {
    const [lo, hi] = t.craterWallRimBand!;
    const tr = tracker(carrying('camera'));
    expect(ids(tr.photo(rim(1), false, 0, undefined, [], {}))).toEqual([]); // no frame test given
    expect(ids(tr.photo(rim(1), false, 0, undefined, [], { groundInFrame: () => false }))).toEqual([]); // looking away
    expect(ids(tr.photo(rim(lo - 0.05), false, 0, undefined, [], { groundInFrame: centerInFrame(east) }))).toEqual([]); // down on the floor
    expect(ids(tr.photo(rim(hi + 0.05), false, 0, undefined, [], { groundInFrame: centerInFrame(east) }))).toEqual([]); // too far out
    expect(tr.craterWallsNear(rim(lo)).map((z) => z.site)).toEqual(['east-crater']); // band edges count
    expect(ids(tr.photo(rim(hi), false, 0, undefined, [], { groundInFrame: centerInFrame(east) }))).toEqual(['crater-wall']);
  });

  it('Crater wall at Rocky area 2 (a crater with a rim), not at Rocky area 1', () => {
    const ra2 = siteZone('rocky-area-2').crater!;
    expect(ids(tracker(carrying('camera')).photo(at(ra2.x, ra2.z - ra2.radiusM), false, 0, undefined, [], { groundInFrame: () => true }))).toEqual(['crater-wall']);
    const ra1 = sites.find((s) => s.id === 'rocky-area-1')!;
    expect(tracker(carrying('camera')).craterWallsNear(at(ra1.center.x + ra1.radiusM!, ra1.center.z)).map((z) => z.site)).not.toContain('rocky-area-1');
  });

  it('Crater wall needs the camera', () => {
    const u = tracker(carrying('drill')).photo(rim(1), false, 0, undefined, [], { groundInFrame: () => true });
    expect(ids(u)).toEqual([]);
    expect(u.missed.map((m) => m.milestone.id)).toEqual(['crater-wall']);
  });

  it('Dust devil: a devil in frame; within dustDevilPhotoRangeM when the tuning sets it', () => {
    const tr = tracker(carrying('camera'));
    expect(ids(tr.photo(open, false, 0))).toEqual([]);
    expect(ids(tr.photo(open, false, 0, undefined, [], { dustDevilsInFrame: [] }))).toEqual([]);
    expect(ids(tr.photo(open, false, 0, undefined, [], { dustDevilsInFrame: [{ x: open.x + 120, z: open.z }] }))).toEqual(['dust-devil']);
    const ranged = new MilestoneTracker(data.milestones.milestones, selectedParts(carrying('camera'), data.parts), zones, { ...t, dustDevilPhotoRangeM: 100 });
    expect(ids(ranged.photo(open, false, 0, undefined, [], { dustDevilsInFrame: [{ x: open.x + 120, z: open.z }] }))).toEqual([]);
    expect(ids(ranged.photo(open, false, 0, undefined, [], { dustDevilsInFrame: [{ x: open.x + 100, z: open.z }] }))).toEqual(['dust-devil']);
  });
});

describe('drill: Séítah core and Signs of an ancient lake', () => {
  it('Séítah core inside its outline, also a Core sample site; not outside it', () => {
    const tr = tracker(carrying('drill'));
    expect(ids(tr.drill(open))).toEqual(['core-sample']);
    expect(ids(tr.drill(seitahIn)).sort()).toEqual(['core-sample', 'seitah-core']);
  });

  it('Signs of an ancient lake in the delta foot, also a Core sample site; not on the delta front away from the foot', () => {
    const tr = tracker(carrying('drill'));
    expect(ids(tr.drill(frontOnly))).toEqual(['core-sample']);
    expect(ids(tr.drill(at(footStart.x, footStart.z))).sort()).toEqual(['ancient-lake', 'core-sample']);
  });
});

describe('reading: rock types and boulders per instrument, sites outside the near-lander zone', () => {
  const xrayLaser = carrying('xray', 'laser', 'camera');

  it('Rock collection and Rare rock count X-ray readings only, never the laser\'s', () => {
    const tr = tracker(xrayLaser);
    expect(ids(tr.reading('laser', open, { target: 'boulder', rock: 'maaz-basalt', boulder: 1 }))).not.toContain('mars-rock-collection');
    expect(ids(tr.reading('laser', open, { target: 'boulder', rock: 'olivine-cumulate', boulder: 2 }))).not.toContain('mars-rock-collection');
    expect(ids(tr.reading('laser', at(footStart.x, footStart.z), { target: 'boulder', rock: 'flood-conglomerate', boulder: 3 }))).not.toContain('mars-rare-rock');
    expect(tr.rockTypesRead('xray')).toBe(0);
    expect(tr.rockTypesRead('laser')).toBe(3);
    expect(ids(tr.reading('xray', open, { target: 'boulder', rock: 'maaz-basalt', boulder: 1 }))).toEqual([]);
    expect(stagesOf(tr.reading('xray', open, { target: 'boulder', rock: 'olivine-cumulate', boulder: 2 }), 'mars-rock-collection')).toEqual([1]);
    const rare = tr.reading('xray', at(footStart.x, footStart.z), { target: 'boulder', rock: 'flood-conglomerate', boulder: 3 });
    expect(ids(rare).sort()).toEqual(['mars-rare-rock', 'mars-rock-collection']);
    expect(stagesOf(rare, 'mars-rock-collection')).toEqual([2]);
  });

  it('Documented sample: a boulder the X-ray read, not one only the laser read', () => {
    const tr = tracker(xrayLaser);
    const boulder = { index: 5, x: open.x + 5, z: open.z };
    tr.reading('laser', open, { target: 'boulder', rock: 'maaz-basalt', boulder: 5 });
    expect(tr.wasRead(5)).toBe(true);
    expect(tr.wasRead(5, 'xray')).toBe(false);
    expect(ids(tr.photo(open, false, 0, undefined, [boulder]))).toEqual([]);
    tr.reading('xray', open, { target: 'boulder', rock: 'maaz-basalt', boulder: 5 });
    expect(ids(tr.photo(open, false, 0, undefined, [boulder]))).toEqual(['mars-documented-sample']);
  });

  it('Remote reading: laser boulder readings at three sites sampleSpacingM apart; the cliff and the lander do not count', () => {
    const tr = tracker(xrayLaser);
    const s = t.sampleSpacingM;
    expect(ids(tr.reading('laser', nearLander, { target: 'boulder' }))).toEqual([]); // near the lander
    expect(ids(tr.reading('laser', open, { target: 'cliff' }))).toEqual([]); // not a boulder
    expect(stagesOf(tr.reading('laser', open, { target: 'boulder' }), 'remote-reading')).toEqual([1]);
    expect(ids(tr.reading('laser', at(open.x + s - 1, open.z), { target: 'boulder' }))).toEqual([]); // same site
    expect(stagesOf(tr.reading('laser', at(open.x + s, open.z), { target: 'boulder' }), 'remote-reading')).toEqual([2]);
    expect(stagesOf(tr.reading('laser', at(open.x + 2 * s, open.z), { target: 'boulder' }), 'remote-reading')).toEqual([3]);
  });

  it('Rock from afar: the laser on the delta cliff from the delta foot; not from the front away from the foot, nor on a boulder', () => {
    const tr = tracker(xrayLaser);
    const inFoot = at(footStart.x, footStart.z);
    expect(ids(tr.reading('laser', frontOnly, { target: 'cliff' }))).toEqual([]);
    expect(ids(tr.reading('laser', inFoot, { target: 'boulder' }))).not.toContain('rock-from-afar');
    expect(ids(tr.reading('laser', inFoot, { target: 'cliff' }))).toEqual(['rock-from-afar']);
  });

  it('Organic signals: boulders outside the near-lander zone, two sites apart; Lake organics in the delta foot, from the same reading', () => {
    const tr = tracker(carrying('organics'));
    expect(ids(tr.reading('organics', nearLander, { target: 'boulder', boulder: 1 }))).toEqual([]);
    expect(ids(tr.reading('organics', open, { target: 'cliff' }))).toEqual([]);
    expect(stagesOf(tr.reading('organics', open, { target: 'boulder', boulder: 2 }), 'organic-signals')).toEqual([1]);
    expect(ids(tr.reading('organics', at(open.x + 20, open.z), { target: 'boulder', boulder: 3 }))).toEqual([]); // same site, not the foot
    const lake = tr.reading('organics', at(footStart.x, footStart.z), { target: 'boulder', boulder: 4 });
    expect(ids(lake).sort()).toEqual(['lake-organics', 'organic-signals']);
    expect(stagesOf(lake, 'organic-signals')).toEqual([2]);
  });

  it('Lake organics only inside the delta foot', () => {
    expect(ids(tracker(carrying('organics')).reading('organics', frontOnly, { target: 'boulder', boulder: 1 }))).toEqual(['organic-signals']);
  });
});

describe('transect: zone lists and the no-zone Long profile', () => {
  const east = siteZone('east-crater');
  const eastC = east.crater!;

  it('Buried layers: one stage per distinct zone instance of the list, once the unbroken radar drive reaches 150 m', () => {
    const tr = tracker(carrying('radar'));
    // 100 m through East crater's ring: touched, but short.
    let r = drive(tr, [{ x: eastC.x - 50, z: eastC.z }, { x: eastC.x + 50, z: eastC.z }], ['radar']);
    expect(ids(r.u)).toEqual([]);
    r = drive(tr, [{ x: eastC.x + 50, z: eastC.z }, { x: eastC.x + 50, z: eastC.z + 60 }], ['radar'], {}, r.m);
    expect(stagesOf(r.u, 'buried-layers')).toEqual([1]);
    // The same ring again is not a second stage; Séítah and the delta front are (the same unbroken run,
    // stepped straight there so the way does not cross other zones).
    r = drive(tr, [{ x: eastC.x + 50, z: eastC.z + 60 }, { x: eastC.x, z: eastC.z }], ['radar'], {}, r.m);
    expect(stagesOf(r.u, 'buried-layers')).toEqual([]);
    const visit = (p: Point3) => tr.step({ position: p, distanceM: r.m, exploredShare: 0, switchedOn: ['radar'] });
    expect(stagesOf(visit(open), 'buried-layers')).toEqual([]);
    expect(stagesOf(visit(seitahIn), 'buried-layers')).toEqual([2]);
    expect(stagesOf(visit(frontOnly), 'buried-layers')).toEqual([3]);
    expect(stagesOf(visit(at(eastC.x, eastC.z + 400)), 'buried-layers')).toEqual([]); // at most three
  });

  it('Buried layers does not count a drive that touches none of its zones, or one switched off', () => {
    const tr = tracker(carrying('radar'));
    expect(ids(drive(tr, [open, { x: open.x, z: open.z + 400 }], ['radar']).u)).not.toContain('buried-layers');
    const off = tracker(carrying('radar'));
    expect(ids(drive(off, [{ x: eastC.x - 150, z: eastC.z }, { x: eastC.x + 150, z: eastC.z }], []).u)).toEqual([]);
  });

  it('Long profile: 500 m switched on, counted only outside the near-lander zone', () => {
    const tr = tracker(carrying('radar'));
    // Back and forth inside the near-lander zone: 600 m that do not count.
    const west = { x: L.x - 50, z: L.z };
    let r = drive(tr, [nearLander, ...Array.from({ length: 5 }, () => [west, nearLander]).flat()], ['radar']);
    expect(r.m).toBeGreaterThan(500);
    expect(ids(r.u)).not.toContain('long-profile');
    // Out to the open (only the meters past the zone edge count) and on: fires at 500 m outside.
    r = drive(tr, [nearLander, open], ['radar'], {}, r.m);
    expect(ids(r.u)).not.toContain('long-profile');
    // About 180 m of the way out were outside the zone: 300 m more is short, 330 m more is enough.
    r = drive(tr, [open, { x: open.x, z: open.z + 300 }], ['radar'], {}, r.m);
    expect(ids(r.u)).not.toContain('long-profile');
    r = drive(tr, [{ x: open.x, z: open.z + 300 }, { x: open.x, z: open.z + 330 }], ['radar'], {}, r.m);
    expect(ids(r.u)).toContain('long-profile');
  });

  it('Long profile: switching off starts the count again; a power-down pauses it', () => {
    const tr = tracker(carrying('radar'));
    let r = drive(tr, [open, { x: open.x, z: open.z + 300 }], ['radar']);
    r = drive(tr, [{ x: open.x, z: open.z + 300 }, { x: open.x, z: open.z + 310 }], []); // switched off
    r = drive(tr, [{ x: open.x, z: open.z + 310 }, { x: open.x, z: open.z + 610 }], ['radar'], {}, r.m);
    expect(ids(r.u)).not.toContain('long-profile'); // 300 m since switching on again
    r = drive(tr, [{ x: open.x, z: open.z + 610 }, { x: open.x, z: open.z + 700 }], ['radar'], { poweredDown: true }, r.m);
    expect(ids(r.u)).not.toContain('long-profile');
    r = drive(tr, [{ x: open.x, z: open.z + 700 }, { x: open.x, z: open.z + 900 }], ['radar'], {}, r.m);
    expect(ids(r.u)).toContain('long-profile'); // 300 + 200 after the pause
  });

  it('Hydrated ground: a 20 m neutron drive touching the 25 m core; passing just outside it does not count', () => {
    const miss = tracker(carrying('neutron'));
    const r0 = t.hydrogenZoneRadiusM;
    expect(ids(drive(miss, [{ x: hydrated.x - 60, z: hydrated.z + r0 + 3 }, { x: hydrated.x + 60, z: hydrated.z + r0 + 3 }], ['neutron']).u)).toEqual([]);
    const hit = tracker(carrying('neutron'));
    expect(ids(drive(hit, [{ x: hydrated.x - 30, z: hydrated.z }, { x: hydrated.x, z: hydrated.z }], ['neutron']).u)).toEqual(['hydrated-ground']);
  });

  it('Hydrogen traverse: 100 m touching Séítah, then the delta front, one stage each; a young crater does not count', () => {
    const tr = tracker(carrying('neutron'));
    let r = drive(tr, [{ x: eastC.x - 150, z: eastC.z }, { x: eastC.x + 150, z: eastC.z }], ['neutron']);
    expect(ids(r.u)).toEqual([]);
    r = drive(tr, [{ x: eastC.x + 150, z: eastC.z }, seitahIn], ['neutron'], {}, r.m);
    expect(stagesOf(r.u, 'hydrogen-traverse')).toEqual([1]);
    r = drive(tr, [seitahIn, frontOnly], ['neutron'], {}, r.m);
    expect(stagesOf(r.u, 'hydrogen-traverse')).toEqual([2]);
  });
});

describe('record with seconds: the weather mast', () => {
  /** Steps of dt seconds at a position, with the mast on or off. */
  function hold(tr: MilestoneTracker, seconds: number, extra: Partial<StepInput>, p: Point3 = open, dt = 0.5): string[] {
    const got: string[] = [];
    for (let s = 0; s < seconds - 1e-9; s += dt) got.push(...ids(tr.step({ position: p, distanceM: 0, exploredShare: 0, switchedOn: ['weather'], dt, ...extra })));
    return got;
  }
  const mast = () => tracker(carrying('weather'));

  it('Storm log: 60 s of the storm with the mast on, powered up and outside the near-lander zone', () => {
    const tr = mast();
    expect(hold(tr, 59.5, { stormActive: true })).toEqual([]);
    expect(tr.recordSecondsFor('weather', 'duststorm')).toBeCloseTo(59.5);
    expect(hold(tr, 0.5, { stormActive: true })).toContain('storm-log');
  });

  it('Storm log: a power-down, switching off or the near-lander zone pause the count; it needs the storm', () => {
    const tr = mast();
    expect(hold(tr, 100, {})).toEqual([]); // no storm
    hold(tr, 30, { stormActive: true });
    hold(tr, 20, { stormActive: true, poweredDown: true });
    hold(tr, 20, { stormActive: true, switchedOn: [] });
    hold(tr, 20, { stormActive: true }, nearLander);
    expect(tr.recordSecondsFor('weather', 'duststorm')).toBeCloseTo(30);
    expect(hold(tr, 30, { stormActive: true })).toContain('storm-log');
  });

  it('Night weather: 12 s of one night, awake; the count starts again at dawn', () => {
    const tr = mast();
    expect(hold(tr, 8, { night: true })).toEqual([]);
    hold(tr, 4, { night: true, poweredDown: true }); // asleep
    hold(tr, 1, { night: false }); // dawn
    expect(tr.recordSecondsFor('weather', 'night')).toBe(0);
    expect(hold(tr, 11.5, { night: true })).toEqual([]);
    expect(hold(tr, 0.5, { night: true })).toEqual(['night-weather']);
  });

  it('Night weather needs no lights', () => {
    const tr = tracker({ ...carrying('weather'), lights: 'lights-none' });
    expect(hold(tr, 12, { night: true })).toEqual(['night-weather']);
  });

  it('Dust devil pass: the mast on when a devil passes within its range; not switched off, powered down or near the lander', () => {
    const tr = mast();
    expect(hold(tr, 0.5, { dustDevilPassed: true, switchedOn: [] })).toEqual([]);
    expect(hold(tr, 0.5, { dustDevilPassed: true, poweredDown: true })).toEqual([]);
    expect(hold(tr, 0.5, { dustDevilPassed: true }, nearLander)).toEqual([]);
    expect(hold(tr, 5, {})).toEqual([]);
    expect(hold(tr, 0.5, { dustDevilPassed: true })).toEqual(['dust-devil-pass']);
  });

  it('Dust devil pass needs the weather mast; record() never fires a timed record', () => {
    const tr = tracker(carrying('camera'));
    const u = tr.step({ position: open, distanceM: 0, exploredShare: 0, switchedOn: ['weather'], dt: 0.5, dustDevilPassed: true });
    expect(ids(u)).toEqual([]);
    expect(ids(mast().record('weather', 'duststorm'))).toEqual([]);
  });
});

describe('Clean run and Sand crossing on Mars', () => {
  it('Clean run: an idle rover that ends without damage earns it; any damage, or not surviving, loses it', () => {
    const idle = tracker(carrying());
    idle.land();
    expect(ids(idle.finish(true, {}))).toContain('mars-clean-run');
    expect(ids(tracker(carrying()).finish(true, { impact: 2 }))).not.toContain('mars-clean-run');
    expect(ids(tracker(carrying()).finish(false, {}))).not.toContain('mars-clean-run');
  });

  it('Sand crossing: into Séítah and out again (any exit counts); not while still inside', () => {
    const tr = tracker(carrying());
    const outside = at(f.seitah.entryPoint.local.x, f.seitah.entryPoint.local.z - 200);
    expect(inZones(outside)).not.toContain('seitah');
    let r = drive(tr, [outside, seitahIn], []);
    expect(ids(r.u)).not.toContain('sand-crossing');
    r = drive(tr, [seitahIn, outside], [], {}, r.m);
    expect(ids(r.u)).toContain('sand-crossing');
  });
});

describe('validation of the new trigger shapes, per world', () => {
  const swap = (d: GameData, id: string, trigger: Milestone['trigger']): GameData => ({
    ...d, milestones: { milestones: d.milestones.milestones.map((m) => (m.id === id ? { ...m, trigger } : m)) },
  });

  it('accepts both worlds as they are', () => {
    expect(validateGameData(data)).toEqual([]);
    expect(validateGameData(loadGameData('moon'))).toEqual([]);
  });

  it('timed records are for switched instruments, the others for stations; events and photo targets the world has', () => {
    const moon = loadGameData('moon');
    expect([
      validateGameData(swap(moon, 'moonquake-record', { type: 'record', instrument: 'seismometer', event: 'quake', seconds: 5 })),
      validateGameData(swap(data, 'storm-log', { type: 'record', instrument: 'weather', event: 'duststorm' })),
      validateGameData(swap(moon, 'moonquake-record', { type: 'record', instrument: 'seismometer', event: 'duststorm' })),
      validateGameData(swap(moon, 'boulder-track', { type: 'photo', target: 'crater-wall' })),
      validateGameData(swap(moon, 'boulder-track', { type: 'photo', target: 'dustdevil' })),
      validateGameData(swap(data, 'long-profile', { type: 'transect', instrument: 'radar', meters: 500, sites: 2 })),
      validateGameData({ ...data, tuning: { ...data.tuning, milestones: { ...t, dustDevilPhotoRangeM: 0 } } }),
    ]).toEqual([
      ['milestone moonquake-record counts record seconds on seismometer, which is not switched on and off'],
      ['milestone storm-log records on weather, which is not a station (give it seconds)'],
      ['milestone moonquake-record waits for duststorm, which needs events.duststorm'],
      ['milestone boulder-track photographs crater-wall, which needs tuning.milestones.craterWallRimBand'],
      ['milestone boulder-track photographs dustdevil, which needs events.dustdevil'],
      ['milestone long-profile stages by zone (sites) but names no zone'],
      ['tuning.milestones.dustDevilPhotoRangeM must be a finite number above 0'],
    ]);
  });

  it('a delta-foot trigger needs deltaFootRadiusM', () => {
    const { deltaFootRadiusM: _, ...noFoot } = t;
    expect(validateGameData({ ...data, tuning: { ...data.tuning, milestones: noFoot } })).toEqual([
      'milestone ancient-lake names zone delta-foot, which needs tuning.milestones.deltaFootRadiusM',
      'milestone lake-organics names zone delta-foot, which needs tuning.milestones.deltaFootRadiusM',
      'milestone rock-from-afar names zone delta-foot, which needs tuning.milestones.deltaFootRadiusM',
    ]);
  });
});

describe('coverage', () => {
  it('all 28 Mars milestones fired somewhere in this file (the original eight here or in marsMilestones.test.ts)', () => {
    const tr = tracker({ ...carrying('camera', 'drill'), payload: ['instrument-camera', 'instrument-drill'] });
    ids(tr.land());
    ids(tr.step({ position: open, distanceM: 0, exploredShare: 0 }));
    ids(tr.step({ position: open, distanceM: 3000, exploredShare: 0.5, night: true }));
    ids(tr.step({ position: open, distanceM: 3000, exploredShare: 0.5, stormActive: true }));
    ids(tr.step({ position: open, distanceM: 3000, exploredShare: 0.5, stormActive: false }));
    const v = f.viewpoints.find((p) => p.kind === 'deltaLayers')!;
    ids(tr.photo(at(v.local.x, v.local.z), false, 0, { elevationDeg: 5, setting: true, inFrame: true }));
    ids(tr.drill(open));
    const missing = data.milestones.milestones.map((m) => m.id).filter((id) => !firedAnywhere.has(id));
    expect(missing).toEqual([]);
  });
});
