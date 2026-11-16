import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, distanceToOutline, zoneContains, type MilestoneFeatures } from './milestones';
import { resolveSites } from './sites';
import {
  emptySeismometerTrack, hydrogenReading, reflectorEarthLight, rockTypeFor, seismometerRecord, seismometerRecording, stationHint, stationPress,
  stationTooClose, stepSeismometer, xrayTarget,
  type SeismometerTrack, type TrackPoint,
} from './instruments';
import { scatterBoulders, scatterSiteBoulders, type Boulder } from './boulders';
import { testTuning } from './testData';

const data = loadGameData();
const it_ = data.tuning.instruments;
const f = terrain.features;
const zones = buildZones({
  landing: terrain.landing.local,
  rimViewpoints: f.rimViewpoints,
  rockyAreas: f.rockyAreas,
  shadowedCrater: f.shadowedCrater as unknown as MilestoneFeatures['shadowedCrater'],
  craterDescent: f.craterDescent,
}, data.tuning.milestones);
const L = terrain.landing.local;

describe('neutron spectrometer: hydrogen meter', () => {
  const n = it_.neutron;
  const ice = f.shadowedCrater.iceCandidate.local;
  const entry = f.shadowedCrater.entryPoint.local;
  const crater = zones.find((z) => z.id === 'shadowed-crater')!;

  it('reads the noise floor on ordinary ground and the cold background in other cold areas', () => {
    expect(hydrogenReading({ x: L.x, z: L.z }, false, zones, n)).toBe(n.noiseFloor);
    expect(hydrogenReading({ x: L.x, z: L.z }, true, zones, n)).toBe(n.coldBackground);
  });

  it('is highest at the ice spot and rises toward it inside the dark crater', () => {
    expect(hydrogenReading(ice, true, zones, n)).toBe(1);
    const toward = (share: number) => ({ x: entry.x + share * (ice.x - entry.x), z: entry.z + share * (ice.z - entry.z) });
    const inside = toward(0.3);
    expect(zoneContains(crater, { ...inside, y: 0 })).toBe(true);
    const a = hydrogenReading(inside, true, zones, n);
    const b = hydrogenReading(toward(0.7), true, zones, n);
    expect(a).toBeGreaterThan(n.coldBackground); // a lead to follow just inside the edge
    expect(b).toBeGreaterThan(a);
    // Far side of the crater, out of range of the ice: the background only.
    const far = { x: ice.x + (ice.x - entry.x) * 10, z: ice.z + (ice.z - entry.z) * 10 };
    if (zoneContains(crater, { ...far, y: 0 })) expect(hydrogenReading(far, true, zones, n)).toBe(n.coldBackground);
  });

  it('the ice signal needs permanent shadow: sunlit ground near the ice reads the floor', () => {
    const out = { x: entry.x - (ice.x - entry.x) * 0.5, z: entry.z - (ice.z - entry.z) * 0.5 };
    if (!zoneContains(crater, { ...out, y: 0 })) expect(hydrogenReading(out, false, zones, n)).toBe(n.noiseFloor);
  });

  it('jitter wobbles the reading by at most the tuning amount, within 0..1', () => {
    expect(hydrogenReading({ x: L.x, z: L.z }, false, zones, n, 1)).toBeCloseTo(n.noiseFloor + n.jitter);
    expect(hydrogenReading({ x: L.x, z: L.z }, false, zones, n, 0)).toBeCloseTo(Math.max(0, n.noiseFloor - n.jitter));
    expect(hydrogenReading(ice, true, zones, n, 1)).toBe(1);
  });
});

