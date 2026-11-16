import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { coldZoneAnchor, resolveSite, resolveSites, type SiteFeatures } from './sites';
import type { SiteSpec } from './types';

const data = loadGameData();
const f = terrain.features;

describe('sites: where each sites.json site is', () => {
  it('every site resolves on the real terrain, the new places from the pipeline features (Phase 4)', () => {
    const sites = resolveSites(data.sites.sites, f);
    const by = (id: string) => sites.find((s) => s.id === id)!;
    expect(sites.map((s) => s.id)).toEqual(data.sites.sites.map((s) => s.id));
    // Cold traps: the pipeline's permanent-shadow outline.
    expect(by('east-cold-trap')).toMatchObject({ center: { x: -130, z: 120 } });
    expect(by('east-cold-trap').outline!.length).toBeGreaterThan(3);
    expect(by('south-cold-trap').center).toEqual({ x: -970, z: 900 });
    expect(by('rocky-area-1-cold-patch').outline!.length).toBeGreaterThan(3);
    // Young craters with their measured rim radius (East 45 m, not the provisional 28 m); SE crater replaces West.
    expect(by('nw-crater')).toMatchObject({ center: { x: -850, z: -220 }, radiusM: 75 });
    expect(by('east-crater')).toMatchObject({ center: { x: -240, z: -130 }, radiusM: 45 });
    expect(by('se-crater')).toMatchObject({ center: { x: 200, z: 685 }, radiusM: 40 });
    // The rolled boulder at the foot of its track, the track from the wall top; the hidden hydrogen at the patch's inner point.
    expect(by('rolled-boulder')).toMatchObject({ center: { x: -240, z: -125 }, track: { from: { x: -220, z: -35 }, to: { x: -240, z: -125 } } });
    expect(by('hidden-hydrogen').center).toEqual({ x: -1105, z: -400 });
    // Terrain features: the rocky area's circle, the dark crater's outline.
    const ra1 = f.rockyAreas[0]!;
    expect(sites.find((s) => s.id === 'rocky-area-1')).toMatchObject({ center: { x: ra1.local.x, z: ra1.local.z }, radiusM: ra1.radius_m });
    expect(sites.find((s) => s.id === 'dark-crater')!.outline).toHaveLength(f.shadowedCrater.outlineLocal_xz.length);
  });

  it('a pipeline feature wins over a local position, which wins over a terrain feature; nothing named resolves to null', () => {
    const features: SiteFeatures = {
      rockyAreas: [{ name: 'Rocky area 1', local: { x: 0, z: 0 }, radius_m: 200 }],
      coldTraps: [{ id: 'ct-1', centroidLocal: { x: 5, z: 6 }, outlineLocal_xz: [[0, 0], [10, 0], [10, 10]] }, { id: 'ct-2', centroidLocal: { x: 1, z: 1 }, area_m2: Math.PI * 400 }],
    };
    const base: SiteSpec = { id: 's', kind: 'cold-trap', name: 'S', feature: 'Rocky area 1', local: { x: 50, z: 50 }, radiusM: 10 };
    expect(resolveSite(base, features)).toMatchObject({ center: { x: 50, z: 50 }, radiusM: 10 });
    expect(resolveSite({ ...base, local: undefined }, features)).toMatchObject({ center: { x: 0, z: 0 }, radiusM: 200 });
    expect(resolveSite({ ...base, pipeline: { list: 'coldTraps', id: 'ct-1' } }, features)).toMatchObject({ center: { x: 5, z: 6 }, outline: [[0, 0], [10, 0], [10, 10]] });
    expect(resolveSite({ ...base, pipeline: { list: 'coldTraps', id: 'ct-2' } }, features)!.radiusM).toBeCloseTo(20);
    expect(resolveSite({ ...base, pipeline: { list: 'coldTraps', id: 'gone' } }, features)).toMatchObject({ center: { x: 50, z: 50 } }); // not produced yet: the candidate
    expect(resolveSite({ id: 'x', kind: 'cold-trap', name: 'X', feature: 'Nowhere' }, features)).toBeNull();
  });
});

describe('cold zones: what each tuning.cold.zones name anchors to', () => {
  it('terrain features anchor as before; the new cold traps anchor at their sites', () => {
    expect(coldZoneAnchor('shadowedCrater', f, data.sites.sites)).toEqual(f.shadowedCrater.centroidLocal);
    expect(coldZoneAnchor('Rocky area 1', f, data.sites.sites)).toEqual({ x: f.rockyAreas[0]!.local.x, z: f.rockyAreas[0]!.local.z });
    expect(coldZoneAnchor('East cold trap', f, data.sites.sites)).toEqual({ x: -130, z: 120 });
    expect(coldZoneAnchor('South cold trap', f, data.sites.sites)).toEqual({ x: -970, z: 900 });
    // A provisional cold trap anchors at its candidate position.
    const provisional: SiteSpec = { id: 'p', kind: 'cold-trap', name: 'East cold trap', provisional: true, local: { x: -132, z: 122 }, radiusM: 26 };
    expect(coldZoneAnchor('East cold trap', f, [provisional])).toEqual({ x: -132, z: 122 });
    // Without the sites the new cold traps anchor nowhere (why loadTerrainMasks requires them).
    expect(coldZoneAnchor('East cold trap', f, [])).toBeNull();
    expect(coldZoneAnchor('North cold trap', f, data.sites.sites)).toBeNull();
  });

  it('every cold zone in the data resolves on the real terrain', () => {
    for (const zone of data.tuning.cold.zones) expect(coldZoneAnchor(zone, f, data.sites.sites), zone).not.toBeNull();
  });
});

describe('rocky areas: sites.json and terrain.json agree', () => {
  it('every rocky-area site resolves to the center of one of the terrain\'s rockyAreas (within 1 m), as the mission\'s boulder sites and the survey assume', () => {
    // missionScreen tags each rocky area's boulders with the site at the same center (within 1 m), and the
    // world scatters them over masks.boulderAreas (circles(features.rockyAreas)); the survey matches by name.
    const rocky = resolveSites(data.sites.sites, f).filter((s) => s.kind === 'rocky-area');
    expect(rocky.length).toBeGreaterThan(0);
    for (const s of rocky) {
      const area = f.rockyAreas.find((a) => Math.hypot(a.local.x - s.center.x, a.local.z - s.center.z) <= 1);
      expect(area, s.id).toBeDefined();
      expect(area!.name, s.id).toBe(s.name);
    }
  });
});
