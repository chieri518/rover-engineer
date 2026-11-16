// Titan milestones and survey (phase T5): zones from the Titan terrain features, Dune crossing, Dawn, the
// methane rain (Storm survivor, photos blocked), Dune sea on any crest, staged samples, Crater ejecta, the
// survey leads (Selk only as a bearing). Runs against the real Titan terrain (public/terrain/titan/), and
// reads every position from its features, so it keeps working when the pipeline regenerates the terrain.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import titan from '../../public/terrain/titan/terrain.json';
import { buildZones, MilestoneTracker, PHOTO_ZONE_IDS, zoneContains, type MilestoneFeatures, type Point3, type StepInput } from './milestones';
import { buildTitanZones, DuneCrossing } from './titanMilestones';
import { buildLeads, buildSites, discover, leadBearing, type SurveyFeatures } from './survey';
import { selectedParts } from './rover';
import { validateGameData } from './validate';
import { milestoneStages } from './payout';
import type { TitanTerrainFeatures } from './titanTypes';
import type { Build } from './types';

const data = loadGameData('titan');
const t = data.tuning.milestones;
const f = titan.features as unknown as TitanTerrainFeatures;
const L = titan.landing.local;
const features: MilestoneFeatures = {
  landing: L,
  rockyAreas: f.rockyAreas,
  viewpoints: f.viewpoints,
  duneCrests: f.duneCrests,
  interdunes: f.interdunes,
  samplePatch: f.samplePatch,
};
const zones = buildZones(features, t);
const inZone = (id: string, p: Point3) => zones.some((z) => z.id === id && zoneContains(z, p));

const camera: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-nih2',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'],
};
const drill: Build = { ...camera, payload: ['instrument-drill'] };

function tracker(build: Build) {
  return new MilestoneTracker(data.milestones.milestones, selectedParts(build, data.parts), zones, t);
}
const at = (x: number, z: number): Point3 => ({ x, y: 0, z });
const ids = (u: { reached: { milestone: { id: string } }[] }) => u.reached.map((r) => r.milestone.id);
const step = (tr: MilestoneTracker, p: Point3, extra: Partial<StepInput> = {}) =>
  tr.step({ position: p, distanceM: 0, exploredShare: 0, ...extra });

/** Drive a polyline in 5 m steps; returns the milestone ids reached on the way. */
function drive(tr: MilestoneTracker, path: [number, number][], extra: Partial<StepInput> = {}): string[] {
  const got: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1]!;
    const [bx, bz] = path[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 5));
    for (let k = 0; k <= n; k++) got.push(...ids(step(tr, at(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n), extra)));
  }
  return got;
}

const route = f.crossingRoute;
const from = route.fromCorridor.local;
const crest = route.crestPoint.local;
/** The crossing route carried on 100 m past its end, onto the next corridor's firm ground. */
function routeOn(): [number, number][] {
  const pts = route.pathLocal_xz;
  const [ax, az] = pts[pts.length - 2]!;
  const [bx, bz] = pts[pts.length - 1]!;
  const len = Math.hypot(bx - ax, bz - az) || 1;
  return [...pts, [bx + ((bx - ax) / len) * 100, bz + ((bz - az) / len) * 100]];
}
const end = routeOn()[routeOn().length - 1]!;
const to = { x: end[0], z: end[1] };