describe('neutron spectrometer: cold trap edges and the hydrogen anomaly (real sites)', () => {
  const n = it_.neutron;
  const sites = resolveSites(data.sites.sites, f);
  const sz = buildZones({
    landing: terrain.landing.local,
    rimViewpoints: f.rimViewpoints,
    rockyAreas: f.rockyAreas,
    shadowedCrater: f.shadowedCrater as unknown as MilestoneFeatures['shadowedCrater'],
    craterDescent: f.craterDescent,
  }, data.tuning.milestones, { sites, neutron: n });
  const read = (p: { x: number; z: number }) => hydrogenReading(p, false, sz, n);
  // The East cold trap is the pipeline's permanent-shadow outline (a polygon) plus the survey edge.
  const east = sz.find((z) => z.key === 'cold-trap:east-cold-trap')!;
  if (east.shape.kind !== 'polygon') throw new Error('east cold trap should be the pipeline outline');
  const eastPts = east.shape.points;
  const [emx, emz] = eastPts.reduce((a, q) => (q[0] > a[0] ? q : a));
  const eastAt = (d: number) => ({ x: emx + d, z: emz }); // due east of its easternmost outline point

  it('a cold trap reads the cold background to its outline, then ramps down to the noise floor', () => {
    const c = sites.find((x) => x.id === 'east-cold-trap')!.center;
    expect(read(c)).toBe(n.coldBackground);
    expect(read(eastAt(0))).toBeCloseTo(n.coldBackground);
    const half = eastAt(n.edgeRampM / 2);
    const d = distanceToOutline(east, half);
    expect(d).toBeCloseTo(n.edgeRampM / 2, 0);
    expect(read(half)).toBeCloseTo(n.coldBackground + ((n.noiseFloor - n.coldBackground) * d) / n.edgeRampM);
    expect(read(eastAt(n.edgeRampM + 1))).toBe(n.noiseFloor);
    expect(read(eastAt(n.edgeRampM * 2))).toBe(n.noiseFloor);
  });

  it('the ramp also reaches outside the dark crater polygon, and inside it nothing changes', () => {
    const dark = sz.find((z) => z.key === 'cold-trap:dark-crater')!;
    expect(dark.shape.kind).toBe('polygon');
    if (dark.shape.kind !== 'polygon') return;
    const pts = dark.shape.points;
    const mid = f.shadowedCrater.iceCandidate.local; // inside the outline
    expect(read(mid)).toBeGreaterThanOrEqual(n.coldBackground);
    // Step out from the first outline point, away from the middle, until outside; reading is on the ramp.
    const q = { x: pts[0]![0], z: pts[0]![1] };
    const len = Math.hypot(q.x - mid.x, q.z - mid.z);
    const dir = { x: (q.x - mid.x) / len, z: (q.z - mid.z) / len };
    let out = { x: q.x, z: q.z };
    for (let k = 1; k < 200 && distanceToOutline(dark, out) === 0; k++) out = { x: q.x + dir.x * k, z: q.z + dir.z * k };
    const d = distanceToOutline(dark, out);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(n.edgeRampM);
    expect(read(out)).toBeCloseTo(n.coldBackground + (n.noiseFloor - n.coldBackground) * (d / n.edgeRampM));
    // Inside the dark crater: the ice spot still reads 1.
    expect(hydrogenReading(f.shadowedCrater.iceCandidate.local, true, sz, n)).toBe(1);
  });

  it('the hidden hydrogen anomaly peaks at its center, reads the edge value at the zone edge and fades out by anomalyRangeM', () => {
    const z = sz.find((x) => x.id === 'hydrogen-anomaly')!;
    if (z.shape.kind !== 'circle') throw new Error('anomaly should be a circle');
    const { x, z: zz, r } = z.shape;
    const at = (d: number) => ({ x: x + d, z: zz });
    expect(read({ x, z: zz })).toBe(n.anomalyPeak);
    expect(read(at(r / 2))).toBeCloseTo((n.anomalyPeak + n.anomalyEdge) / 2);
    expect(read(at(r))).toBeCloseTo(n.anomalyEdge);
    expect(read(at((r + n.anomalyRangeM) / 2))).toBeCloseTo((n.anomalyEdge + n.noiseFloor) / 2);
    expect(read(at(n.anomalyRangeM))).toBe(n.noiseFloor);
    expect(read(at(n.anomalyRangeM + 50))).toBe(n.noiseFloor);
    for (let d = 0; d <= r; d += r / 10) expect(read(at(d))).toBeGreaterThan(n.coldBackground);
  });

  it('overlapping sources read the highest', () => {
    const z = sz.find((x) => x.id === 'hydrogen-anomaly')!;
    if (z.shape.kind !== 'circle') return;
    // A cold trap and an anomaly on the same spot: the anomaly's peak beats the cold background.
    const both = [...sz, { ...east, key: 'cold-trap:test', shape: { kind: 'circle' as const, x: z.shape.x, z: z.shape.z, r: 30 + (east.edgeM ?? 0) } }];
    expect(hydrogenReading({ x: z.shape.x, z: z.shape.z }, false, both, n)).toBe(n.anomalyPeak);
    // 10 m past the anomaly zone's edge (and 10 m + r - 30 past the test trap's outline) both apply:
    // the meter shows the anomaly's outer segment, which is above the trap's edge ramp there.
    const r = z.shape.r;
    const d = r + 10;
    const anomaly = n.anomalyEdge + ((n.noiseFloor - n.anomalyEdge) * (d - r)) / (n.anomalyRangeM - r);
    const ramp = Math.max(n.noiseFloor, n.coldBackground + ((n.noiseFloor - n.coldBackground) * (d - 30)) / n.edgeRampM);
    expect(anomaly).toBeGreaterThan(ramp);
    expect(hydrogenReading({ x: z.shape.x + d, z: z.shape.z }, false, both, n)).toBeCloseTo(anomaly, 9);
    // Inside the test trap, beyond the anomaly's reach, the cold background shows.
    const far = [...sz, { ...east, key: 'cold-trap:far', shape: { kind: 'circle' as const, x: z.shape.x + 1000, z: z.shape.z, r: 30 + (east.edgeM ?? 0) } }];
    expect(hydrogenReading({ x: z.shape.x + 1000, z: z.shape.z }, false, far, n)).toBe(n.coldBackground);
  });
});

