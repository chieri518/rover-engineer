import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, distanceToOutline, MilestoneTracker, ZONE_IDS, zoneContains, type MilestoneFeatures, type Point3 } from './milestones';
import { resolveSites } from './sites';
import { selectedParts } from './rover';
import { finishMission, newCampaign, startRound } from './campaign';
import type { Build, Milestone } from './types';

const data = loadGameData();
const t = data.tuning.milestones;
const f = terrain.features;
const features: MilestoneFeatures = {
  landing: terrain.landing.local,
  rimViewpoints: f.rimViewpoints,
  rockyAreas: f.rockyAreas,
  shadowedCrater: f.shadowedCrater as unknown as MilestoneFeatures['shadowedCrater'],
  craterDescent: f.craterDescent,
};
const sites = resolveSites(data.sites.sites, terrain.features);
const zones = buildZones(features, t, { sites, neutron: data.tuning.instruments.neutron });
const L = terrain.landing.local;

const camera: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
};
const drill: Build = { ...camera, payload: ['instrument-drill'] };

function tracker(build: Build) {
  return new MilestoneTracker(data.milestones.milestones, selectedParts(build, data.parts), zones, t);
}
const at = (x: number, z: number, y = L.y): Point3 => ({ x, y, z });
const ids = (u: { reached: { milestone: { id: string } }[] }) => u.reached.map((r) => r.milestone.id);
const step = (tr: MilestoneTracker, p: Point3, distanceM = 0, exploredShare = 0, flareSurvived = false) =>
  tr.step({ position: p, distanceM, exploredShare, flareSurvived });

describe('milestone data', () => {
  it('every zone a trigger names exists on the map, and every milestone has a summary, fact and source', () => {
    const known = new Set<string>(zones.map((z) => z.id));
    for (const m of data.milestones.milestones) {
      const tr = m.trigger;
      const zone = tr.type === 'zone' || tr.type === 'photo' || tr.type === 'drill' || tr.type === 'transect' || tr.type === 'reading' ? tr.zone : undefined;
      if (zone !== undefined) {
        expect((ZONE_IDS as readonly string[]).includes(zone), `${m.id} ${zone}`).toBe(true);
        expect(known.has(zone), `${m.id} ${zone}`).toBe(true);
      }
      expect(m.summary.length, m.id).toBeGreaterThan(0);
      expect(m.fact.length, m.id).toBeGreaterThan(0);
      expect(m.source?.length, m.id).toBeGreaterThan(0);
    }
  });

  it('the Mapper share is reachable: a 3 km drive of new ground reveals more than it', () => {
    const mapper = data.milestones.milestones.find((m) => m.id === 'mapper')!;
    if (mapper.trigger.type !== 'explore') throw new Error('mapper trigger');
    const r = data.tuning.explore.revealRadiusM / 1000;
    const shareAfter3km = (2 * r * 3 + Math.PI * r * r) / 64;
    expect(mapper.trigger.share).toBeLessThan(shareAfter3km);
    expect(mapper.trigger.share).toBeGreaterThan((2 * r * 1 + Math.PI * r * r) / 64); // not after 1 km
  });
});

