import { describe, expect, it } from 'vitest';
import { loadGameData, worldGameData } from './gameData';
import { isWorldId, MARS_TERRAIN_BASE, TITAN_TERRAIN_BASE, worldFromQuery, worldOfStep, WORLDS } from './worlds';
import type { MarsTerrainFeatures } from './rules/marsTypes';
import type { TitanTerrainFeatures } from './rules/titanTypes';
import moonTuning from '../data/tuning.json';
import moonEvents from '../data/events.json';
import moonMilestones from '../data/milestones.json';
import moonText from '../data/text.json';
import marsTuning from '../data/mars/tuning.json';
import marsText from '../data/mars/text.json';
import jezero from '../public/terrain/mars/terrain.json';
import titanTuning from '../data/titan/tuning.json';
import titanText from '../data/titan/text.json';
import marsMilestones from '../data/mars/milestones.json';
import titanPlaceholder from '../public/terrain/titan-placeholder/terrain.json';

/** Paths of every key (objects only) that does not start with _, e.g. "mission.gravity". */
function keyPaths(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return [];
  return Object.entries(o).flatMap(([k, v]) => (k.startsWith('_') ? [] : [`${prefix}${k}`, ...keyPaths(v, `${prefix}${k}.`)]));
}
function get(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], o);
}

describe('worlds', () => {
  it('registers the Moon, Mars and Titan; the Moon terrain stays at terrain/', () => {
    expect(WORLDS.moon.terrainBase).toBe('terrain/');
    expect(WORLDS.mars.terrainBase).toBe(MARS_TERRAIN_BASE);
    expect(WORLDS.titan).toEqual({ id: 'titan', terrainBase: TITAN_TERRAIN_BASE, sky: 'titan', earthInSky: false });
    expect(isWorldId('mars')).toBe(true);
    expect(isWorldId('titan')).toBe(true);
    expect(isWorldId('complete')).toBe(false);
    expect(worldOfStep('titan')).toBe('titan');
    expect(worldOfStep('complete')).toBe('titan');
  });

  it('reads the debug start from the query', () => {
    expect(worldFromQuery('?world=mars')).toBe('mars');
    expect(worldFromQuery('?world=titan')).toBe('titan');
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
    expect(mars.tuning.sol).toMatchObject({ sols: 10, secondsPerSol: 60, daySeconds: 45, nightSeconds: 15, solarLongitudeDeg: 200 });
    expect(mars.tuning.sol!.daySeconds + mars.tuning.sol!.nightSeconds).toBe(mars.tuning.sol!.secondsPerSol);
    expect(mars.tuning.sol!.sols * mars.tuning.sol!.secondsPerSol).toBe(mars.tuning.mission.lengthSeconds);
    expect(mars.tuning.night).toBeDefined();
    expect(mars.tuning.ground).toEqual(moonTuning.ground); // untouched sections are the Moon's
    expect(mars.events.flare).toBeUndefined();
    expect(mars.events.quake).toBeUndefined();
    expect(mars.events.duststorm).toBeDefined();
    // The demo reuses the Moon parts (same ids and numbers, Mars wording) and tiers.
    const moonParts = loadGameData('moon').parts;
    expect(mars.parts.parts.map(({ name: _n, description: _d, ...rest }) => rest)).toEqual(moonParts.parts.map(({ name: _n, description: _d, ...rest }) => rest));
    expect(mars.tiers).toBe(loadGameData('moon').tiers);
    const moonIds = new Set(moonMilestones.milestones.map((m) => m.id));
    expect(mars.milestones.milestones.length).toBeGreaterThan(0);
    for (const m of mars.milestones.milestones) expect(moonIds.has(m.id)).toBe(false);
  });

  it('Mars parts have Mars wording; the Moon keeps its own', () => {
    const marsParts = worldGameData('mars').parts.parts;
    const moonParts = loadGameData('moon').parts.parts;
    for (const p of marsParts) expect(p.description, p.id).not.toMatch(/permanent shadow|shadowed crater|polar|regolith|ice where/i);
    expect(marsParts.find((p) => p.id === 'lights-led')!.description).toMatch(/night/);
    expect(moonParts.find((p) => p.id === 'lights-led')!.description).toMatch(/shadowed craters/);
    expect(moonParts.find((p) => p.id === 'power-solar-mast')!.description).toMatch(/polar/);
  });

  it('every Mars overlay key ends up in the merged data, and no _ note does', () => {
    const mars = worldGameData('mars');
    for (const path of keyPaths(marsTuning)) expect(get(mars.tuning, path), path).toEqual(get(marsTuning, path) === null ? undefined : expect.anything());
    for (const path of keyPaths(marsText)) expect(get(mars.text, path), path).toBeDefined();
    expect(mars.text.settings.heading).toBe(moonText.settings.heading); // shared text stays
    expect(JSON.stringify(mars)).not.toMatch(/"_\w+":/);
  });
});