describe('X-ray spectrometer: boulders and rock types', () => {
  const boulders: Boulder[] = [{ x: 0, z: 0, radius: 1 }, { x: 10, z: 0, radius: 0.5 }];
  const x = testTuning.instruments.xray;

  it('targets the nearest boulder whose surface is within reach, or none', () => {
    expect(xrayTarget({ x: 3.5, z: 0 }, boulders, x)).toMatchObject({ index: 0, gapM: 2.5 });
    expect(xrayTarget({ x: 7, z: 0 }, boulders, x)).toMatchObject({ index: 1, gapM: 2.5 });
    expect(xrayTarget({ x: 3.9, z: 0 }, boulders, x)?.index).toBe(0);
    expect(xrayTarget({ x: 5, z: 0 }, boulders, x)).toBeNull(); // 4 m from boulder 0's surface, 4.5 m from boulder 1's
    expect(xrayTarget({ x: 5, z: 3 }, boulders, x)).toBeNull();
    expect(xrayTarget({ x: 0, z: 0 }, [], x)).toBeNull();
  });

  it('a boulder always reads the same rock, and the rocks follow their weights', () => {
    const b = { x: 123.4, z: -56.7, radius: 0.8 };
    expect(rockTypeFor(b, x, [])).toBe(rockTypeFor({ ...b }, x, []));
    const many = scatterBoulders([{ x: 0, z: 0, radiusM: 200 }], { ...testTuning.boulders, perRockyArea: 4000 });
    const common = many.filter((m) => rockTypeFor(m, x, []) === 'common').length / many.length;
    expect(common).toBeGreaterThan(0.7);
    expect(common).toBeLessThan(0.8); // weight 3 of 4
  });

  it('the real boulder fields hold several of the placeholder rock types', () => {
    const areas = f.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
    const rocks = new Set(scatterBoulders(areas, data.tuning.boulders).map((b) => rockTypeFor(b, it_.xray, [])));
    expect(rocks.size).toBe(it_.xray.rocks.length);
    for (const r of it_.xray.rocks) expect(data.text.rocks[r.id]?.name).toBeTruthy();
  });
});

