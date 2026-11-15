import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, hydrogenSignal, MilestoneTracker, zoneContains, type MilestoneFeatures, type Point3 } from './milestones';
import { selectedParts } from './rover';
import { finishMission, newCampaign, startRound } from './campaign';
import type { Build } from './types';

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
const zones = buildZones(features, t);
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
    const known = new Set(zones.map((z) => z.id));
    for (const m of data.milestones.milestones) {
      const tr = m.trigger;
      if ((tr.type === 'zone' || tr.type === 'photo' || tr.type === 'drill') && tr.zone) expect(known.has(tr.zone as never), m.id).toBe(true);
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
    expect(ids(tr.drill(at(v.x, v.z)))).toEqual(['regolith-sample']);
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

  it('Hydrogen signal: only in the dark crater, stronger nearer the ice, off with the tuning flag', () => {
    const ice = f.shadowedCrater.iceCandidate.local;
    const entry = f.shadowedCrater.entryPoint.local;
    const crater = f.shadowedCrater.centroidLocal;
    expect(hydrogenSignal(at(ice.x, ice.z), zones, t)).toBe('strong');
    expect(hydrogenSignal(at(ice.x + t.hydrogenStrongWithinM - 10, ice.z), zones, t)).toBe('strong');
    expect(hydrogenSignal(at(crater.x + 300, crater.z - 400), zones, t)).toBe('weak');
    expect(hydrogenSignal(at(L.x + 300, L.z), zones, t)).toBeNull(); // outside the dark crater: no reading
    // Just inside the edge where a rover enters, the signal is already above weak: a lead to follow.
    const inside = at(entry.x + 0.3 * (ice.x - entry.x), entry.z + 0.3 * (ice.z - entry.z));
    expect(zoneContains(zones.find((z) => z.id === 'shadowed-crater')!, inside)).toBe(true);
    expect(hydrogenSignal(inside, zones, t)).toBe('moderate');
    expect(hydrogenSignal(at(ice.x, ice.z), zones, { ...t, hydrogenSignal: false })).toBeNull();
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
