// Mars step 5c: boulders at the Mars sites (counts, slope targets, soft ground, the flood boulder) and the
// Moon's scatter unchanged.
import { describe, expect, it } from 'vitest';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import moonTerrain from '../../public/terrain/terrain.json';
import { worldGameData } from '../gameData';
import { placeBoulders, scatterBoulders, scatterSiteBoulders, siteBoulderBlocked, siteBoulderCount, slopeTargetCount, softGroundTest, type Boulder } from './boulders';
import { softnessAt } from './ground';
import { resolveSites, type ResolvedSite, type SiteFeatures } from './sites';
import { nearestOnPath } from './survey';
import type { SiteSpec, Tuning } from './types';

const mars = worldGameData('mars');
const moon = worldGameData('moon');
const mf = marsTerrain.features as unknown as SiteFeatures & Parameters<typeof softGroundTest>[0];
const b = mars.tuning.boulders;
const sites = resolveSites(mars.sites.sites, mf);
const rocky = marsTerrain.features.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
const all = placeBoulders(rocky, sites, mars.tuning, mf);
const siteBoulders = all.slice(rocky.length * b.perRockyArea);
const at = (id: string) => siteBoulders.filter((x) => x.site === id);
const site = (id: string) => sites.find((s) => s.id === id)!;
const cellM = marsTerrain.playArea.pixel_m;
/** The nearest 5 m sample, as the game reads slope.png (world/terrainMasks.ts slopeAt). */
const cell = (p: { x: number; z: number }) => ({ x: Math.round(p.x / cellM) * cellM, z: Math.round(p.z / cellM) * cellM });

describe('Mars boulders: counts per site', () => {
  it('gives each site its tuned count, East crater its own, and the flood boulder one', () => {
    expect(b.perSiteKind && b.perSite && b.slopeTargetShare && b.floodBoulderDiameterM).toBeTruthy();
    const withBoulders = sites.filter((s) => ['young-crater', 'knob', 'seitah-edge', 'delta-foot'].includes(s.kind));
    expect(withBoulders.map((s) => s.kind).sort()).toEqual(['delta-foot', 'knob', 'knob', 'seitah-edge', 'young-crater', 'young-crater', 'young-crater', 'young-crater']);
    for (const s of withBoulders) {
      const n = siteBoulderCount(s, b);
      expect(n, s.id).toBeGreaterThan(0);
      expect(at(s.id), s.id).toHaveLength(n); // none left out for want of firm ground
    }
    expect(siteBoulderCount(site('east-crater'), b)).toBe(b.perSite!['east-crater']);
    expect(siteBoulderCount(site('s-crater'), b)).toBe(b.perYoungCrater);
    expect(siteBoulderCount(site('wnw-knob'), b)).toBe(b.perSiteKind!.knob);
    expect(at('flood-boulder')).toHaveLength(1);
    expect(at('hydrated-ground')).toHaveLength(0); // found by the meter, no contact target
    expect(siteBoulders.every((x) => x.site !== undefined)).toBe(true);
  });

  it('keeps the rocky areas as before, each tagged with its site', () => {
    const tagged = all.slice(0, rocky.length * b.perRockyArea);
    expect(tagged.map(({ site: _s, ...p }) => p)).toEqual(scatterBoulders(rocky, b));
    expect(new Set(tagged.map((x) => x.site))).toEqual(new Set(['rocky-area-1', 'rocky-area-2']));
  });

  it('is the same every time', () => {
    expect(placeBoulders(rocky, sites, mars.tuning, mf)).toEqual(all);
  });

  it('spreads crater, knob and Séítah edge boulders around the site, and delta foot boulders inside the foot zone', () => {
    for (const s of sites.filter((q) => ['young-crater', 'knob', 'seitah-edge'].includes(q.kind))) {
      for (const x of at(s.id).filter((q) => !q.slopeTarget)) {
        expect(Math.hypot(x.x - s.center.x, x.z - s.center.z), s.id).toBeLessThanOrEqual(s.radiusM! * b.spreadRadiusFactor + 1e-9);
      }
    }
    const foot = site('delta-foot');
    expect(foot.line!.length).toBeGreaterThanOrEqual(2);
    const zone = mars.tuning.milestones.deltaFootRadiusM!;
    for (const x of at('delta-foot')) {
      const q = nearestOnPath(foot.line!, x);
      expect(Math.hypot(x.x - q.x, x.z - q.z)).toBeLessThan(zone - mars.tuning.instruments.xray.reachM);
    }
  });
});

