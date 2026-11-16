import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { coldZoneAnchor, resolveSite, resolveSites, type SiteFeatures } from './sites';
import type { SiteSpec } from './types';

const data = loadGameData();
const f = terrain.features;
const spec = (id: string) => data.sites.sites.find((s) => s.id === id)!;

describe('sites: where each sites.json site is', () => {
  it('every site resolves on the real terrain, provisional ones from their candidate positions', () => {
    const sites = resolveSites(data.sites.sites, f);
    expect(sites.map((s) => s.id)).toEqual(data.sites.sites.map((s) => s.id));
    expect(sites.find((s) => s.id === 'east-cold-trap')).toMatchObject({ center: { x: -132, z: 122 }, radiusM: 26 });
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
  it('terrain features anchor as before; the new cold traps anchor at their sites, provisional included', () => {
    expect(coldZoneAnchor('shadowedCrater', f, data.sites.sites)).toEqual(f.shadowedCrater.centroidLocal);
    expect(coldZoneAnchor('Rocky area 1', f, data.sites.sites)).toEqual({ x: f.rockyAreas[0]!.local.x, z: f.rockyAreas[0]!.local.z });
    expect(coldZoneAnchor('East cold trap', f, data.sites.sites)).toEqual(spec('east-cold-trap').local);
    expect(coldZoneAnchor('South cold trap', f, data.sites.sites)).toEqual(spec('south-cold-trap').local);
    // Without the sites (world/terrainMasks.ts until Phase 4 passes them) the new cold traps anchor nowhere.
    expect(coldZoneAnchor('East cold trap', f, [])).toBeNull();
    expect(coldZoneAnchor('North cold trap', f, data.sites.sites)).toBeNull();
  });

  it('every cold zone in the data resolves on the real terrain', () => {
    for (const zone of data.tuning.cold.zones) expect(coldZoneAnchor(zone, f, data.sites.sites), zone).not.toBeNull();
  });
});