describe('rock suites by site', () => {
  const x = it_.xray;
  const specs = data.sites.sites;
  const grid = (site: string | undefined, n: number): Boulder[] =>
    Array.from({ length: n }, (_, i) => ({ x: i * 7.3 - 400, z: (i % 37) * 3.1, radius: 0.2 + (i % 11) * 0.1, ...(site ? { site } : {}) }));

  it('the same boulder always reads the same rock', () => {
    const b = { x: 5.5, z: -9.1, radius: 0.7, site: 'east-crater' };
    expect(rockTypeFor(b, x, specs)).toBe(rockTypeFor({ ...b }, x, specs));
  });

  it('a site boulder reads only rocks of its suite, and a 2-rock suite shows both', () => {
    for (const s of specs) {
      const suite = s.rockSuite ? x.suites.find((u) => u.id === s.rockSuite) : undefined;
      if (!suite) continue;
      const seen = new Set(grid(s.id, 600).map((b) => rockTypeFor(b, x, specs)));
      for (const r of seen) expect(suite.rocks.map((q) => q.id)).toContain(r);
      if (suite.rocks.length === 2) expect(seen.size).toBe(2);
    }
  });

  it('the rolled boulder reads magnesian norite', () => {
    expect(rockTypeFor({ x: -240, z: -120, radius: 1.75, site: 'rolled-boulder', rolled: true }, x, specs)).toBe('magnesian-norite');
  });

  it('a boulder with no site or an unknown site reads the fallback list', () => {
    const fallback = new Set(x.rocks.map((r) => r.id));
    for (const site of [undefined, 'nowhere']) {
      for (const b of grid(site, 100)) expect(fallback.has(rockTypeFor(b, x, specs))).toBe(true);
    }
  });
});

describe('seismometer station: the moonquake record', () => {
  const s = testTuning.instruments.seismometer; // 20 s window, 150 m quiet distance
  const at = { seconds: 50, x: 0, z: 0 };
  const track = (points: [number, number, boolean][]): TrackPoint[] => points.map(([seconds, x, moving]) => ({ seconds, x, z: 0, moving }));

  it('no record without a station, or with one set down after the quake', () => {
    expect(seismometerRecord(null, [], 100, s)).toBeNull();
    expect(seismometerRecord({ ...at, seconds: 101 }, [], 100, s)).toBeNull();
  });

  it('clean when the rover kept away or stood still nearby during the window', () => {
    expect(seismometerRecord(at, track([[85, 200, true], [95, 10, false]]), 100, s)).toEqual({ quality: 'clean', closestM: 200 });
    expect(seismometerRecord(at, [], 100, s)).toEqual({ quality: 'clean', closestM: Infinity });
  });

  it('noisy when the rover drove within the quiet distance during the window; driving before the window does not count', () => {
    expect(seismometerRecord(at, track([[90, 100, true]]), 100, s)).toEqual({ quality: 'noisy', closestM: 100 });
    expect(seismometerRecord(at, track([[60, 5, true], [85, 300, true]]), 100, s)?.quality).toBe('clean');
    expect(seismometerRecord(at, track([[101, 5, true]]), 100, s)?.quality).toBe('clean'); // after the quake
  });

  it('the window starts no earlier than the station was set down', () => {
    expect(seismometerRecord({ ...at, seconds: 95 }, track([[90, 5, true], [96, 400, true]]), 100, s)?.quality).toBe('clean');
  });
});

