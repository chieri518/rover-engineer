// Mars milestones and survey (Phase M5): zones from the Mars terrain features, night driving, the dust
// storm, the sunset photo, staged samples, the survey leads, and the Moon-only behaviors staying off.
// Runs against the real Jezero terrain (public/terrain/mars/).
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import jezero from '../../public/terrain/mars/terrain.json';
import { buildZones, distanceToPath, MilestoneTracker, PHOTO_ZONE_IDS, zoneContains, type MilestoneFeatures, type Point3, type SunPhoto } from './milestones';
import { buildLeads, buildSites, discover, distanceToArea, leadBearing, nearestOnPath, type SurveyFeatures } from './survey';
import { selectedParts } from './rover';
import { validateGameData } from './validate';
import type { MarsTerrainFeatures } from './marsTypes';
import type { Build } from './types';

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
};
const zones = buildZones(features, t);
const zone = (id: string) => zones.find((z) => z.id === id)!;

const camera: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
};
const drill: Build = { ...camera, payload: ['instrument-drill'] };
const noLights: Build = { ...camera, lights: 'lights-none' };

function tracker(build: Build) {
  return new MilestoneTracker(data.milestones.milestones, selectedParts(build, data.parts), zones, t);
}
const at = (x: number, z: number, y = L.y): Point3 => ({ x, y, z });
const ids = (u: { reached: { milestone: { id: string } }[] }) => u.reached.map((r) => r.milestone.id);
const far = at(L.x + 1000, L.z); // 1 km east of the lander, in no zone

describe('Mars milestone data', () => {
  it('loads, validates, and replaces the Moon list', () => {
    expect(validateGameData(data)).toEqual([]);
    expect(data.milestones.milestones.map((m) => m.id)).toEqual([
      'mars-touchdown', 'mars-odometer', 'mars-mapper', 'night-drive', 'storm-survivor', 'delta-layers', 'core-sample', 'blue-sunset',
    ]);
  });

  it('every milestone has a real summary, fact and source (no placeholders)', () => {
    for (const m of data.milestones.milestones) {
      for (const s of [m.summary, m.fact, m.source ?? '']) {
        expect(s.length, m.id).toBeGreaterThan(10);
        expect(s, m.id).not.toMatch(/placeholder/i);
      }
    }
  });

  it('every zone a trigger names exists on the Mars map; no Moon-only triggers remain', () => {
    const known = new Set(zones.map((z) => z.id));
    for (const m of data.milestones.milestones) {
      const tr = m.trigger;
      if ((tr.type === 'photo' || tr.type === 'drill' || tr.type === 'zone') && tr.zone) expect(known.has(tr.zone as never), m.id).toBe(true);
      if (tr.type === 'photo') expect(tr.target).not.toBe('earth');
      expect(tr.type).not.toBe('event'); // flares and quakes stay on the Moon
    }
  });

  it('a decent run earns several times what idling at the lander earns', () => {
    const value = (id: string, stages = 1) => {
      const m = data.milestones.milestones.find((x) => x.id === id)!;
      return m.money * stages;
    };
    const idle = value('mars-touchdown') + value('storm-survivor');
    const camera = idle + value('mars-odometer', 2) + value('night-drive', 1) + value('delta-layers') + value('blue-sunset');
    const driller = idle + value('mars-odometer', 2) + value('mars-mapper') + value('core-sample', 3);
    expect(camera).toBeGreaterThan(2 * idle);
    expect(driller).toBeGreaterThan(2 * idle);
  });
});

describe('Mars zones', () => {
  it('builds the delta front, Séítah, both viewpoints, the boulder fields and the lander, and no Moon zones', () => {
    const got = new Set(zones.map((z) => z.id));
    for (const id of ['delta-front', 'seitah', 'delta-layers', 'sunset-viewpoint', 'boulder-field', 'near-lander']) expect(got.has(id as never), id).toBe(true);
    for (const id of ['large-crater', 'shadowed-crater', 'crater-wall', 'ice-spot', 'rim-viewpoint']) expect(got.has(id as never), id).toBe(false);
    expect(PHOTO_ZONE_IDS).toContain('delta-layers');
  });

  it('the delta front counts within its zone radius of the scarp line', () => {
    const z = zone('delta-front');
    const path = f.deltaFront.scarpLocal_xz;
    const r = f.deltaFront.zoneRadius_m;
    const [x0, z0] = path[3]!;
    expect(zoneContains(z, at(x0 + r - 5, z0))).toBe(true);
    expect(zoneContains(z, at(L.x, L.z))).toBe(false);
    // A point beyond the radius from every segment is outside (the scarp may bend back toward an offset point).
    const off = at(x0 + r + 60, z0);
    expect(zoneContains(z, off)).toBe(distanceToPath(path, off.x, off.z) <= r);
    expect(distanceToPath([[0, 0], [100, 0]], 50, 30)).toBeCloseTo(30);
    expect(zoneContains({ ...z, shape: { kind: 'path', points: [[0, 0], [100, 0]], r: 20 } }, at(50, 30))).toBe(false);
  });

  it('Séítah is its outline; the delta layers viewpoint is a photo-zone circle', () => {
    expect(zoneContains(zone('seitah'), at(f.seitah.centroidLocal.x, f.seitah.centroidLocal.z))).toBe(true);
    expect(zoneContains(zone('seitah'), at(L.x, L.z))).toBe(false);
    const v = f.viewpoints.find((p) => p.kind === 'deltaLayers')!;
    expect(zoneContains(zone('delta-layers'), at(v.local.x + t.photoZoneRadiusM - 1, v.local.z))).toBe(true);
    expect(zoneContains(zone('delta-layers'), at(v.local.x + t.photoZoneRadiusM + 1, v.local.z))).toBe(false);
  });
});