describe('milestone triggers', () => {
  it('Touchdown on landing; Odometer per stage; Mapper at the share', () => {
    const tr = tracker(camera);
    expect(ids(tr.land())).toEqual(['touchdown']);
    expect(ids(step(tr, at(L.x, L.z), 600))).toEqual(['odometer']);
    const u = step(tr, at(L.x, L.z), 2100);
    expect(u.reached.map((r) => r.stage)).toEqual([2, 3]);
    expect(ids(step(tr, at(L.x, L.z), 2100, 0.5))).toEqual(['mapper']);
    expect(tr.result()).toContainEqual({ id: 'odometer', stages: 3 });
  });

  it('Crater descent: down de Gerlache inner wall and back out, not the north flank', () => {
    const tr = tracker(camera);
    const d = f.craterDescent.local;
    expect(ids(step(tr, at(d.x, d.z, L.y - 160)))).toEqual([]);
    expect(ids(step(tr, at(d.x, d.z, L.y - 120)))).toEqual([]); // still inside (hysteresis)
    expect(ids(step(tr, at(L.x, L.z, L.y - 50)))).toEqual(['crater-descent']);
    const north = tracker(camera);
    step(north, at(-600, -1200, L.y - 300));
    expect(ids(step(north, at(L.x, L.z)))).toEqual([]);
  });

  it('Boulder field counts only when the rover leaves on the far side', () => {
    const a = f.rockyAreas[0]!;
    const r = a.radius_m;
    const tr = tracker(camera);
    step(tr, at(a.local.x - r, a.local.z));
    expect(ids(step(tr, at(a.local.x - 2 * r, a.local.z)))).toEqual([]); // back out the same side
    step(tr, at(a.local.x - r, a.local.z));
    step(tr, at(a.local.x, a.local.z + r));
    expect(ids(step(tr, at(a.local.x + 2 * r, a.local.z)))).toEqual(['boulder-field']);
  });

  it('Leaving a boulder field without crossing it gives one partial-crossing hint per field, until Boulder field is earned', () => {
    const a = f.rockyAreas[0]!;
    const r = a.radius_m;
    const tr = tracker(camera);
    step(tr, at(a.local.x - r, a.local.z));
    const first = step(tr, at(a.local.x - 2 * r, a.local.z)); // back out the same side
    expect(first.partialCrossings.map((z) => z.id)).toEqual(['boulder-field']);
    step(tr, at(a.local.x - r, a.local.z));
    expect(step(tr, at(a.local.x - 2 * r, a.local.z)).partialCrossings).toEqual([]); // once per field
    // a real crossing counts and gives no hint
    step(tr, at(a.local.x - r, a.local.z));
    const done = step(tr, at(a.local.x + 2 * r, a.local.z));
    expect(ids(done)).toEqual(['boulder-field']);
    expect(done.partialCrossings).toEqual([]);
    // once earned, a later partial pass in another field stays silent
    if (f.rockyAreas[1]) {
      const b = f.rockyAreas[1];
      step(tr, at(b.local.x - b.radius_m, b.local.z));
      expect(step(tr, at(b.local.x - 2 * b.radius_m, b.local.z)).partialCrossings).toEqual([]);
    }
  });

  it('The partial-crossing hint can be switched off in tuning', () => {
    const off = { ...t, partialCrossingHint: false };
    const a = f.rockyAreas[0]!;
    const tr = new MilestoneTracker(data.milestones.milestones, selectedParts(camera, data.parts), zones, off);
    step(tr, at(a.local.x - a.radius_m, a.local.z));
    expect(step(tr, at(a.local.x - 2 * a.radius_m, a.local.z)).partialCrossings).toEqual([]);
  });

  it('Into the dark needs lights and a heater; without them it is reported as not credited', () => {
    const c = f.shadowedCrater.iceCandidate.local;
    const tr = tracker(camera);
    step(tr, at(c.x, c.z));
    expect(ids(step(tr, at(L.x, L.z)))).toEqual(['into-the-dark']);
    const cold = tracker({ ...camera, heater: 'heater-none' });
    step(cold, at(c.x, c.z));
    const u = step(cold, at(L.x, L.z));
    expect(ids(u)).toEqual([]);
    expect(u.missed.map((m) => [m.milestone.id, m.missing])).toEqual([['into-the-dark', ['heater']]]);
  });

  it('Photos: rim panorama and crater layers only in their viewpoint zones; Earth only when in view and lit enough', () => {
    const tr = tracker(camera);
    expect(ids(tr.photo(at(L.x, L.z), false, 1))).toEqual([]);
    const v = f.rimViewpoints[1]!.local;
    expect(ids(tr.photo(at(v.x + 20, v.z), false, 1))).toEqual(['rim-panorama']);
    const d = f.craterDescent.local;
    expect(ids(tr.photo(at(d.x, d.z), false, 1))).toEqual(['crater-layers']);
    // A dark new Earth does not count, even in view.
    const far = data.tuning.milestones.earthPhotoMinDistanceM;
    expect(ids(tr.photo(at(L.x, L.z - far + 1), true, 1))).toEqual([]); // too close to the lander
    expect(tr.earthPhotoTooClose(at(L.x, L.z - far + 1))).toBe(true);
    expect(ids(tr.photo(at(L.x, L.z - far), true, data.tuning.milestones.earthPhotoMinLit - 0.01))).toEqual([]);
    expect(ids(tr.photo(at(L.x, L.z - far), true, data.tuning.milestones.earthPhotoMinLit))).toEqual(['earth-on-horizon']);
    expect(ids(tracker(drill).photo(at(v.x, v.z), true, 1))).toEqual([]);
  });

  it('Drill: regolith away from the lander, water ice only at the hidden ice spot', () => {
    const tr = tracker(drill);
    const min = data.tuning.milestones.sampleMinDistanceM;
    expect(ids(tr.drill(at(L.x, L.z)))).toEqual([]); // no free sample at the lander
    expect(ids(tr.drill(at(L.x + min - 5, L.z)))).toEqual([]);
    expect(ids(tr.drill(at(L.x + min + 5, L.z)))).toEqual(['regolith-sample']);
    // Regolith samples are staged by site: a new site must be sampleSpacingM from earlier ones.
    const spacing = data.tuning.milestones.sampleSpacingM;
    expect(tr.sampleTooClose(at(L.x + min + 5 + spacing - 1, L.z))).toBe(true);
    expect(tr.drill(at(L.x + min + 5 + spacing - 1, L.z)).reached).toEqual([]);
    const second = tr.drill(at(L.x + min + 5 + spacing, L.z)).reached;
    expect(second.map((r) => [r.milestone.id, r.stage, r.stages])).toEqual([['regolith-sample', 2, 3]]);
    const crater = f.shadowedCrater.centroidLocal;
    expect(ids(tr.drill(at(crater.x + 300, crater.z - 400)))).toEqual(['regolith-sample']); // third site
    const ice = f.shadowedCrater.iceCandidate.local;
    expect(ids(tr.drill(at(ice.x + 20, ice.z)))).toEqual(['water-ice']); // all three sites already counted
    expect(ids(tracker(drill).drill(at(ice.x, ice.z)))).toEqual(['regolith-sample', 'water-ice']);
    expect(ids(tracker(camera).drill(at(ice.x, ice.z)))).toEqual([]);
    expect(tr.result().find((e) => e.id === 'regolith-sample')).toEqual({ id: 'regolith-sample', stages: 3 });
  });

  it('a steel rover carrying the camera and the drill earns a photo and a sample in the same mission', () => {
    const both: Build = { ...camera, chassis: 'chassis-steel', payload: ['instrument-camera', 'instrument-drill'] };
    const tr = tracker(both);
    const v = f.rimViewpoints[0]!.local;
    step(tr, at(v.x, v.z));
    expect(ids(tr.photo(at(v.x, v.z), false, 0))).toEqual(['rim-panorama']);
    // Rim viewpoint 1 lies inside Rocky area 1's ejecta ring (1.5 x its 200 m radius), so it is fresh ejecta too.
    expect(ids(tr.drill(at(v.x, v.z)))).toEqual(['regolith-sample', 'fresh-ejecta-sample']);
  });

  it('the ice spot is small and lies just inside the dark crater, on the side facing the landing', () => {
    const sc = f.shadowedCrater;
    const ice = sc.iceCandidate.local;
    const r = data.tuning.milestones.iceSpotRadiusM;
    const zone = zones.find((z) => z.id === 'shadowed-crater')!;
    // The whole ice zone is inside the permanent-shadow outline.
    for (let a = 0; a < 360; a += 15) {
      const p = at(ice.x + r * Math.cos((a * Math.PI) / 180), ice.z + r * Math.sin((a * Math.PI) / 180));
      expect(zoneContains(zone, p)).toBe(true);
    }
    // Most of the crater is dry: the ice zone is under 2% of its area.
    expect((Math.PI * r * r) / (sc.area_km2 * 1e6)).toBeLessThan(0.02);
    // Near side: closer to the landing than the crater's centroid, 100-200 m inside the shadow edge.
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - L.x, p.z - L.z);
    expect(dist(ice)).toBeLessThan(dist(sc.centroidLocal));
    expect(sc.iceCandidate.depthInsideShadow_m).toBeGreaterThanOrEqual(100);
    expect(sc.iceCandidate.depthInsideShadow_m).toBeLessThanOrEqual(200);
  });

  it('Flare survivor on a protected flare; Clean run only when surviving without damage', () => {
    const tr = tracker(camera);
    expect(ids(step(tr, at(L.x, L.z), 0, 0, true))).toEqual(['flare-survivor']);
    expect(ids(tracker(camera).finish(true, { impact: 0, quake: 10 }))).toEqual(['clean-run']); // quakes cannot be avoided
    expect(ids(tracker(camera).finish(true, { impact: 3, quake: 10 }))).toEqual([]);
    expect(ids(tracker(camera).finish(true, { flare: 1 }))).toEqual([]);
    expect(ids(tracker(camera).finish(false, {}))).toEqual([]);
  });

  it('Water ice is a record: paid once per campaign', () => {
    let s = startRound(newCampaign(data.tuning));
    const result = { survived: true, secondsLasted: 300, earned: [{ id: 'water-ice' }, { id: 'regolith-sample' }] };
    const first = finishMission(s, result, data);
    expect(first.payout.newRecords).toEqual(['water-ice']);
    s = startRound(first.state);
    const second = finishMission(s, result, data);
    expect(second.payout.milestones.map((p) => p.milestone.id)).toEqual(['regolith-sample']);
  });
});