describe('seismometer station: the track over a mission (stepSeismometer)', () => {
  const s = testTuning.instruments.seismometer; // 20 s window, 150 m quiet distance
  const pt = (seconds: number, x: number, moving = true): TrackPoint => ({ seconds, x, z: 0, moving });
  /** Run steps of [seconds, rover x, moving, deployed here?, quake?]. */
  const steps = (list: [number, number, boolean, boolean?, boolean?][], start: SeismometerTrack = emptySeismometerTrack()) => {
    let tr = start;
    const outcomes = [];
    for (const [seconds, x, moving, deployed, quake] of list) {
      const r = stepSeismometer(tr, { point: pt(seconds, x, moving), deployed: deployed ? { x: 0, z: 0 } : null, quake: Boolean(quake) }, s);
      tr = r.track;
      outcomes.push(...r.outcomes);
    }
    return { tr, outcomes };
  };

  it('keeps no track before a station is down, and keeps only the record window while it records', () => {
    expect(steps([[1, 0, true], [2, 5, true]]).tr.points).toEqual([]);
    const { tr, outcomes } = steps([[10, 0, false, true], [20, 50, true], [35, 200, true]]);
    expect(outcomes).toEqual([{ kind: 'deployed' }]);
    expect(seismometerRecording(tr)).toBe(true);
    expect(tr.points.map((p) => p.seconds)).toEqual([20, 35]); // 10 is more than 20 s before 35
  });

  it('trims the record window in place: the same points array from step to step', () => {
    const first = steps([[10, 0, false, true], [20, 50, true]]).tr;
    const points = first.points;
    const later = steps([[35, 200, true], [45, 210, true]], first).tr;
    expect(later.points).toBe(points);
    expect(later.points.map((p) => p.seconds)).toEqual([35, 45]);
  });

  it('records the quake once: noisy when the rover drove near in the window, clean when it kept away', () => {
    const noisy = steps([[10, 0, false, true], [95, 100, true], [100, 300, true, false, true]]);
    expect(noisy.outcomes).toEqual([{ kind: 'deployed' }, { kind: 'recorded', record: { quality: 'noisy', closestM: 100 } }]);
    expect(noisy.tr.result).toBe('noisy');
    expect(seismometerRecording(noisy.tr)).toBe(false);
    const clean = steps([[10, 0, false, true], [40, 20, true], [95, 300, true], [100, 300, true, false, true]]);
    expect(clean.outcomes.at(-1)).toEqual({ kind: 'recorded', record: { quality: 'clean', closestM: 300 } });
    // A second quake (development tool) changes nothing.
    expect(steps([[110, 0, true, false, true]], clean.tr).outcomes).toEqual([]);
  });

  it('deployed after the quake: missed', () => {
    const { tr, outcomes } = steps([[100, 0, false, false, true], [120, 0, false, true]]);
    expect(outcomes).toEqual([{ kind: 'missed' }]);
    expect(tr.result).toBe('missed');
    expect(seismometerRecording(tr)).toBe(false);
  });

  it('a station that finishes setting down in the same step as the quake counts as down in time', () => {
    const { tr, outcomes } = steps([[100, 0, false, true, true]]);
    expect(outcomes).toEqual([{ kind: 'deployed' }, { kind: 'recorded', record: { quality: 'clean', closestM: Infinity } }]);
    expect(tr.result).toBe('clean');
  });
});