describe('Mars boulders: slope targets', () => {
  const withPatches = sites.filter((s) => s.slopePatches);

  it('every young crater and knob has the pipeline\'s slope-target patches', () => {
    expect(withPatches.map((s) => s.id).sort()).toEqual(['east-crater', 'ese-crater', 's-crater', 'seitah-knob', 'sse-crater', 'wnw-knob']);
  });

  it('puts the tuned share of each one\'s boulders on its slope-target cells', () => {
    for (const s of withPatches) {
      const onSlope = at(s.id).filter((x) => x.slopeTarget);
      const n = siteBoulderCount(s, b);
      expect(onSlope, s.id).toHaveLength(Math.round(n * b.slopeTargetShare!));
      expect(slopeTargetCount(s, b)).toBe(onSlope.length);
      const cells = s.slopePatches!.map((p) => `${p.local.x},${p.local.z}`);
      for (const x of onSlope) {
        const c = cell(x);
        expect(cells, s.id).toContain(`${c.x},${c.z}`); // read as the 10 to 18° cell
      }
      // Every patch gets one before any gets two.
      const used = new Set(onSlope.map((x) => { const c = cell(x); return `${c.x},${c.z}`; }));
      expect(used.size).toBe(Math.min(onSlope.length, new Set(cells).size));
    }
  });

  it('parks level: from inside each one\'s level cell the arm reaches it', () => {
    const reach = mars.tuning.instruments.xray.reachM;
    for (const s of withPatches) {
      for (const x of at(s.id).filter((q) => q.slopeTarget)) {
        const c = cell(x);
        const patch = s.slopePatches!.find((p) => p.local.x === c.x && p.local.z === c.z)!;
        // The nearest point of the level cell's 5 m square to the boulder: the rover parks there, reading level ground.
        const h = cellM / 2;
        const nx = Math.max(patch.levelCell.x - h, Math.min(patch.levelCell.x + h, x.x));
        const nz = Math.max(patch.levelCell.z - h, Math.min(patch.levelCell.z + h, x.z));
        expect(Math.hypot(nx - x.x, nz - x.z) - x.radius).toBeLessThan(reach - 1); // a metre to spare
      }
    }
  });

  it('puts no boulders on slope targets without a share or without patches (the Moon)', () => {
    expect(slopeTargetCount(site('east-crater'), { ...b, slopeTargetShare: undefined })).toBe(0);
    expect(slopeTargetCount({ ...site('east-crater'), slopePatches: undefined }, b)).toBe(0);
    expect(slopeTargetCount(site('seitah-edge'), b)).toBe(0);
  });
});

describe('Mars boulders: soft ground', () => {
  const soft = softGroundTest(mf, mars.tuning.ground)!;
  const areas = marsTerrain.features.softGround.areas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));

  it('no site boulder lies where the rover would sink', () => {
    expect(soft).toBeDefined();
    for (const x of siteBoulders) expect(softnessAt(x.x, x.z, areas, mars.tuning.ground), x.site).toBe(0);
  });

  it('the Séítah edge has soft ground inside its spread, so the test matters there', () => {
    const s = site('seitah-edge');
    expect(soft(s.center.x, s.center.z)).toBe(true);
    const unfiltered = scatterSiteBoulders([s], b);
    expect(unfiltered.some((x) => soft(x.x, x.z))).toBe(true);
    expect(at('seitah-edge').length).toBe(siteBoulderCount(s, b));
  });

  it('leaves a boulder out when no firm spot is found, and draws the others the same', () => {
    const everywhere = scatterSiteBoulders([site('wnw-knob')], b, { soft: () => true });
    expect(everywhere).toEqual([]);
    // Soft west of the knob's center: every scattered boulder still finds a firm spot; a slope target whose
    // patch is soft is left out (its patch is a fixed place).
    const k = site('wnw-knob');
    const half = scatterSiteBoulders([k], b, { soft: (x) => x < k.center.x });
    expect(half.every((x) => x.x >= k.center.x)).toBe(true);
    expect(half.filter((x) => !x.slopeTarget)).toHaveLength(siteBoulderCount(k, b) - slopeTargetCount(k, b));
    const firmPatches = k.slopePatches!.filter((p) => p.local.x > k.center.x + cellM).length;
    expect(half.filter((x) => x.slopeTarget).length).toBeGreaterThanOrEqual(firmPatches > 0 ? 1 : 0);
  });
});