// ---------------------------------------------------------------------------------------------------
// Moon sites and milestones (Phase 3): the site zones and the shared instrument triggers.

const site = (id: string) => sites.find((s) => s.id === id)!;
const zone = (key: string) => zones.find((z) => z.key === key)!;
const toward = (from: { x: number; z: number }, to: { x: number; z: number }, m: number) => {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  return { x: from.x + ((to.x - from.x) / d) * m, z: from.z + ((to.z - from.z) / d) * m };
};
/** A point m meters from a site's center, on the side away from the lander. */
const out = (id: string, m: number) => {
  const c = site(id).center;
  const p = toward(c, { x: 2 * c.x - L.x, z: 2 * c.z - L.z }, m);
  return at(p.x, p.z);
};
const xray: Build = { ...camera, payload: ['instrument-xray'] };
const neutron: Build = { ...camera, payload: ['instrument-neutron'] };
const docs: Build = { ...camera, chassis: 'chassis-steel', payload: ['instrument-camera', 'instrument-xray'] };
const stations: Build = { ...camera, chassis: 'chassis-steel', payload: ['instrument-seismometer', 'instrument-reflector'] };
const nt = data.tuning.instruments.neutron;

/** The East cold trap's westernmost outline point (its zone is the pipeline's polygon plus the edge). */
const eastWest = (): [number, number] => {
  const s = zone('cold-trap:east-cold-trap').shape;
  if (s.kind !== 'polygon') throw new Error('East cold trap should be the pipeline outline');
  return s.points.reduce((a, q) => (q[0] < a[0] ? q : a));
};

