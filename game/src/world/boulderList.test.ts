// Mars step 6a: the mission's boulder list with the world's masks. Mars site boulders stay off the sand
// ripples of soft-ground.png and off ground over maxSlopeDeg; the Moon's list is exactly as before.
import { describe, expect, it } from 'vitest';
import { decode } from 'fast-png';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import moonTerrain from '../../public/terrain/terrain.json';
import { worldGameData } from '../gameData';
import { scatterBoulders, scatterSiteBoulders, siteBoulderCount } from '../rules/boulders';
import { resolveSites, type SiteFeatures } from '../rules/sites';
import { boulderGround, worldBoulders, type BoulderMasks } from './boulderList';
import { TerrainMasks, type FeatureInfo } from './terrainMasks';

// Node's fs, without Node's types in the project (the build has DOM types only).
const fs = (await import('node:fs' as string)) as { readFileSync(p: URL): Uint8Array };
const png = (file: string) => decode(fs.readFileSync(new URL(`../../public/terrain/${file}`, import.meta.url))).data as Uint8Array;

const circles = (list: { local: { x: number; z: number }; radius_m: number }[]) => list.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));

describe('boulder list: the Moon', () => {
  const moon = worldGameData('moon');
  const sites = resolveSites(moon.sites.sites, moonTerrain.features as unknown as SiteFeatures);
  const masks: BoulderMasks = {
    boulderAreas: circles(moonTerrain.features.rockyAreas),
    slopeAt: () => { throw new Error('the Moon reads no slope for boulders'); },
    softAt: () => { throw new Error('the Moon reads no soft ground for boulders'); },
    info: { features: moonTerrain.features as unknown as BoulderMasks['info']['features'] },
  };

  it('passes no masks', () => {
    expect(boulderGround('moon', masks)).toEqual({});
  });

  it('is exactly the old scatter: rocky areas tagged with their site, then the site boulders', () => {
    const rockySite = (a: { x: number; z: number }) => {
      const r = sites.find((x) => x.kind === 'rocky-area' && Math.hypot(x.center.x - a.x, x.center.z - a.z) < 1);
      return r ? { site: r.id } : {};
    };
    const old = [
      ...scatterBoulders(masks.boulderAreas.map((a) => ({ ...a, ...rockySite(a) })), moon.tuning.boulders),
      ...scatterSiteBoulders(sites, moon.tuning.boulders),
    ];
    const list = worldBoulders('moon', masks, sites, moon.tuning);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toEqual(old);
  });
});

describe('boulder list: Mars', () => {
  const mars = worldGameData('mars');
  const info = marsTerrain as unknown as FeatureInfo;
  const n = info.playArea.samples;
  const masks = new TerrainMasks(info, png('mars/slope.png'), new Uint8Array(n * n), png('mars/soft-ground.png'));
  const sites = resolveSites(mars.sites.sites, marsTerrain.features as unknown as SiteFeatures);
  const list = worldBoulders('mars', masks, sites, mars.tuning);
  const rockyCount = masks.boulderAreas.length * mars.tuning.boulders.perRockyArea;
  const siteBoulders = list.slice(rockyCount);

  it('reads the soft-ground mask: ripples in Séítah, firm at the landing', () => {
    expect(masks.hasSoftGround).toBe(true);
    const sand = marsTerrain.features.softGround.areas[0]!.local;
    expect(masks.softAt(sand.x, sand.z)).toBeGreaterThan(0);
    expect(masks.softAt(marsTerrain.landing.local.x, marsTerrain.landing.local.z)).toBe(0);
  });

  it('keeps every site boulder off the ripples and off ground too steep to drive to', () => {
    const maxSlope = mars.tuning.boulders.maxSlopeDeg!;
    expect(maxSlope).toBeGreaterThan(0);
    expect(siteBoulders.length).toBeGreaterThan(0);
    for (const b of siteBoulders) {
      expect(masks.softAt(b.x, b.z), b.site).toBe(0);
      expect(masks.slopeAt(b.x, b.z), b.site).toBeLessThanOrEqual(maxSlope);
    }
  });

  it('still places every site boulder, the flood boulder and the slope targets', () => {
    for (const s of sites) {
      if (['young-crater', 'knob', 'seitah-edge', 'delta-foot'].includes(s.kind)) {
        expect(siteBoulders.filter((b) => b.site === s.id), s.id).toHaveLength(siteBoulderCount(s, mars.tuning.boulders));
      }
    }
    expect(siteBoulders.filter((b) => b.flood)).toHaveLength(1);
    expect(siteBoulders.some((b) => b.slopeTarget)).toBe(true);
  });

  it('keeps the rocky areas as the plain scatter', () => {
    expect(list.slice(0, rockyCount).map(({ site: _s, ...p }) => p)).toEqual(scatterBoulders(masks.boulderAreas, mars.tuning.boulders));
  });
});
