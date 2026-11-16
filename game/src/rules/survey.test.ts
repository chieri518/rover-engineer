import { describe, expect, it } from 'vitest';
import {
  areaCenter, azimuthDeg, buildLeads, buildSites, compassPoint, discover, distanceToArea, growBounds, leadBearing, mapView, revealSite, roundedKm,
  type SurveyFeatures,
} from './survey';
import { resolveSites, type ResolvedSite } from './sites';
import type { SiteSpec } from './types';
import { testTuning } from './testData';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';

const features: SurveyFeatures = {
  rimViewpoints: [{ name: 'Rim viewpoint 1', local: { x: 0, z: -500 } }],
  rockyAreas: [{ name: 'Rocky area 1', local: { x: -500, z: 0 }, radius_m: 200 }],
  shadowedCrater: { outlineLocal_xz: [[-500, -3000], [500, -3000], [500, -4000], [-500, -4000]] },
  craterDescent: { name: 'Wall', local: { x: 0, z: 800 } },
};
const m = testTuning.milestones;
const t = testTuning.survey;

describe('survey: sites', () => {
  it('sizes sites like the milestone zones', () => {
    const sites = buildSites(features, m, 'Dark crater', []);
    expect(sites.map((s) => s.kind)).toEqual(['viewpoint', 'rocky-area', 'crater-wall', 'shadowed-crater']);
    const rocky = sites[1]!.area;
    expect(rocky.kind === 'circle' && rocky.r).toBeCloseTo(200 * m.boulderCrossRadiusFactor);
    expect(sites.every((s) => !s.discovered)).toBe(true);
  });

  it('measures the distance to the near edge, zero inside', () => {
    expect(distanceToArea({ kind: 'circle', x: 0, z: 0, r: 100 }, { x: 300, z: 0 })).toBeCloseTo(200);
    expect(distanceToArea({ kind: 'circle', x: 0, z: 0, r: 100 }, { x: 50, z: 0 })).toBe(0);
    const poly = buildSites(features, m, 'Dark crater', [])[3]!.area;
    expect(distanceToArea(poly, { x: 0, z: 0 })).toBeCloseTo(3000);
    expect(distanceToArea(poly, { x: 0, z: -3500 })).toBe(0);
    expect(areaCenter(poly)).toEqual({ x: 0, z: -3500 });
  });

  it('discovers a site once the reveal circle touches it, once only', () => {
    const sites = buildSites(features, m, 'Dark crater', []);
    expect(discover(sites, { x: 0, z: 0 }, 250)).toEqual([]); // nothing within 250 m of the start
    const found = discover(sites, { x: 0, z: -200 }, 250); // viewpoint zone edge 240 m away
    expect(found.map((s) => s.name)).toEqual(['Rim viewpoint 1']);
    expect(discover(sites, { x: 0, z: -200 }, 250)).toEqual([]);
    expect(discover(sites, { x: 0, z: -2760 }, 250).map((s) => s.kind)).toEqual(['shadowed-crater']);
  });
});

