import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import terrain from '../../public/terrain/terrain.json';
import { buildZones, zoneContains, type MilestoneFeatures } from './milestones';
import {
  emptySeismometerTrack, hydrogenReading, rockTypeFor, seismometerRecord, seismometerRecording, stepSeismometer, xrayTarget,
  type SeismometerTrack, type TrackPoint,
} from './instruments';
import { scatterBoulders, type Boulder } from './boulders';
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
    expect(rockTypeFor(b, x)).toBe(rockTypeFor({ ...b }, x));
    const many = scatterBoulders([{ x: 0, z: 0, radiusM: 200 }], { ...testTuning.boulders, perRockyArea: 4000 });
    const common = many.filter((m) => rockTypeFor(m, x) === 'common').length / many.length;
    expect(common).toBeGreaterThan(0.7);
    expect(common).toBeLessThan(0.8); // weight 3 of 4
  });

  it('the real boulder fields hold several of the placeholder rock types', () => {
    const areas = f.rockyAreas.map((a) => ({ x: a.local.x, z: a.local.z, radiusM: a.radius_m }));
    const rocks = new Set(scatterBoulders(areas, data.tuning.boulders).map((b) => rockTypeFor(b, it_.xray)));
    expect(rocks.size).toBe(it_.xray.rocks.length);
    for (const r of it_.xray.rocks) expect(data.text.rocks[r.id]?.name).toBeTruthy();
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