describe('Mars terrain (Jezero)', () => {
  it('has the agreed terrain.json feature schema', () => {
    const f: MarsTerrainFeatures = jezero.features as unknown as MarsTerrainFeatures;
    expect(f.deltaFront.scarpLocal_xz.length).toBeGreaterThan(1);
    expect(f.deltaFront.samplePoint.driveDistanceFromLanding_m).toBeGreaterThan(0);
    expect(f.seitah.outlineLocal_xz.length).toBeGreaterThan(2);
    expect(f.seitah.entryPoint.driveDistanceFromLanding_m).toBeGreaterThan(0);
    expect(f.softGround.areas.length).toBeGreaterThan(0);
    expect(f.rockyAreas).toHaveLength(2);
    expect(f.viewpoints.map((v) => v.kind).sort()).toEqual(['deltaLayers', 'sunset']);
    expect(f.perseveranceLanding.name).toBeTruthy();
    expect(jezero.playArea.samples).toBe(1601);
    expect(jezero.distantTerrain).toHaveLength(2);
    expect('coldMask' in jezero.playArea.files).toBe(false);
  });
});

describe('Titan data', () => {
  it('loads and passes validation', () => {
    expect(() => loadGameData('titan')).not.toThrow();
  });

  it('overlays the shared data: one 900 s day, Titan gravity, the rainstorm, Titan milestones', () => {
    const titan = worldGameData('titan');
    expect(titan.tuning.mission).toEqual({ lengthSeconds: 900, gameDays: 1, gravity: 1.35 });
    const sol = titan.tuning.sol!;
    expect(sol.sols * sol.secondsPerSol).toBe(titan.tuning.mission.lengthSeconds);
    expect([sol.daySeconds, sol.nightSeconds, sol.startSecondsIntoDay]).toEqual([450, 450, 150]);
    // Ground handling matches the Moon's tuned ground gravity.
    const moon = loadGameData('moon').tuning;
    expect(titan.tuning.mission.gravity * titan.tuning.rover.gravityScale).toBeCloseTo(moon.mission.gravity * moon.rover.gravityScale, 1);
    expect(titan.tuning.ground).toEqual(moonTuning.ground);
    expect(titan.tuning.cold.zones).toEqual([]);
    expect(titan.tuning.sleep!.nightClockRate).toBe(4);
    expect(titan.tuning.titanPower!.solarFactor).toBeLessThan(0.01);
    expect(titan.events.flare).toBeUndefined();
    expect(titan.events.quake).toBeUndefined();
    expect(titan.events.duststorm).toBeUndefined();
    expect(titan.events.rainstorm!.warningSeconds).toBe(60);
    // No Titan parts or tiers: the Moon's parts (same ids and numbers) and tiers.
    const moonData = loadGameData('moon');
    expect(titan.parts.parts.map(({ name: _n, description: _d, ...rest }) => rest)).toEqual(moonData.parts.parts.map(({ name: _n, description: _d, ...rest }) => rest));
    expect(titan.tiers).toBe(moonData.tiers);
    const otherIds = new Set([...moonMilestones.milestones, ...marsMilestones.milestones].map((m) => m.id));
    expect(titan.milestones.milestones.length).toBe(11);
    for (const m of titan.milestones.milestones) expect(otherIds.has(m.id), m.id).toBe(false);
  });

  it('every Titan overlay key ends up in the merged data, and no _ note does', () => {
    const titan = worldGameData('titan');
    for (const path of keyPaths(titanTuning)) expect(get(titan.tuning, path), path).toEqual(get(titanTuning, path) === null ? undefined : expect.anything());
    for (const path of keyPaths(titanText)) expect(get(titan.text, path), path).toBeDefined();
    expect(JSON.stringify(titan)).not.toMatch(/"_\w+":/);
  });

  it('screens show Titan wording, not the Moon or Mars', () => {
    const t = worldGameData('titan').text;
    for (const s of [t.landing.heading, t.landing.briefing, t.ticket.briefing, t.mission.briefing, t.mission.loading, t.campaign!.kicker, t.tutorial.designHeading]) {
      expect(s).toMatch(/Titan|Shangri-La/);
    }
    expect(worldGameData('mars').text.debrief.continue).toBe('Continue to Titan');
  });
});

describe('Titan terrain (placeholder)', () => {
  it('has the agreed terrain.json feature schema', () => {
    const f: TitanTerrainFeatures = titanPlaceholder.features as unknown as TitanTerrainFeatures;
    expect(f.duneCrests.lines.length).toBeGreaterThan(1);
    for (const l of f.duneCrests.lines) expect(l.crestLocal_xz.length).toBeGreaterThan(1);
    expect(f.interdunes.corridors.length).toBeGreaterThan(1);
    expect(f.softGround.maskIsAuthoritative).toBe(true);
    expect(f.softGround.areas.length).toBeGreaterThan(0);
    expect(f.rockyAreas[0]!.driveDistanceFromLanding_m).toBeGreaterThan(0);
    expect(f.viewpoints.map((v) => v.kind)).toEqual(['duneCrest']);
    expect(f.samplePatch.radius_m).toBeGreaterThan(0);
    expect(f.crossingRoute.pathLocal_xz.length).toBeGreaterThan(1);
    expect(f.crossingRoute.crestPoint.name).toBeTruthy();
    expect(f.selk.diameter_km).toBeGreaterThan(0);
    expect(titanPlaceholder.playArea.samples).toBe(1601);
    expect(titanPlaceholder.playArea.files.softGround.file).toBe('soft-ground.png');
    expect(titanPlaceholder.distantTerrain).toHaveLength(2);
    expect('coldMask' in titanPlaceholder.playArea.files).toBe(false);
  });
});