describe('station placement near the lander', () => {
  const secs = it_.stationConfirmSeconds;
  const near = { x: L.x, z: L.z };
  const far = { x: L.x + 5000, z: L.z };

  it('is too close only inside the near-lander zone', () => {
    expect(stationTooClose(near, zones)).toBe(true);
    expect(stationTooClose(far, zones)).toBe(false);
  });

  it('the Earth refusal comes before the too-close warning', () => {
    expect(stationHint(true, false, true)).toBe('no-earth');
    expect(stationHint(true, false, false)).toBe('no-earth');
    expect(stationHint(true, true, true)).toBe('too-close');
    expect(stationHint(false, false, true)).toBe('too-close');
    expect(stationHint(false, false, false)).toBe('ok');
    expect(stationHint(true, true, false)).toBe('ok');
  });

  it('the reflector light has three states', () => {
    expect(reflectorEarthLight(false, true)).toBe('hidden');
    expect(reflectorEarthLight(false, false)).toBe('hidden');
    expect(reflectorEarthLight(true, false)).toBe('in-view');
    expect(reflectorEarthLight(true, true)).toBe('in-view-too-close');
  });

  it('places at once outside the near-lander zone', () => {
    expect(stationPress(null, 'seismometer', 10, false, secs)).toEqual({ action: 'place', pending: null });
    expect(stationPress({ instrument: 'seismometer', seconds: 9 }, 'seismometer', 10, false, secs)).toEqual({ action: 'place', pending: null });
  });

  it('inside the zone the second press for the same instrument within the window places it', () => {
    const first = stationPress(null, 'seismometer', 10, true, secs);
    expect(first).toEqual({ action: 'confirm', pending: { instrument: 'seismometer', seconds: 10 } });
    expect(stationPress(first.pending, 'seismometer', 10 + secs, true, secs)).toEqual({ action: 'place', pending: null });
  });

  it('just past the window the press starts a new confirmation', () => {
    const pending = { instrument: 'seismometer' as const, seconds: 10 };
    expect(stationPress(pending, 'seismometer', 10 + secs + 0.01, true, secs))
      .toEqual({ action: 'confirm', pending: { instrument: 'seismometer', seconds: 10 + secs + 0.01 } });
  });

  it('a pending press for another instrument does not count', () => {
    expect(stationPress({ instrument: 'reflector', seconds: 10 }, 'seismometer', 11, true, secs))
      .toEqual({ action: 'confirm', pending: { instrument: 'seismometer', seconds: 11 } });
  });
});

describe('site boulders (young craters and the rolled boulder)', () => {
  const b = data.tuning.boulders;
  const sites = resolveSites(data.sites.sites, f);
  const list = scatterSiteBoulders(sites, b);
  const craters = sites.filter((s) => s.kind === 'young-crater' && s.radiusM !== undefined);

  it('holds perYoungCrater boulders per young crater and one rolled boulder', () => {
    expect(list.length).toBe(craters.length * b.perYoungCrater + 1);
    for (const c of craters) expect(list.filter((x) => x.site === c.id).length).toBe(b.perYoungCrater);
    expect(list.filter((x) => x.rolled).length).toBe(1);
  });

  it('young-crater boulders lie within the spread and have the usual sizes', () => {
    for (const c of craters) {
      for (const x of list.filter((q) => q.site === c.id)) {
        expect(Math.hypot(x.x - c.center.x, x.z - c.center.z)).toBeLessThanOrEqual(c.radiusM! * b.spreadRadiusFactor + 1e-9);
        expect(x.radius * 2).toBeGreaterThanOrEqual(b.minDiameterM - 1e-9);
        expect(x.radius * 2).toBeLessThanOrEqual(b.maxDiameterM + 1e-9);
      }
    }
  });

  it('the rolled boulder sits at its site with the tuned size', () => {
    const rolled = list.find((x) => x.rolled)!;
    const site = sites.find((s) => s.kind === 'rolled-boulder')!;
    expect(rolled).toMatchObject({ x: site.center.x, z: site.center.z, radius: b.rolledBoulderDiameterM / 2, site: site.id });
  });

  it('is the same on every call, and does not move the rocky-area boulders', () => {
    expect(scatterSiteBoulders(sites, b)).toEqual(list);
    const areas = [{ x: 0, z: 0, radiusM: 50 }];
    const plain = scatterBoulders(areas, b);
    const tagged = scatterBoulders([{ ...areas[0]!, site: 'rocky-area-1' }], b);
    expect(tagged.map(({ site, ...p }) => p)).toEqual(plain);
    expect(tagged.every((x) => x.site === 'rocky-area-1')).toBe(true);
    expect(plain.every((x) => x.site === undefined)).toBe(true);
  });
});