describe('Titan milestone data', () => {
  it('loads, validates, and replaces the Moon list with the 11 design milestones', () => {
    expect(validateGameData(data)).toEqual([]);
    expect(data.milestones.milestones.map((m) => m.id)).toEqual([
      'titan-touchdown', 'titan-odometer', 'titan-mapper', 'dune-crossing', 'titan-night-drive', 'titan-dawn',
      'titan-storm-survivor', 'dune-sea', 'organic-sands', 'crater-ejecta', 'titan-clean-run',
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

  it('every zone a trigger names exists on the Titan map', () => {
    const known = new Set(zones.map((z) => z.id));
    for (const m of data.milestones.milestones) {
      const tr = m.trigger;
      if ('zone' in tr && tr.zone) expect(known.has(tr.zone as never), `${m.id}: ${tr.zone}`).toBe(true);
    }
    for (const id of ['dune-crest', 'dune-crest-viewpoint', 'interdune-sample', 'ejecta-field', 'interdune-corridor', 'near-lander']) {
      expect(known.has(id as never), id).toBe(true);
    }
    expect(known.has('large-crater')).toBe(false);
    expect(known.has('ice-spot')).toBe(false);
  });

  it('an active camera or drill run earns several times what an idler earns', () => {
    const m = Object.fromEntries(data.milestones.milestones.map((x) => [x.id, x.money * milestoneStages(x)]));
    const idler = m['titan-touchdown']! + m['titan-dawn']! + m['titan-storm-survivor']! + m['titan-clean-run']! + data.tuning.payout.survivalPayout;
    const active = idler + m['titan-odometer']! + m['titan-mapper']! + m['dune-crossing']!;
    expect(active + m['dune-sea']! + m['titan-night-drive']!).toBeGreaterThan(2.3 * idler);
    expect(active + m['organic-sands']! + m['crater-ejecta']!).toBeGreaterThan(2.3 * idler);
  });

  it('Moon and Mars build no Titan zones', () => {
    expect(buildTitanZones({ rockyAreas: f.rockyAreas }, t)).toEqual([]);
  });
});

describe('Titan zones on the real terrain', () => {
  it('the landing, the crossing start and just past the crossing end lie in corridors; the end in a different one', () => {
    const corridorOf = (p: Point3) => zones.find((z) => z.id === 'interdune-corridor' && zoneContains(z, p))?.key;
    expect(corridorOf(at(L.x, L.z))).toBeDefined();
    expect(corridorOf(at(from.x, from.z))).toBeDefined();
    expect(corridorOf(at(to.x, to.z))).toBeDefined();
    expect(corridorOf(at(to.x, to.z))).not.toBe(corridorOf(at(from.x, from.z)));
  });

  it('the crossing saddle and the dune-crest viewpoint are on a dune crest', () => {
    expect(inZone('dune-crest', at(crest.x, crest.z))).toBe(true);
    for (const v of f.viewpoints) expect(inZone('dune-crest', at(v.local.x, v.local.z)), v.name).toBe(true);
    expect(inZone('dune-crest', at(L.x, L.z))).toBe(false);
  });

  it('the ejecta field and the sample patch are outside the lander zone', () => {
    const e = f.rockyAreas[0]!.local;
    const s = f.samplePatch.local;
    expect(inZone('ejecta-field', at(e.x, e.z))).toBe(true);
    expect(inZone('near-lander', at(e.x, e.z))).toBe(false);
    expect(inZone('interdune-sample', at(s.x, s.z))).toBe(true);
    expect(inZone('near-lander', at(s.x, s.z))).toBe(false);
  });

  it('crest and viewpoint photos are captioned with their place', () => {
    expect(PHOTO_ZONE_IDS).toContain('dune-crest');
    expect(PHOTO_ZONE_IDS).toContain('dune-crest-viewpoint');
  });
});

describe('Dune crossing', () => {
  it('fires driving the crossing route from one corridor over the crest to the next', () => {
    const tr = tracker(camera);
    expect(drive(tr, routeOn())).toContain('dune-crossing');
  });

  it('does not fire going up to the crest and back to the same corridor', () => {
    const tr = tracker(camera);
    expect(drive(tr, [[from.x, from.z], [crest.x, crest.z], [from.x, from.z]])).not.toContain('dune-crossing');
  });

  it('needs the crest: moving between corridors without it does not count', () => {
    const d = new DuneCrossing();
    expect(d.step('a', false)).toBe(false);
    expect(d.step(null, false)).toBe(false);
    expect(d.step('b', false)).toBe(false);
    expect(d.step(null, true)).toBe(false);
    expect(d.step('a', false)).toBe(true);
  });
});

describe('Dawn, night drive and the rain', () => {
  it('Dawn fires when the night ends while the mission runs, not at the morning start', () => {
    const tr = tracker(camera);
    expect(ids(step(tr, at(L.x, L.z), { night: false }))).not.toContain('titan-dawn');
    step(tr, at(L.x, L.z), { night: true });
    expect(ids(step(tr, at(L.x, L.z), { night: false }))).toContain('titan-dawn');
  });

  it('Night drive counts only distance driven at night, in stages', () => {
    const tr = tracker(camera);
    step(tr, at(L.x, L.z), { distanceM: 0, night: false });
    step(tr, at(L.x, L.z), { distanceM: 500, night: false });
    expect(ids(step(tr, at(L.x, L.z), { distanceM: 600, night: true }))).toContain('titan-night-drive');
    expect(tr.nightDistanceM()).toBe(100);
  });

  it('Storm survivor fires when the methane rain clears', () => {
    const tr = tracker(camera);
    step(tr, at(L.x, L.z), { stormActive: true });
    expect(ids(step(tr, at(L.x, L.z), { stormActive: false }))).toContain('titan-storm-survivor');
  });

  it('Dune sea: on any crest or at the viewpoint, never during rain', () => {
    const v = f.viewpoints[0]!.local;
    const tr = tracker(camera);
    step(tr, at(crest.x, crest.z), { photosBlocked: true });
    expect(tr.photosBlocked()).toBe(true);
    expect(ids(tr.photo(at(crest.x, crest.z), false, 0))).toEqual([]);
    step(tr, at(crest.x, crest.z));
    expect(ids(tr.photo(at(crest.x, crest.z), false, 0))).toContain('dune-sea');
    const tr2 = tracker(camera);
    expect(ids(tr2.photo(at(v.x, v.z), false, 0))).toContain('dune-sea');
    expect(ids(tracker(camera).photo(at(L.x, L.z), false, 0))).toEqual([]);
  });
});

describe('Drilling on Titan', () => {
  it('Crater ejecta: a sample in the ejecta field (also an Organic sands site)', () => {
    const e = f.rockyAreas[0]!.local;
    const got = ids(tracker(drill).drill(at(e.x, e.z)));
    expect(got).toContain('crater-ejecta');
    expect(got).toContain('organic-sands');
  });

  it('Organic sands: three sites 200 m apart, none near the lander', () => {
    const tr = tracker(drill);
    expect(ids(tr.drill(at(L.x, L.z)))).toEqual([]);
    const s = f.samplePatch.local;
    expect(tr.drill(at(s.x, s.z)).reached.map((r) => r.stage)).toEqual([1]);
    expect(tr.drill(at(s.x + 50, s.z)).reached).toEqual([]);
    expect(tr.drill(at(s.x + 250, s.z)).reached.map((r) => r.stage)).toEqual([2]);
    expect(tr.drill(at(s.x + 500, s.z)).reached.map((r) => r.stage)).toEqual([3]);
  });

  it('a camera rover is not credited for drill milestones', () => {
    const e = f.rockyAreas[0]!.local;
    const u = tracker(camera).drill(at(e.x, e.z));
    expect(u.reached).toEqual([]);
    expect(u.missed.map((m) => m.milestone.id)).toContain('crater-ejecta');
  });
});

describe('Titan survey', () => {
  const sites = buildSites(f as unknown as SurveyFeatures, t, data.text.survey.shadowedCraterName, []);
  const leads = buildLeads(sites, data.tuning.survey);

  it('builds all four leads with text', () => {
    expect(leads.map((l) => l.id)).toEqual(['patch', 'crest', 'ejecta', 'selk']);
    for (const l of leads) {
      expect(data.text.survey.leads[l.id]?.name, l.id).toBeTruthy();
      expect(data.text.survey.leads[l.id]?.source ?? '', l.id).not.toMatch(/placeholder/i);
    }
  });

  it('Selk is a bearing only: never discovered anywhere on the map, pointing the way terrain.json says', () => {
    const selk = leads.find((l) => l.id === 'selk')!;
    const fresh = buildSites(f as unknown as SurveyFeatures, t, '', []);
    for (const [x, z] of [[-4000, -4000], [4000, -4000], [0, 0], [-4000, 4000], [4000, 4000]] as const) discover(fresh, { x, z }, 250);
    expect(fresh.find((s) => s.key === 'selk')!.discovered).toBe(false);
    const b = leadBearing(selk, { x: L.x, z: L.z }, data.tuning.survey);
    expect(Math.abs(((b.azimuth - f.selk.bearingFromLanding_deg + 540) % 360) - 180)).toBeLessThan(2);
    expect(b.distanceKm).toBeGreaterThan(10);
  });

  it('the landing corridor is found at the start; crests and the ejecta field only nearby', () => {
    const fresh = buildSites(f as unknown as SurveyFeatures, t, '', []);
    const found = discover(fresh, { x: L.x, z: L.z }, data.tuning.explore.revealRadiusM).map((s) => s.kind);
    expect(found).toContain('corridor');
    expect(found).not.toContain('dune-crest');
    expect(found).not.toContain('rocky-area');
  });
});
