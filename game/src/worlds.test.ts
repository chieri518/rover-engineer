import { describe, expect, it } from 'vitest';
import { loadGameData, worldGameData } from './gameData';
import { isWorldId, MARS_TERRAIN_BASE, worldFromQuery, worldOfStep, WORLDS } from './worlds';
import type { MarsTerrainFeatures } from './rules/marsTypes';
import moonTuning from '../data/tuning.json';
import moonEvents from '../data/events.json';
import moonMilestones from '../data/milestones.json';
import moonText from '../data/text.json';
import marsTuning from '../data/mars/tuning.json';
import marsText from '../data/mars/text.json';
import placeholder from '../public/terrain/mars-placeholder/terrain.json';

/** Paths of every key (objects only) that does not start with _, e.g. "mission.gravity". */
function keyPaths(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return [];
  return Object.entries(o).flatMap(([k, v]) => (k.startsWith('_') ? [] : [`${prefix}${k}`, ...keyPaths(v, `${prefix}${k}.`)]));
}
function get(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], o);
}

describe('worlds', () => {
  it('registers the Moon and Mars; the Moon terrain stays at terrain/', () => {
    expect(WORLDS.moon.terrainBase).toBe('terrain/');
    expect(WORLDS.mars.terrainBase).toBe(MARS_TERRAIN_BASE);
    expect(isWorldId('mars')).toBe(true);
    expect(isWorldId('titan')).toBe(false);
    expect(worldOfStep('titan')).toBe('mars');
  });

  it('reads the debug start from the query', () => {
    expect(worldFromQuery('?world=mars')).toBe('mars');
    expect(worldFromQuery('?world=venus')).toBeNull();
    expect(worldFromQuery('')).toBeNull();
  });
});

describe('world data', () => {
  it('the Moon data is exactly the shared files', () => {
    const moon = loadGameData('moon');
    expect(moon.tuning).toEqual(moonTuning);
    expect(moon.events).toEqual(moonEvents);
    expect(moon.milestones).toEqual(moonMilestones);
    expect(moon.text).toEqual(moonText);
    expect(loadGameData()).toBe(moon);
  });

  it('Mars data loads and passes validation', () => {
    expect(() => loadGameData('mars')).not.toThrow();
  });

  it('Mars overlays the shared data: its own gravity, sols, events and milestones', () => {
    const mars = worldGameData('mars');
    expect(mars.tuning.mission).toEqual({ lengthSeconds: 600, gameDays: 10, gravity: 3.71 });
    expect(mars.tuning.sol).toEqual({ sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200 });
    expect(mars.tuning.sol!.daySeconds + mars.tuning.sol!.nightSeconds).toBe(mars.tuning.sol!.secondsPerSol);
    expect(mars.tuning.sol!.sols * mars.tuning.sol!.secondsPerSol).toBe(mars.tuning.mission.lengthSeconds);
    expect(mars.tuning.night).toBeDefined();
    expect(mars.tuning.ground).toEqual(moonTuning.ground); // untouched sections are the Moon's
    expect(mars.events.flare).toBeUndefined();
    expect(mars.events.quake).toBeUndefined();
    expect(mars.events.duststorm).toBeDefined();
    expect(mars.parts).toBe(loadGameData('moon').parts); // the demo reuses the Moon parts and tiers
    expect(mars.tiers).toBe(loadGameData('moon').tiers);
    const moonIds = new Set(moonMilestones.milestones.map((m) => m.id));
    expect(mars.milestones.milestones.length).toBeGreaterThan(0);
    for (const m of mars.milestones.milestones) expect(moonIds.has(m.id)).toBe(false);
  });

  it('every Mars overlay key ends up in the merged data, and no _ note does', () => {
    const mars = worldGameData('mars');
    for (const path of keyPaths(marsTuning)) expect(get(mars.tuning, path), path).toEqual(get(marsTuning, path) === null ? undefined : expect.anything());
    for (const path of keyPaths(marsText)) expect(get(mars.text, path), path).toBeDefined();
    expect(mars.text.landing.heading).toBe(moonText.landing.heading); // shared text stays
    expect(JSON.stringify(mars)).not.toMatch(/"_\w+":/);
  });
});

describe('Mars placeholder terrain', () => {
  it('has the agreed terrain.json feature schema', () => {
    const f: MarsTerrainFeatures = placeholder.features as unknown as MarsTerrainFeatures;
    expect(f.deltaFront.scarpLocal_xz.length).toBeGreaterThan(1);
    expect(f.deltaFront.samplePoint.driveDistanceFromLanding_m).toBeGreaterThan(0);
    expect(f.seitah.outlineLocal_xz.length).toBeGreaterThan(2);
    expect(f.seitah.entryPoint.driveDistanceFromLanding_m).toBeGreaterThan(0);
    expect(f.softGround.areas.length).toBeGreaterThan(0);
    expect(f.rockyAreas).toHaveLength(2);
    expect(f.viewpoints.map((v) => v.kind).sort()).toEqual(['deltaLayers', 'sunset']);
    expect(f.perseveranceLanding.name).toBeTruthy();
    expect(placeholder.playArea.samples).toBe(1601);
    expect(placeholder.distantTerrain).toHaveLength(2);
    expect('coldMask' in placeholder.playArea.files).toBe(false);
  });
});