describe('survey: leads', () => {
  it('gives compass points from grid north (−z), clockwise', () => {
    const o = { x: 0, z: 0 };
    expect(azimuthDeg(o, { x: 0, z: -1 })).toBeCloseTo(0);
    expect(azimuthDeg(o, { x: 1, z: 0 })).toBeCloseTo(90);
    expect(azimuthDeg(o, { x: 0, z: 1 })).toBeCloseTo(180);
    expect(compassPoint(0)).toBe(0);
    expect(compassPoint(350)).toBe(0);
    expect(compassPoint(208)).toBe(9); // south-southwest
    expect(compassPoint(298)).toBe(13); // west-northwest
    expect(compassPoint(337.5)).toBe(15);
  });

  it('rounds distances finer below 1 km', () => {
    expect(roundedKm(272, t)).toBeCloseTo(0.3);
    expect(roundedKm(743, t)).toBeCloseTo(0.7);
    expect(roundedKm(2783, t)).toBeCloseTo(3);
    expect(roundedKm(10, t)).toBeCloseTo(0.1); // never "about 0 km"
  });

  it('points a lead at its area and drops leads whose site is missing', () => {
    const sites = buildSites(features, m, 'Dark crater', []);
    const leads = buildLeads(sites, { ...t, leads: [...t.leads, { id: 'nowhere', site: 'No such site' }] });
    expect(leads.map((l) => l.id)).toEqual(['boulders', 'shadow']);
    const b = leadBearing(leads[1]!, { x: 0, z: 0 }, t);
    expect(b.compass).toBe(0);
    expect(b.distanceKm).toBeCloseTo(3);
  });

  it('gives every game lead a site, a name and a distinct direction from the lander', () => {
    const data = loadGameData();
    // The Moon's sites.json sites too: the Young crater lead points at East crater.
    const placed = resolveSites(data.sites.sites, terrain.features as never);
    const sites = buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName, placed);
    const leads = buildLeads(sites, data.tuning.survey);
    expect(leads).toHaveLength(data.tuning.survey.leads.length);
    const landing = terrain.landing.local;
    const dirs = leads.map((l) => leadBearing(l, landing, data.tuning.survey).compass);
    expect(new Set(dirs).size).toBe(dirs.length);
    for (const l of leads) {
      expect(data.text.survey.leads[l.id]?.name).toBeTruthy();
      // Every lead is hidden at the start: no site is discovered from the landing.
      expect(distanceToArea(l.site.area, landing)).toBeGreaterThan(data.tuning.explore.revealRadiusM);
    }
    expect(data.text.survey.compass).toHaveLength(16);
    expect(data.text.survey.compassShort).toHaveLength(16);
  });
});

describe('minimap view', () => {
  const v = testTuning.minimap;
  it('starts at the start span around the first reveal circle', () => {
    const b = growBounds(null, { x: 100, z: 50 }, 250);
    expect(mapView(b, v)).toEqual({ cx: 100, cz: 50, spanM: Math.max(v.startSpanM, 500 + 2 * v.marginM) });
  });

  it('widens to fit everything explored plus the margin, up to the maximum', () => {
    let b = growBounds(null, { x: 0, z: 0 }, 250);
    for (let z = 0; z >= -3000; z -= 100) b = growBounds(b, { x: 0, z }, 250);
    const view = mapView(b, v);
    expect(view.spanM).toBeCloseTo(3500 + 2 * v.marginM);
    expect(view.cz).toBeCloseTo(-1500);
    expect(mapView({ minX: -9000, maxX: 9000, minZ: 0, maxZ: 1 }, v).spanM).toBe(v.maxSpanM);
  });
});

const spec = (id: string, kind: SiteSpec['kind'], extra: Partial<SiteSpec> = {}): SiteSpec => ({ id, kind, name: id, ...extra } as SiteSpec);
const rs = (id: string, kind: SiteSpec['kind'], center: { x: number; z: number }, extra: Partial<ResolvedSite> = {}, sp: Partial<SiteSpec> = {}): ResolvedSite =>
  ({ id, kind, name: id, center, ...extra, spec: spec(id, kind, sp) });