describe('Mars boulders: the world\'s ground masks', () => {
  // A synthetic world: a soft strip and a steep strip across the Séítah edge's and the delta foot's spreads.
  const softAt = (x: number) => (x > 560 && x < 600 ? 0.5 : 0);
  const slopeAt = (x: number) => (x < -500 ? 25 : 3);
  const steep = { ...mars.tuning, boulders: { ...b, maxSlopeDeg: 18 } };

  it('keeps site boulders off the soft-ground mask and, with maxSlopeDeg, off ground too steep to drive to', () => {
    const list = placeBoulders(rocky, sites, steep, mf, { softAt, slopeAt }).slice(rocky.length * b.perRockyArea);
    expect(list.filter((x) => x.site === 'seitah-edge').some((x) => x.x > 560 && x.x < 600)).toBe(false);
    expect(list.filter((x) => x.site === 'delta-foot').some((x) => x.x < -500)).toBe(false);
    expect(list.filter((x) => x.site === 'delta-foot')).toHaveLength(siteBoulderCount(site('delta-foot'), b)); // moved, not lost
  });

  it('applies no slope test without maxSlopeDeg, and none at all on the Moon', () => {
    expect(placeBoulders(rocky, sites, mars.tuning, mf, { slopeAt })).toEqual(all);
    expect(siteBoulderBlocked(moonTerrain.features as never, moon.tuning, { slopeAt })).toBeUndefined();
    const blocked = siteBoulderBlocked(mf, steep, { softAt, slopeAt })!;
    expect([blocked(580, 0), blocked(-600, 0), blocked(0, -2000)]).toEqual([true, true, false]);
  });
});

describe('Mars boulders: the flood boulder', () => {
  const flood = at('flood-boulder')[0]!;
  const fb = marsTerrain.features.deltaFront.floodBoulder;

  it('is one fixed, larger boulder at the pipeline\'s spot', () => {
    expect(flood).toEqual({ x: fb.local.x, z: fb.local.z, radius: b.floodBoulderDiameterM! / 2, site: 'flood-boulder', flood: true });
    // Larger than any other boulder at the delta foot, so it reads as the one to find there.
    for (const x of at('delta-foot')) expect(x.radius).toBeLessThan(flood.radius);
    expect(siteBoulders.filter((x) => x.flood)).toEqual([flood]);
    expect(site('flood-boulder').readingSpot).toEqual({ x: fb.readingSpot.x, z: fb.readingSpot.z });
  });

  it('keeps its level reading side clear of other boulders', () => {
    const clear = b.floodBoulderDiameterM! / 2 + b.maxDiameterM;
    for (const x of all.filter((q) => !q.flood)) {
      expect(Math.hypot(x.x - fb.local.x, x.z - fb.local.z)).toBeGreaterThan(clear);
      expect(Math.hypot(x.x - fb.readingSpot.x, x.z - fb.readingSpot.z)).toBeGreaterThan(clear);
    }
  });

  it('is left out without its tuned size', () => {
    expect(scatterSiteBoulders([site('flood-boulder')], { ...b, floodBoulderDiameterM: undefined })).toEqual([]);
  });
});

describe('Moon boulders unchanged', () => {
  const f = moonTerrain.features;
  const msites = resolveSites(moon.sites.sites, f as never);
  const mb = moon.tuning.boulders;
  const mrocky = f.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));

  it('has no Mars keys, slope targets or soft-ground test', () => {
    expect(mb.perSite ?? mb.perSiteKind ?? mb.slopeTargetShare ?? mb.floodBoulderDiameterM).toBeUndefined();
    expect(msites.some((s) => s.slopePatches || s.line || s.readingSpot)).toBe(false);
    expect(softGroundTest(f as never, moon.tuning.ground)).toBeUndefined();
  });

  it('placeBoulders gives the mission\'s list: rocky areas tagged by center, then the site boulders', () => {
    const tag = (a: { x: number; z: number }) => {
      const r = msites.find((s) => s.kind === 'rocky-area' && Math.hypot(s.center.x - a.x, s.center.z - a.z) < 1);
      return r ? { site: r.id } : {};
    };
    const expected: Boulder[] = [...scatterBoulders(mrocky.map((a) => ({ ...a, ...tag(a) })), mb), ...scatterSiteBoulders(msites, mb)];
    expect(placeBoulders(mrocky, msites, moon.tuning, f as never)).toEqual(expected);
    // The world's masks change nothing on the Moon (no soft-ground file, no maxSlopeDeg).
    expect(placeBoulders(mrocky, msites, moon.tuning, f as never, { slopeAt: () => 30 })).toEqual(expected);
    expect(scatterSiteBoulders(msites, mb, {})).toEqual(scatterSiteBoulders(msites, mb));
  });

  it('young craters keep perYoungCrater each; the Mars kinds add nothing without their keys', () => {
    const list = scatterSiteBoulders(msites, mb);
    for (const s of msites.filter((q) => q.kind === 'young-crater')) expect(list.filter((x) => x.site === s.id)).toHaveLength(mb.perYoungCrater);
    expect(list.some((x) => x.flood || x.slopeTarget)).toBe(false);
    const knob = { id: 'k', kind: 'knob', name: 'K', center: { x: 0, z: 0 }, radiusM: 50, spec: { id: 'k', kind: 'knob', name: 'K' } as SiteSpec } satisfies ResolvedSite;
    expect(scatterSiteBoulders([knob], mb)).toEqual([]);
    expect(scatterSiteBoulders([knob], { ...mb, perSiteKind: { knob: 5 } } as Tuning['boulders'])).toHaveLength(5);
  });
});