describe('Mars triggers', () => {
  it('Touchdown on landing', () => {
    expect(ids(tracker(camera).land())).toEqual(['mars-touchdown']);
  });

  it('Night drive counts only distance driven at night, one stage per threshold', () => {
    const tr = tracker(camera);
    const [first, second] = (data.milestones.milestones.find((m) => m.id === 'night-drive')!.trigger as { meters: number[] }).meters as [number, number];
    let d = 0;
    tr.step({ position: far, distanceM: d, exploredShare: 0 });
    d += 2 * second; // a long day drive does not count
    expect(ids(tr.step({ position: far, distanceM: d, exploredShare: 0, night: false }))).not.toContain('night-drive');
    d += first - 1;
    expect(ids(tr.step({ position: far, distanceM: d, exploredShare: 0, night: true }))).not.toContain('night-drive');
    d += 1;
    const u = tr.step({ position: far, distanceM: d, exploredShare: 0, night: true });
    expect(u.reached.filter((r) => r.milestone.id === 'night-drive').map((r) => r.stage)).toEqual([1]);
    expect(tr.nightDistanceM()).toBeCloseTo(first);
    d += second - first;
    expect(tr.step({ position: far, distanceM: d, exploredShare: 0, night: true }).reached.find((r) => r.milestone.id === 'night-drive')?.stage).toBe(2);
  });

  it('Night drive needs lights and a heater', () => {
    const tr = tracker(noLights);
    tr.step({ position: far, distanceM: 0, exploredShare: 0, night: true });
    const u = tr.step({ position: far, distanceM: 1000, exploredShare: 0, night: true });
    expect(ids(u)).not.toContain('night-drive');
    expect(u.missed.find((m) => m.milestone.id === 'night-drive')?.missing).toContain('lights');
  });

  it('Storm survivor fires once, when the storm clears with the rover still running', () => {
    const tr = tracker(camera);
    const s = (stormActive: boolean) => ids(tr.step({ position: far, distanceM: 0, exploredShare: 0, stormActive }));
    expect(s(false)).not.toContain('storm-survivor'); // forecast, not yet active
    expect(s(true)).not.toContain('storm-survivor');
    expect(s(true)).not.toContain('storm-survivor');
    expect(s(false)).toContain('storm-survivor');
    expect(s(true)).not.toContain('storm-survivor');
    expect(s(false)).not.toContain('storm-survivor'); // once
  });

  it('Storm survivor is not earned while the storm is still active at the end', () => {
    const tr = tracker(camera);
    tr.step({ position: far, distanceM: 0, exploredShare: 0, stormActive: true });
    expect(ids(tr.finish(true, {}))).toEqual([]);
    expect(tr.has('storm-survivor')).toBe(false);
  });

  it('Delta layers: a photo inside the delta layers viewpoint zone', () => {
    const tr = tracker(camera);
    const v = f.viewpoints.find((p) => p.kind === 'deltaLayers')!;
    expect(ids(tr.photo(far, false, 0))).toEqual([]);
    expect(ids(tr.photo(at(v.local.x, v.local.z), false, 0))).toEqual(['delta-layers']);
  });

  it('Core sample: up to three sites, 200 m from the lander and each other', () => {
    const tr = tracker(drill);
    expect(ids(tr.drill(at(L.x + 50, L.z)))).toEqual([]); // near the lander
    const a = tr.drill(at(L.x + 300, L.z));
    expect(a.reached.map((r) => [r.milestone.id, r.stage])).toEqual([['core-sample', 1]]);
    expect(ids(tr.drill(at(L.x + 350, L.z)))).toEqual([]); // same site
    expect(tr.drill(at(L.x + 600, L.z)).reached[0]?.stage).toBe(2);
    expect(tr.drill(at(L.x + 900, L.z)).reached[0]?.stage).toBe(3);
    expect(ids(tr.drill(at(L.x + 1200, L.z)))).toEqual([]);
  });
});