describe('survey: sites.json sites', () => {
  const resolved: ResolvedSite[] = [
    rs('rocky-area-1', 'rocky-area', { x: -500, z: 0 }, { radiusM: 200 }),
    rs('c1', 'young-crater', { x: 1000, z: 1000 }, { radiusM: 20 }),
    rs('c-noradius', 'young-crater', { x: 5, z: 5 }),
    rs('ct-circle', 'cold-trap', { x: 2000, z: 0 }, { radiusM: 26 }),
    rs('ct-poly', 'cold-trap', { x: 3000, z: 0 }, { outline: [[2900, -100], [3100, -100], [3100, 100], [2900, 100]] }),
    rs('dark', 'cold-trap', { x: 0, z: -3500 }, { outline: [[-500, -3000], [500, -3000], [500, -4000], [-500, -4000]] }, { feature: 'shadowedCrater' }),
    rs('rb', 'rolled-boulder', { x: 1000, z: 1100 }),
    rs('hh', 'hidden-hydrogen', { x: -1000, z: 1000 }),
  ];
  const sites = buildSites(features, m, 'Dark crater', resolved);
  const base = buildSites(features, m, 'Dark crater', []);
  const find = (id: string) => sites.find((s) => s.siteId === id);

  it('keeps the existing sites first and adds one per sized sites.json site', () => {
    expect(sites.slice(0, base.length)).toEqual(base);
    expect(sites.slice(base.length).map((s) => s.siteId)).toEqual(['c1', 'ct-circle', 'ct-poly', 'rb', 'hh']);
    expect(sites.every((s) => !s.discovered)).toBe(true);
  });

  it('sizes each kind', () => {
    const c = find('c1')!;
    expect(c.kind).toBe('young-crater');
    expect(c.area).toEqual({ kind: 'circle', x: 1000, z: 1000, r: 20 * m.boulderCrossRadiusFactor });
    expect(find('ct-circle')!.area).toEqual({ kind: 'circle', x: 2000, z: 0, r: 26 });
    expect(find('ct-circle')!.kind).toBe('cold-trap');
    expect(find('ct-poly')!.area.kind).toBe('polygon');
    expect(find('rb')!.area).toEqual({ kind: 'circle', x: 1000, z: 1100, r: 0 });
    expect(find('rb')!.kind).toBe('rolled-boulder');
    expect(find('hh')!.area).toEqual({ kind: 'circle', x: -1000, z: 1000, r: m.hydrogenZoneRadiusM });
    expect(find('hh')!.kind).toBe('hidden-hydrogen');
    expect(find('c1')).toMatchObject({ key: 'c1', alias: 'c1' });
  });

  it('does not duplicate the dark crater, rocky areas or sites with no extent', () => {
    expect(find('dark')).toBeUndefined();
    expect(sites.filter((s) => s.kind === 'shadowed-crater')).toHaveLength(1);
    expect(find('rocky-area-1')).toBeUndefined();
    expect(sites.filter((s) => s.kind === 'rocky-area')).toHaveLength(1);
    expect(find('c-noradius')).toBeUndefined();
  });

  it('discovers the rolled boulder when the reveal circle reaches it', () => {
    expect(discover(sites, { x: 1000, z: 1500 }, 250)).toEqual([]);
    expect(discover(sites, { x: 1000, z: 1300 }, 250).map((s) => s.siteId)).toEqual(['rb']);
  });

  it('never discovers the hidden hydrogen, but revealSite does once', () => {
    expect(discover(sites, { x: -1000, z: 1000 }, 250)).toEqual([]);
    for (let z = 1400; z >= 600; z -= 10) expect(discover(sites, { x: -1000, z }, 250).map((s) => s.siteId)).not.toContain('hh');
    expect(find('hh')!.discovered).toBe(false);
    expect(revealSite(sites, 'hh')).toBe(find('hh'));
    expect(find('hh')!.discovered).toBe(true);
    expect(revealSite(sites, 'hh')).toBeNull();
    expect(revealSite(sites, 'nope')).toBeNull();
  });

  it('builds the real Moon sites, all undiscovered, and keeps the leads resolving', () => {
    const data = loadGameData();
    const feats = terrain.features;
    const real = buildSites(feats as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName, resolveSites(data.sites.sites, feats));
    const names = ['East crater', 'NW crater', 'SE crater', 'East cold trap', 'South cold trap', 'Rocky area 1 cold patch', 'Rolled boulder', 'Hydrogen-rich ground'];
    for (const n of names) {
      const s = real.find((x) => x.name === n);
      expect(s, n).toBeDefined();
      expect(s!.discovered).toBe(false);
    }
    expect(real.find((x) => x.siteId === 'hidden-hydrogen')!.hidden).toBe(true);
    expect(real.filter((x) => x.kind === 'shadowed-crater')).toHaveLength(1);
    expect(buildLeads(real, data.tuning.survey)).toHaveLength(data.tuning.survey.leads.length);
  });
});
