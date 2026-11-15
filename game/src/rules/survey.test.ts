import { describe, expect, it } from 'vitest';
import {
  areaCenter, azimuthDeg, buildLeads, buildSites, compassPoint, discover, distanceToArea, growBounds, leadBearing, mapView, roundedKm,
  type SurveyFeatures,
} from './survey';
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
    const sites = buildSites(features, m, 'Dark crater');
    expect(sites.map((s) => s.kind)).toEqual(['viewpoint', 'rocky-area', 'crater-wall', 'shadowed-crater']);
    const rocky = sites[1]!.area;
    expect(rocky.kind === 'circle' && rocky.r).toBeCloseTo(200 * m.boulderCrossRadiusFactor);
    expect(sites.every((s) => !s.discovered)).toBe(true);
  });

  it('measures the distance to the near edge, zero inside', () => {
    expect(distanceToArea({ kind: 'circle', x: 0, z: 0, r: 100 }, { x: 300, z: 0 })).toBeCloseTo(200);
    expect(distanceToArea({ kind: 'circle', x: 0, z: 0, r: 100 }, { x: 50, z: 0 })).toBe(0);
    const poly = buildSites(features, m, 'Dark crater')[3]!.area;
    expect(distanceToArea(poly, { x: 0, z: 0 })).toBeCloseTo(3000);
    expect(distanceToArea(poly, { x: 0, z: -3500 })).toBe(0);
    expect(areaCenter(poly)).toEqual({ x: 0, z: -3500 });
  });

  it('discovers a site once the reveal circle touches it, once only', () => {
    const sites = buildSites(features, m, 'Dark crater');
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
    const sites = buildSites(features, m, 'Dark crater');
    const leads = buildLeads(sites, { ...t, leads: [...t.leads, { id: 'nowhere', site: 'No such site' }] });
    expect(leads.map((l) => l.id)).toEqual(['boulders', 'shadow']);
    const b = leadBearing(leads[1]!, { x: 0, z: 0 }, t);
    expect(b.compass).toBe(0);
    expect(b.distanceKm).toBeCloseTo(3);
  });

  it('gives every game lead a site, a name and a distinct direction from the lander', () => {
    const data = loadGameData();
    const sites = buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName);
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
