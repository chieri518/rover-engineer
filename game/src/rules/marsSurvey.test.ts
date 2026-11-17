// Mars step 5c: the Mars sites on the map (resolved from terrain.json paths) and in the survey: the new
// site kinds, the fourth lead, the hydrated ground hidden until its milestone finds it.
import { describe, expect, it } from 'vitest';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import moonTerrain from '../../public/terrain/terrain.json';
import { worldGameData } from '../gameData';
import { featureAtPath, resolveSite, resolveSites, type SiteFeatures } from './sites';
import { buildLeads, buildSites, discover, distanceToArea, leadBearing, revealHidden, revealSite, type SurveyFeatures } from './survey';
import type { SiteSpec } from './types';

const mars = worldGameData('mars');
const mf = marsTerrain.features;
const resolved = resolveSites(mars.sites.sites, mf as unknown as SiteFeatures);
const byId = (id: string) => resolved.find((s) => s.id === id)!;
const m = mars.tuning.milestones;
const find = (sites: ReturnType<typeof buildSites>, id: string) => sites.find((s) => s.siteId === id)!;
const build = () => buildSites(mf as unknown as SurveyFeatures, m, mars.text.survey.shadowedCraterName, resolved);

describe('Mars sites: resolved from terrain.json', () => {
  it('every Mars site resolves, at its terrain feature where the path names a point', () => {
    expect(resolved.map((s) => s.id)).toEqual(mars.sites.sites.map((s) => s.id));
    const fb = mf.deltaFront.floodBoulder;
    expect(byId('flood-boulder').center).toEqual({ x: fb.local.x, z: fb.local.z });
    expect(byId('seitah-edge').center).toEqual({ x: mf.seitah.entryPoint.local.x, z: mf.seitah.entryPoint.local.z });
    expect(byId('delta-foot').center).toEqual({ x: mf.deltaFront.footNear.nearestPoint.local.x, z: mf.deltaFront.footNear.nearestPoint.local.z });
    // A slope-target list has no point of its own: the knob keeps its sites.json center.
    expect(byId('wnw-knob').center).toEqual({ x: 305, z: -825 });
    expect(byId('hydrated-ground').center).toEqual({ x: 780, z: 420 });
  });

  it('carries the slope-target patches, the foot line and zone, and the flood boulder\'s reading spot', () => {
    const list = (id: string) => mf.slopeTargets.find((t) => t.id === id)!;
    expect(byId('east-crater').slopePatches).toEqual(mf.slopeTargets.find((t) => t.site === 'young-crater-ene')!.patches.map((p) => ({ local: p.local, levelCell: { x: p.levelCell.x, z: p.levelCell.z } })));
    expect(byId('wnw-knob').slopePatches).toHaveLength(list('slope-targets-knob-wnw').patches.length);
    expect(byId('seitah-knob').slopePatches).toHaveLength(list('slope-targets-knob-ssw').patches.length);
    expect(byId('seitah-edge').slopePatches).toBeUndefined();
    expect(byId('rocky-area-2').slopePatches).toBeUndefined(); // rocky areas as before
    expect(byId('delta-foot').line).toEqual(mf.deltaFront.footNear.lineLocal_xz);
    expect(byId('delta-foot').radiusM).toBe(mf.deltaFront.footNear.zoneRadius_m);
    expect(byId('flood-boulder').readingSpot).toEqual({ x: mf.deltaFront.floodBoulder.readingSpot.x, z: mf.deltaFront.floodBoulder.readingSpot.z });
  });

  it('reads a dotted terrain path, list items by id; a path to nothing falls back to the local stand-in', () => {
    expect(featureAtPath('deltaFront.floodBoulder.diameter_m', mf)).toBe(2.5);
    expect(featureAtPath('slopeTargets.slope-targets-knob-wnw.site', mf)).toBe('knob-wnw');
    expect(featureAtPath('slopeTargets.nope.site', mf)).toBeUndefined();
    const spec: SiteSpec = { id: 'x', kind: 'knob', name: 'X', terrain: 'seitah.nowhere', local: { x: 1, z: 2 }, radiusM: 9 };
    expect(resolveSite(spec, mf as unknown as SiteFeatures)).toMatchObject({ center: { x: 1, z: 2 }, radiusM: 9 });
    expect(resolveSite({ ...spec, local: undefined }, mf as unknown as SiteFeatures)).toBeNull();
  });

  it('the Moon\'s sites carry none of the Mars extras', () => {
    const moon = resolveSites(worldGameData('moon').sites.sites, moonTerrain.features as never);
    expect(moon.some((s) => 'slopePatches' in s || 'line' in s || 'readingSpot' in s)).toBe(false);
  });
});