describe('site zones: membership at the edges', () => {
  it('builds one zone per site: cold traps, ejecta rings, the hidden hydrogen and the ice signal', () => {
    const keys = (id: string) => zones.filter((z) => z.id === id).map((z) => z.key);
    expect(keys('cold-trap')).toEqual(['cold-trap:rocky-area-1-cold-patch', 'cold-trap:east-cold-trap', 'cold-trap:south-cold-trap', 'cold-trap:dark-crater']);
    expect(keys('young-crater')).toEqual(['young-crater:rocky-area-1', 'young-crater:rocky-area-2', 'young-crater:nw-crater', 'young-crater:east-crater', 'young-crater:se-crater']);
    expect(keys('hydrogen-anomaly')).toEqual(['hydrogen-anomaly:hidden-hydrogen']);
    expect(keys('ice-signal')).toEqual(['ice-signal']);
    // Mars and the old callers: no sites, no site zones.
    expect(buildZones(features, t).some((z) => z.site !== undefined || z.id === 'ice-signal')).toBe(false);
  });

  it('a cold trap is its outline plus the survey edge', () => {
    // The pipeline's outline; due west of its westernmost point the distance to the outline is exact.
    const z = zone('cold-trap:east-cold-trap');
    const [wx, wz] = eastWest();
    expect(zoneContains(z, at(wx - t.coldTrapEdgeM + 0.1, wz))).toBe(true);
    expect(zoneContains(z, at(wx - t.coldTrapEdgeM - 0.1, wz))).toBe(false);
    const c = site('east-cold-trap').center;
    expect(distanceToOutline(z, at(c.x, c.z))).toBe(0);
    expect(distanceToOutline(z, at(wx - 10, wz))).toBeCloseTo(10);
  });

  it('the dark crater counts as a cold trap: its permanent-shadow outline plus the edge', () => {
    const z = zone('cold-trap:dark-crater');
    const c = f.shadowedCrater.centroidLocal;
    const [vx, vz] = f.shadowedCrater.outlineLocal_xz[0]! as [number, number];
    let inside = 0, outside = 0;
    for (let m = 0; m <= 60; m += 2) {
      const q = toward({ x: vx, z: vz }, { x: 2 * vx - c.x, z: 2 * vz - c.z }, m);
      const p = at(q.x, q.z);
      const near = distanceToOutline(z, p) <= t.coldTrapEdgeM;
      expect(zoneContains(z, p), `${m} m out`).toBe(near);
      if (near) inside++; else outside++;
    }
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
    expect(zoneContains(z, at(c.x, c.z))).toBe(true);
  });

  it('the young-crater zone is the ejecta ring: 1.5 times the radius of a young crater or rocky area', () => {
    for (const id of ['east-crater', 'nw-crater', 'rocky-area-1']) {
      const r = site(id).radiusM! * t.youngCraterEjectaFactor;
      expect(zoneContains(zone(`young-crater:${id}`), out(id, r - 0.1)), id).toBe(true);
      expect(zoneContains(zone(`young-crater:${id}`), out(id, r + 0.1)), id).toBe(false);
    }
  });

  it('the hidden hydrogen zone is a circle of hydrogenZoneRadiusM; the ice signal lies inside the dark crater', () => {
    const h = zone('hydrogen-anomaly:hidden-hydrogen');
    expect(zoneContains(h, out('hidden-hydrogen', t.hydrogenZoneRadiusM - 0.1))).toBe(true);
    expect(zoneContains(h, out('hidden-hydrogen', t.hydrogenZoneRadiusM + 0.1))).toBe(false);
    const ice = zone('ice-signal');
    const r = (1 - nt.iceSignalShare) * nt.iceRangeM;
    expect(ice.shape.kind === 'circle' && ice.shape.r).toBeCloseTo(r);
    const crater = zones.find((z) => z.id === 'shadowed-crater')!;
    const spot = f.shadowedCrater.iceCandidate.local;
    for (let a = 0; a < 360; a += 10) {
      const p = at(spot.x + r * Math.cos((a * Math.PI) / 180), spot.z + r * Math.sin((a * Math.PI) / 180));
      expect(zoneContains(crater, p), `${a} deg`).toBe(true);
    }
  });
});