describe('Blue sunset', () => {
  const sun = (o: Partial<SunPhoto> = {}): SunPhoto => ({ elevationDeg: 5, setting: true, inFrame: true, ...o });
  const away = at(L.x + (t.sunsetPhotoMinDistanceM ?? 0) + 10, L.z);

  it('counts with the setting Sun low and in frame, away from the lander', () => {
    expect(ids(tracker(camera).photo(away, false, 0, sun()))).toEqual(['blue-sunset']);
  });

  it('says why it does not count', () => {
    const tr = tracker(camera);
    expect(tr.sunsetBlocker(away, sun({ inFrame: false }))).toBe('not-in-frame');
    expect(tr.sunsetBlocker(away, sun({ setting: false }))).toBe('not-setting'); // sunrise
    expect(tr.sunsetBlocker(away, sun({ elevationDeg: (t.sunsetMaxElevationDeg ?? 0) + 1 }))).toBe('too-high');
    expect(tr.sunsetBlocker(away, sun({ elevationDeg: -1 }))).toBe('too-low');
    expect(tr.sunsetBlocker(at(L.x + 10, L.z), sun())).toBe('too-close');
    expect(ids(tr.photo(at(L.x + 10, L.z), false, 0, sun()))).toEqual([]);
    expect(ids(tr.photo(away, false, 0))).toEqual([]); // no Sun given
  });

  it('needs a camera', () => {
    const u = tracker(drill).photo(away, false, 0, sun());
    expect(ids(u)).toEqual([]);
    expect(u.missed[0]?.missing).toEqual(['camera']);
  });

  it('the Moon tuning has no sunset photo', () => {
    const moon = loadGameData('moon');
    const tr = new MilestoneTracker(data.milestones.milestones, selectedParts(camera, data.parts), zones, moon.tuning.milestones);
    expect(tr.sunsetBlocker(away, sun())).toBe('not-in-frame');
  });
});

describe('Moon-only behaviors are off on Mars', () => {
  it('no Earth photo, no ice', () => {
    const tr = tracker(camera);
    expect(ids(tr.photo(far, true, 1))).toEqual([]); // Earth "in view" earns nothing on Mars
  });
});

describe('Mars survey', () => {
  const sf: SurveyFeatures = {
    rockyAreas: f.rockyAreas, deltaFront: f.deltaFront, seitah: f.seitah, viewpoints: f.viewpoints, perseveranceLanding: f.perseveranceLanding,
  };
  const sites = buildSites(sf, t, 'unused');
  const leads = buildLeads(sites, data.tuning.survey);
  const landing = { x: L.x, z: L.z };

  it('builds Mars sites: rocky areas, viewpoints, the delta front, Séítah and Perseverance', () => {
    expect(sites.map((s) => s.kind).sort()).toEqual(['delta-front', 'landmark', 'region', 'rocky-area', 'rocky-area', 'viewpoint', 'viewpoint']);
  });

  it('has three leads: the delta front, Séítah and the first rocky area, each with text', () => {
    expect(leads.map((l) => [l.id, l.site.key])).toEqual([['delta', 'deltaFront'], ['seitah', 'seitah'], ['rocks', f.rockyAreas[0]!.name]]);
    for (const l of leads) {
      expect(data.text.survey.leads[l.id]?.name, l.id).toBeTruthy();
      expect(data.text.survey.leads[l.id]?.source, l.id).toBeTruthy();
    }
  });

  it('no lead area is discovered at the landing; all are inside the play area', () => {
    const fresh = buildSites(sf, t, 'unused');
    discover(fresh, landing, data.tuning.explore.revealRadiusM);
    const leadKeys = new Set(leads.map((l) => l.site.key));
    expect(fresh.filter((s) => s.discovered && leadKeys.has(s.key))).toEqual([]);
    for (const l of leads) expect(leadBearing(l, landing, data.tuning.survey).distanceKm).toBeLessThan(4);
  });

  it('the delta front lead aims at the nearest point of the scarp, and is found at its zone edge', () => {
    const delta = leads.find((l) => l.id === 'delta')!;
    const area = delta.site.area;
    if (area.kind !== 'path') throw new Error('delta front is a path');
    const q = nearestOnPath(area.points, landing);
    const b = leadBearing(delta, landing, data.tuning.survey);
    const expectAz = ((Math.atan2(q.x - landing.x, -(q.z - landing.z)) * 180) / Math.PI + 360) % 360;
    expect(b.azimuth).toBeCloseTo(expectAz);
    expect(distanceToArea(area, landing)).toBeCloseTo(Math.hypot(q.x - landing.x, q.z - landing.z) - area.r);
    expect(distanceToArea(area, q)).toBe(0);
  });

  it('Perseverance\'s landing site is a landmark, found once the reveal circle reaches it', () => {
    const fresh = buildSites(sf, t, 'unused');
    const p = f.perseveranceLanding.local;
    const r = data.tuning.explore.revealRadiusM;
    expect(discover(fresh, { x: p.x + r + 5, z: p.z }, r).map((s) => s.kind)).not.toContain('landmark');
    expect(discover(fresh, { x: p.x + r - 5, z: p.z }, r).map((s) => s.kind)).toContain('landmark');
  });
});