describe('Mars survey: the new site kinds', () => {
  const sites = build();
  const find = (id: string) => sites.find((s) => s.siteId === id)!;

  it('adds one undiscovered survey site per Mars site with an extent', () => {
    const kinds = Object.fromEntries(['east-crater', 's-crater', 'sse-crater', 'ese-crater', 'wnw-knob', 'seitah-knob', 'seitah-edge', 'delta-foot', 'flood-boulder', 'hydrated-ground'].map((id) => [id, find(id)?.kind]));
    expect(kinds).toEqual({
      'east-crater': 'young-crater', 's-crater': 'young-crater', 'sse-crater': 'young-crater', 'ese-crater': 'young-crater',
      'wnw-knob': 'knob', 'seitah-knob': 'knob', 'seitah-edge': 'seitah-edge', 'delta-foot': 'delta-foot',
      'flood-boulder': 'flood-boulder', 'hydrated-ground': 'hidden-hydrogen',
    });
    expect(sites.every((s) => !s.discovered)).toBe(true);
    // Rocky areas stay the terrain features (one each, with their sites.json id).
    expect(sites.filter((s) => s.kind === 'rocky-area').map((s) => s.siteId)).toEqual(['rocky-area-1', 'rocky-area-2']);
  });

  it('sizes them where their boulders and zones are', () => {
    expect(find('wnw-knob').area).toEqual({ kind: 'circle', x: 305, z: -825, r: 60 * m.boulderCrossRadiusFactor });
    expect(find('seitah-edge').area).toMatchObject({ kind: 'circle', r: 150 * m.boulderCrossRadiusFactor });
    expect(find('delta-foot').area).toEqual({ kind: 'path', points: mf.deltaFront.footNear.lineLocal_xz, r: m.deltaFootRadiusM });
    expect(find('flood-boulder').area).toEqual({ kind: 'circle', x: mf.deltaFront.floodBoulder.local.x, z: mf.deltaFront.floodBoulder.local.z, r: 0 });
    expect(find('hydrated-ground').area).toEqual({ kind: 'circle', x: 780, z: 420, r: m.hydrogenZoneRadiusM });
  });

  it('discovers the delta foot and the flood boulder when the reveal circle reaches the foot', () => {
    const fresh = build();
    const r = mars.tuning.explore.revealRadiusM;
    const p = { x: mf.deltaFront.footNear.drivePoint.x, z: mf.deltaFront.footNear.drivePoint.z };
    const found = discover(fresh, p, r).map((s) => s.siteId ?? s.key);
    expect(found).toEqual(expect.arrayContaining(['delta-foot', 'flood-boulder']));
  });
});

describe('Mars survey: the hydrated ground', () => {
  it('is hidden, and the reveal circle never discovers it, even driven straight across', () => {
    const sites = build();
    const h = sites.find((s) => s.siteId === 'hydrated-ground')!;
    expect(h.hidden).toBe(true);
    const r = mars.tuning.explore.revealRadiusM;
    for (let x = 380; x <= 1180; x += 20) {
      for (let z = 20; z <= 820; z += 40) expect(discover(sites, { x, z }, r)).not.toContain(h);
    }
    expect(h.discovered).toBe(false);
    expect(find(sites, 'rocky-area-1').discovered).toBe(true); // the sweep found what lies around it
  });

  it('is found only when the mission reveals it (its milestone): revealHidden or revealSite, once', () => {
    const sites = build();
    expect(revealHidden(sites).map((s) => s.siteId)).toEqual(['hydrated-ground']);
    expect(revealHidden(sites)).toEqual([]);
    const again = build();
    expect(revealSite(again, 'hydrated-ground')?.siteId).toBe('hydrated-ground');
    expect(revealSite(again, 'hydrated-ground')).toBeNull();
  });

  it('on the Moon revealHidden reveals only the hidden hydrogen', () => {
    const moon = worldGameData('moon');
    const f = moonTerrain.features;
    const sites = buildSites(f as unknown as SurveyFeatures, moon.tuning.milestones, moon.text.survey.shadowedCraterName, resolveSites(moon.sites.sites, f as never));
    expect(revealHidden(sites).map((s) => s.siteId)).toEqual(['hidden-hydrogen']);
  });
});

describe('Mars survey: the leads', () => {
  const sites = build();
  const leads = buildLeads(sites, mars.tuning.survey);

  it('has four leads, the fourth ("Young crater") to East crater', () => {
    expect(leads.map((l) => l.id)).toEqual(mars.tuning.survey.leads.map((l) => l.id));
    expect(leads).toHaveLength(4);
    const young = leads.find((l) => l.id === 'youngCrater')!;
    expect(young.site.siteId).toBe('east-crater');
    expect(mars.text.survey.leads.youngCrater?.name).toBeTruthy();
  });

  it('every lead points a different way from the landing, at an area away from it', () => {
    const landing = marsTerrain.landing.local;
    const dirs = leads.map((l) => leadBearing(l, landing, mars.tuning.survey).compass);
    expect(new Set(dirs).size).toBe(dirs.length);
    for (const l of leads) expect(distanceToArea(l.site.area, landing), l.id).toBeGreaterThan(0);
  });
});
