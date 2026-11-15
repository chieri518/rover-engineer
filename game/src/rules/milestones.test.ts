import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, MilestoneTracker, type MilestoneFeatures, type Point3 } from './milestones';
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
  lights: 'lights-led', heater: 'heater-rhu', instrument: 'instrument-camera',
};
const drill: Build = { ...camera, instrument: 'instrument-drill' };

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

  it('Photos: rim panorama and crater layers only in their viewpoint zones; Earth only when in view', () => {
    const tr = tracker(camera);
    expect(ids(tr.photo(at(L.x, L.z), false))).toEqual([]);
    const v = f.rimViewpoints[1]!.local;
    expect(ids(tr.photo(at(v.x + 20, v.z), false))).toEqual(['rim-panorama']);
    const d = f.craterDescent.local;
    expect(ids(tr.photo(at(d.x, d.z), false))).toEqual(['crater-layers']);
    expect(ids(tr.photo(at(L.x, L.z), true))).toEqual(['earth-on-horizon']);
    expect(ids(tracker(drill).photo(at(v.x, v.z), true))).toEqual([]);
  });

  it('Drill: regolith anywhere, water ice only at the ice candidate', () => {
    const tr = tracker(drill);
    expect(ids(tr.drill(at(L.x, L.z)))).toEqual(['regolith-sample']);
    const crater = f.shadowedCrater.centroidLocal;
    expect(ids(tr.drill(at(crater.x + 300, crater.z - 400)))).toEqual([]);
    const ice = f.shadowedCrater.iceCandidate.local;
    expect(ids(tr.drill(at(ice.x + 20, ice.z)))).toEqual(['water-ice']);
    expect(ids(tracker(drill).drill(at(ice.x, ice.z)))).toEqual(['regolith-sample', 'water-ice']);
    expect(ids(tracker(camera).drill(at(ice.x, ice.z)))).toEqual([]);
  });

  it('Flare survivor on a protected flare; Clean run only when surviving without damage', () => {
    const tr = tracker(camera);
    expect(ids(step(tr, at(L.x, L.z), 0, 0, true))).toEqual(['flare-survivor']);
    expect(ids(tracker(camera).finish(true, 0))).toEqual(['clean-run']);
    expect(ids(tracker(camera).finish(true, 3))).toEqual([]);
    expect(ids(tracker(camera).finish(false, 0))).toEqual([]);
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