/** Drive in a straight line in 5 m steps from a to b with the given standby list, from a running odometer. */
function drive(tr: MilestoneTracker, a: Point3, b: Point3, odo: { m: number }, opts: { on?: ('neutron')[]; poweredDown?: boolean } = {}) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(len / 5));
  const reached: string[] = [];
  const missed: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = at(a.x + ((b.x - a.x) * i) / steps, a.z + ((b.z - a.z) * i) / steps);
    if (i > 0 && !opts.poweredDown) odo.m += len / steps;
    const u = tr.step({ position: p, distanceM: odo.m, exploredShare: 0, switchedOn: opts.on ?? [], poweredDown: opts.poweredDown });
    reached.push(...u.reached.map((r) => r.milestone.id));
    missed.push(...u.missed.map((r) => r.milestone.id));
  }
  return { reached, missed };
}

describe('transect: an unbroken switched-on drive that touches the zone', () => {
  const [wx, wz] = eastWest();
  const edge = t.coldTrapEdgeM;
  // A north-south line 15 m west of the East cold trap's westernmost point: 10 m inside the zone edge there.
  const pass = (from: number, to: number) => [at(wx - (edge - 10), wz + from), at(wx - (edge - 10), wz + to)] as const;

  it('Cold trap survey: 50 m switched on, passing within the edge, counts once the drive reaches 50 m', () => {
    const tr = tracker(neutron);
    const odo = { m: 0 };
    tr.step({ position: pass(-20, 0)[0], distanceM: 0, exploredShare: 0, switchedOn: ['neutron'] });
    expect(drive(tr, ...pass(-20, 25), odo, { on: ['neutron'] }).reached).toEqual([]); // 45 m: not yet
    expect(drive(tr, ...pass(25, 35), odo, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']);
    expect(tr.result()).toContainEqual({ id: 'cold-trap-survey' });
  });

  it('does not count switched off, nor a drive that never touches the zone', () => {
    const off = tracker(neutron);
    expect(drive(off, ...pass(-50, 60), { m: 0 }).reached).toEqual([]);
    const far = tracker(neutron);
    expect(drive(far, at(wx - edge - 5, wz - 50), at(wx - edge - 5, wz + 60), { m: 0 }, { on: ['neutron'] }).reached).toEqual([]);
    expect(drive(tracker(camera), ...pass(-50, 60), { m: 0 }, { on: ['neutron'] }).reached).toEqual([]); // no spectrometer, no milestone
  });

  it('switching off starts the count again; a power-down only pauses it', () => {
    const tr = tracker(neutron);
    const odo = { m: 0 };
    drive(tr, ...pass(-10, 20), odo, { on: ['neutron'] }); // 30 m, through the zone
    drive(tr, ...pass(20, 30), odo); // switched off
    expect(drive(tr, ...pass(30, 0), odo, { on: ['neutron'] }).reached).toEqual([]); // 30 m since, back through the zone: not yet
    expect(drive(tr, ...pass(0, -25), odo, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']); // 55 m

    const paused = tracker(neutron);
    const o2 = { m: 0 };
    drive(paused, ...pass(-10, 20), o2, { on: ['neutron'] }); // 30 m
    drive(paused, pass(20, 20)[0], pass(20, 20)[0], o2, { poweredDown: true }); // a flare: powered down
    expect(drive(paused, ...pass(20, 45), o2, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']); // 55 m in all

    // Powered down with the spectrometer still switched on (state.standbyOn keeps it): the count pauses
    // and is kept, it neither grows nor starts again.
    const on = tracker(neutron);
    const o3 = { m: 0 };
    drive(on, ...pass(-10, 20), o3, { on: ['neutron'] }); // 30 m, through the zone
    expect(drive(on, ...pass(20, 60), o3, { on: ['neutron'], poweredDown: true }).reached).toEqual([]); // paused: the odometer does not move
    expect(drive(on, ...pass(60, 75), o3, { on: ['neutron'] }).reached).toEqual([]); // 45 m: not yet
    expect(drive(on, ...pass(75, 85), o3, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']); // 55 m
  });

  it('stages by distinct cold trap: the same one twice is one stage, a second one is stage 2', () => {
    const tr = tracker(neutron);
    const odo = { m: 0 };
    expect(drive(tr, ...pass(-40, 40), odo, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']);
    expect(drive(tr, ...pass(40, -40), odo, { on: ['neutron'] }).reached).toEqual([]);
    const south = site('south-cold-trap').center;
    drive(tr, pass(-40, -40)[0], at(south.x - 60, south.z), odo);
    const u = drive(tr, at(south.x - 60, south.z), at(south.x + 60, south.z), odo, { on: ['neutron'] });
    expect(u.reached).toEqual(['cold-trap-survey']);
    expect(tr.result()).toContainEqual({ id: 'cold-trap-survey', stages: 2 });
  });

  it('Hidden hydrogen: a 30 m switched-on drive through its zone', () => {
    const h = site('hidden-hydrogen').center;
    const r = t.hydrogenZoneRadiusM;
    const tr = tracker(neutron);
    expect(drive(tr, at(h.x - r - 40, h.z), at(h.x - r - 5, h.z), { m: 0 }, { on: ['neutron'] }).reached).toEqual([]); // outside
    expect(drive(tracker(neutron), at(h.x - r - 20, h.z), at(h.x - r + 15, h.z), { m: 0 }, { on: ['neutron'] }).reached).toEqual(['hidden-hydrogen']);
  });

  it('Ice deposit located: switched on in the ice signal zone, and it needs lights (a missed notice without them)', () => {
    const spot = f.shadowedCrater.iceCandidate.local;
    const a = at(spot.x - 30, spot.z), b = at(spot.x + 30, spot.z);
    expect(drive(tracker(neutron), a, b, { m: 0 }, { on: ['neutron'] }).reached).toContain('ice-deposit-located');
    const dark = tracker({ ...neutron, lights: 'lights-none' });
    const u = drive(dark, a, b, { m: 0 }, { on: ['neutron'] });
    expect(u.reached).not.toContain('ice-deposit-located');
    expect(u.missed).toContain('ice-deposit-located');
    // Elsewhere in the dark crater, away from the ice: only the cold trap.
    const c = f.shadowedCrater.centroidLocal;
    expect(drive(tracker(neutron), at(c.x - 30, c.z), at(c.x + 30, c.z), { m: 0 }, { on: ['neutron'] }).reached).toEqual(['cold-trap-survey']);
  });
});

describe('reading: X-ray rock types', () => {
  const p = out('east-crater', 0);
  it('Rock collection stages at 2, 3 and 4 distinct rock types; a repeated type adds nothing', () => {
    const tr = tracker(xray);
    expect(ids(tr.reading('xray', p, { rock: 'ferroan-anorthosite', boulder: 1 }))).toEqual([]);
    expect(ids(tr.reading('xray', p, { rock: 'ferroan-anorthosite', boulder: 2 }))).toEqual([]);
    expect(tr.reading('xray', p, { rock: 'noritic-anorthosite', boulder: 3 }).reached.map((r) => r.stage)).toEqual([1]);
    expect(tr.reading('xray', p, { rock: 'regolith-breccia', boulder: 4 }).reached.map((r) => r.stage)).toEqual([2]);
    expect(tr.reading('xray', p, { rock: 'impact-melt-breccia', boulder: 5 }).reached.map((r) => [r.milestone.id, r.stage])).toEqual([['rock-collection', 3]]);
    expect(tr.result()).toContainEqual({ id: 'rock-collection', stages: 3 });
  });

  it('Rare rock: only a magnesian norite reading; only the X-ray spectrometer reads', () => {
    const tr = tracker(xray);
    expect(ids(tr.reading('xray', p, { rock: 'noritic-anorthosite' }))).toEqual([]);
    expect(ids(tr.reading('xray', p, { rock: 'magnesian-norite' }))).toEqual(['rock-collection', 'rare-rock']);
    expect(ids(tracker(xray).reading('camera', p, { rock: 'magnesian-norite' }))).toEqual([]);
  });

  it('target and site staging are world-neutral (Mars readings reuse them)', () => {
    const m = (trigger: Milestone['trigger']): Milestone => ({ id: 'r', name: 'r', category: 'scientific', record: false, trigger, requires: { instrument: 'xray' }, money: 1, rp: 1, summary: '', fact: '' });
    const parts = selectedParts(xray, data.parts);
    const cliff = new MilestoneTracker([m({ type: 'reading', instrument: 'xray', target: 'cliff' })], parts, zones, t);
    expect(ids(cliff.reading('xray', p, { target: 'boulder' }))).toEqual([]);
    expect(ids(cliff.reading('xray', p, { target: 'cliff' }))).toEqual(['r']);
    const staged = new MilestoneTracker([m({ type: 'reading', instrument: 'xray', sites: 2 })], parts, zones, t);
    expect(ids(staged.reading('xray', p))).toEqual(['r']);
    expect(ids(staged.reading('xray', at(p.x + t.sampleSpacingM - 1, p.z)))).toEqual([]);
    expect(staged.reading('xray', at(p.x + t.sampleSpacingM, p.z)).reached.map((r) => r.stage)).toEqual([2]);
    const inZone = new MilestoneTracker([m({ type: 'reading', instrument: 'xray', zone: 'young-crater' })], parts, zones, t);
    expect(ids(inZone.reading('xray', at(L.x, L.z)))).toEqual([]);
    expect(ids(inZone.reading('xray', p))).toEqual(['r']);
  });
});

describe('photo: the rolled boulder and read boulders', () => {
  const rb = site('rolled-boulder').center;
  const rolled = { index: 99, x: rb.x, z: rb.z, rolled: true };
  const from = (m: number) => at(rb.x, rb.z + m);

  it('Boulder track: the rolled boulder in frame from within 80 m', () => {
    const range = t.boulderTrackPhotoRangeM;
    expect(ids(tracker(camera).photo(from(range), false, 0, undefined, [rolled]))).toEqual(['boulder-track']);
    expect(ids(tracker(camera).photo(from(range + 1), false, 0, undefined, [rolled]))).toEqual([]);
    expect(ids(tracker(camera).photo(from(10), false, 0, undefined, []))).toEqual([]); // not in frame
    expect(ids(tracker(camera).photo(from(10), false, 0, undefined, [{ ...rolled, rolled: false }]))).toEqual([]);
  });

  it('Documented sample: a boulder read this mission, in frame from within 15 m; it needs the camera and the X-ray', () => {
    const b = { index: 7, x: rb.x + 200, z: rb.z };
    const range = t.documentedSampleRangeM;
    const tr = tracker(docs);
    expect(ids(tr.photo(at(b.x, b.z + range), false, 0, undefined, [b]))).toEqual([]); // not read yet
    tr.reading('xray', at(b.x, b.z), { rock: 'noritic-anorthosite', boulder: 7 });
    expect(tr.wasRead(7)).toBe(true);
    expect(ids(tr.photo(at(b.x, b.z + range + 1), false, 0, undefined, [b]))).toEqual([]);
    expect(ids(tr.photo(at(b.x, b.z + range), false, 0, undefined, [b]))).toEqual(['documented-sample']);
    // One photo of the read rolled boulder earns both.
    const both = tracker(docs);
    both.reading('xray', at(rb.x, rb.z), { rock: 'magnesian-norite', boulder: 99 });
    expect(ids(both.photo(from(10), false, 0, undefined, [rolled]))).toEqual(['boulder-track', 'documented-sample']);
    // A camera-only rover is not credited and is told the X-ray spectrometer was missing.
    const solo = tracker(camera);
    solo.reading('xray', at(b.x, b.z), { boulder: 7 });
    const u = solo.photo(at(b.x, b.z + 5), false, 0, undefined, [b]);
    expect(ids(u)).toEqual([]);
    expect(u.missed.map((m) => [m.milestone.id, m.missing])).toEqual([['documented-sample', ['xray']]]);
  });
});

describe('drill: Fresh ejecta sample in a young crater ring', () => {
  it('counts inside a young crater or rocky area ring, with a Regolith site from the same sample', () => {
    const r = site('east-crater').radiusM! * t.youngCraterEjectaFactor;
    expect(ids(tracker(drill).drill(out('east-crater', r - 1)))).toEqual(['regolith-sample', 'fresh-ejecta-sample']);
    expect(ids(tracker(drill).drill(out('east-crater', r + 1)))).toEqual(['regolith-sample']);
    const a = f.rockyAreas[0]!;
    expect(ids(tracker(drill).drill(at(a.local.x, a.local.z)))).toEqual(['regolith-sample', 'fresh-ejecta-sample']);
  });

  it('not within the near-lander zone, even inside a ring', () => {
    const fake = buildZones(features, t, { sites: [{ ...site('east-crater'), center: { x: L.x + 150, z: L.z }, radiusM: 60 }] });
    const tr = new MilestoneTracker(data.milestones.milestones, selectedParts(drill, data.parts), fake, t);
    expect(ids(tr.drill(at(L.x + 150, L.z)))).toEqual([]);
    expect(ids(tr.drill(at(L.x + 230, L.z)))).toEqual(['regolith-sample', 'fresh-ejecta-sample']);
  });
});

describe('record and deploy: the stations', () => {
  const minM = t.sampleMinDistanceM;
  const away = { x: L.x + minM + 50, z: L.z };
  const near = { x: L.x + minM - 1, z: L.z };

  it('Moonquake record for any record of a station outside the near-lander zone; Clean seismogram only when clean', () => {
    expect(ids(tracker(stations).record('seismometer', 'quake', 'clean', away))).toEqual(['moonquake-record', 'clean-seismogram']);
    expect(ids(tracker(stations).record('seismometer', 'quake', 'noisy', away))).toEqual(['moonquake-record']);
    expect(ids(tracker(stations).record('seismometer', 'quake', 'clean', near))).toEqual([]);
    expect(ids(tracker(stations).record('seismometer', 'duststorm', 'clean', away))).toEqual([]);
    // An instrument aboard (no station position, as on Mars) has no near-lander rule.
    expect(ids(tracker(stations).record('seismometer', 'quake', 'clean'))).toEqual(['moonquake-record', 'clean-seismogram']);
  });

  it('Laser ranging site: the reflector set down outside the near-lander zone with Earth in view', () => {
    expect(ids(tracker(stations).deploy('reflector', away, true))).toEqual(['laser-ranging-site']);
    expect(ids(tracker(stations).deploy('reflector', away, false))).toEqual([]);
    expect(ids(tracker(stations).deploy('reflector', near, true))).toEqual([]);
    expect(ids(tracker(stations).deploy('seismometer', away, true))).toEqual([]);
  });

  it('Science station fires when the second station goes down, in either order, within 100 m, both outside', () => {
    const tr = tracker(stations);
    expect(ids(tr.deploy('seismometer', away, false))).toEqual([]);
    expect(ids(tr.deploy('reflector', { x: away.x, z: away.z + 100 }, true))).toEqual(['laser-ranging-site', 'science-station']);
    const reverse = tracker(stations);
    expect(ids(reverse.deploy('reflector', away, true))).toEqual(['laser-ranging-site']);
    expect(ids(reverse.deploy('seismometer', { x: away.x + 60, z: away.z }, false))).toEqual(['science-station']);
    const apart = tracker(stations);
    apart.deploy('seismometer', away, true);
    expect(ids(apart.deploy('reflector', { x: away.x, z: away.z + 101 }, true))).toEqual(['laser-ranging-site']);
    const close = tracker(stations);
    close.deploy('seismometer', near, true); // too close to the lander to count
    expect(ids(close.deploy('reflector', { x: near.x + 90, z: near.z }, true))).toEqual(['laser-ranging-site']);
  });

  it('only the first deploy of a station counts: a station set down near the lander blocks its milestones', () => {
    // A station cannot be picked up again, so the tracker keeps the first place it went down; a repeat
    // call (which the mission never makes) is ignored rather than moving it.
    const tr = tracker(stations);
    expect(ids(tr.deploy('reflector', near, true))).toEqual([]); // inside the near-lander zone
    expect(ids(tr.deploy('reflector', away, true))).toEqual([]); // the repeat does not move it out
    expect(ids(tr.deploy('seismometer', { x: near.x + 50, z: near.z }, false))).toEqual([]); // the pair needs the reflector outside too
    const first = tracker(stations);
    expect(ids(first.deploy('reflector', away, true))).toEqual(['laser-ranging-site']);
    expect(ids(first.deploy('reflector', near, true))).toEqual([]); // already earned; the repeat changes nothing
    expect(ids(first.deploy('seismometer', { x: away.x + 50, z: away.z }, false))).toEqual(['science-station']); // still outside, from the first deploy
  });

  it('a rover missing one station is not credited for the pair, and is told which part was missing', () => {
    const solo = tracker({ ...stations, payload: ['instrument-reflector'] });
    solo.deploy('seismometer', away, false); // as if a seismometer were down (the mission never lets this happen)
    const u = solo.deploy('reflector', { x: away.x, z: away.z + 10 }, true);
    expect(ids(u)).toEqual(['laser-ranging-site']);
    expect(u.missed.map((m) => [m.milestone.id, m.missing])).toEqual([['science-station', ['seismometer']]]);
  });
});
