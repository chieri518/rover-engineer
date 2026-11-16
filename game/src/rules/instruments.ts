// What the Moon's new instruments read: the neutron spectrometer's hydrogen meter, the X-ray
// spectrometer's boulder target and rock type, and the seismometer station's moonquake record. The
// mission screen measures (position, cold, track) and draws; the numbers are in tuning.instruments.
// Pure: no rendering, no DOM.
import type { Instrument, InstrumentTuning, SiteSpec } from './types';
import type { Boulder } from './boulders';
import { distanceToOutline, zoneContains, type Point, type Zone } from './milestones';

/** A straight line from `a` at distance 0 to `b` at distance `len`. */
const ramp = (d: number, len: number, a: number, b: number): number => a + (b - a) * Math.min(1, Math.max(0, d / len));

/**
 * The neutron spectrometer's live hydrogen reading, 0 to 1. Hydrogen in the top meter of soil cuts
 * the neutrons escaping the surface, which is what the meter senses. The reading is the highest of:
 * - the noise floor, on ordinary ground;
 * - a cold trap (any `cold-trap` zone, the dark crater's included): the cold background inside its
 *   outline, falling in a straight line to the noise floor over `edgeRampM` outside it;
 * - the hidden hydrogen spot (a `hydrogen-anomaly` zone): `anomalyPeak` at its center, `anomalyEdge`
 *   at the zone edge, then down to the noise floor at `anomalyRangeM`;
 * - the dark crater's ice signal: inside its outline the reading is at least the cold background and
 *   rises toward the hidden ice spot, from 0 at `iceRangeM` to 1 at the spot's center.
 * `jitter` (0..1, 0.5 = none) wobbles the reading by up to ± t.jitter, so the meter looks live; the
 * mission screen passes a random number.
 */
export function hydrogenReading(p: Point, inColdZone: boolean, zones: Zone[], t: InstrumentTuning['neutron'], jitter = 0.5): number {
  const crater = zones.find((z) => z.id === 'shadowed-crater');
  const ice = zones.find((z) => z.id === 'ice-spot');
  const p3 = { x: p.x, y: 0, z: p.z };
  const inCrater = crater ? zoneContains(crater, p3) : false;
  let base = t.noiseFloor;
  if (inColdZone || inCrater) {
    base = Math.max(base, t.coldBackground);
    if (inCrater && ice?.shape.kind === 'circle') {
      const d = Math.hypot(p.x - ice.shape.x, p.z - ice.shape.z);
      base = Math.max(base, 1 - d / t.iceRangeM);
    }
  }
  for (const z of zones) {
    if (z.id === 'cold-trap') {
      const d = distanceToOutline(z, p);
      if (d < t.edgeRampM) base = Math.max(base, ramp(d, t.edgeRampM, t.coldBackground, t.noiseFloor));
    } else if (z.id === 'hydrogen-anomaly' && z.shape.kind === 'circle') {
      const d = Math.hypot(p.x - z.shape.x, p.z - z.shape.z);
      const r = z.shape.r;
      if (d <= r) base = Math.max(base, ramp(d, r, t.anomalyPeak, t.anomalyEdge));
      else if (d < t.anomalyRangeM) base = Math.max(base, ramp(d - r, t.anomalyRangeM - r, t.anomalyEdge, t.noiseFloor));
    }
  }
  return Math.min(1, Math.max(0, base + (jitter * 2 - 1) * t.jitter));
}

/** The boulder the X-ray spectrometer would read: the nearest whose surface is within reach. */
export interface XrayTarget {
  index: number; // in the boulder list (scatterBoulders order): identifies the boulder
  boulder: Boulder;
  gapM: number; // from the rover's center to the boulder's surface
}

/** The nearest boulder within `reachM` of the rover (surface distance), or null. */
export function xrayTarget(p: Point, boulders: readonly Boulder[], t: InstrumentTuning['xray']): XrayTarget | null {
  let best: XrayTarget | null = null;
  boulders.forEach((b, index) => {
    const gapM = Math.max(0, Math.hypot(p.x - b.x, p.z - b.z) - b.radius);
    if (gapM <= t.reachM && (!best || gapM < best.gapM)) best = { index, boulder: b, gapM };
  });
  return best;
}

/** A number in [0, 1) from a boulder's position, the same on every run (FNV-1a over its rounded coordinates). */
function boulderHash(b: Boulder): number {
  let h = 0x811c9dc5;
  for (const v of [Math.round(b.x * 100), Math.round(b.z * 100), Math.round(b.radius * 1000)]) {
    for (let i = 0; i < 4; i++) {
      h ^= (v >>> (i * 8)) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * The rock type an X-ray reading finds at a boulder: picked by weight, seeded by the boulder's
 * position, so the same boulder always reads the same rock. A boulder at a site whose `rockSuite`
 * names a suite in tuning reads from that suite; any other boulder reads the fallback `rocks` list.
 */
export function rockTypeFor(b: Boulder, t: InstrumentTuning['xray'], sites?: readonly SiteSpec[]): string {
  const suiteId = b.site ? sites?.find((s) => s.id === b.site)?.rockSuite : undefined;
  const rocks = (suiteId && t.suites.find((s) => s.id === suiteId)?.rocks) || t.rocks;
  const total = rocks.reduce((s, r) => s + r.weight, 0);
  let pick = boulderHash(b) * total;
  for (const r of rocks) {
    pick -= r.weight;
    if (pick < 0) return r.id;
  }
  return rocks[rocks.length - 1]!.id;
}

/** Where the rover was at a moment of the mission: the seismometer listens for its driving. */
export interface TrackPoint {
  seconds: number;
  x: number;
  z: number;
  moving: boolean; // the rover was driving (above tuning.ground.movingSpeedMps)
}

/** Where and when a seismometer station was set down. */
export interface Deployment {
  seconds: number;
  x: number;
  z: number;
}

/** The station's moonquake record: clean, or noisy because the rover drove close while it recorded. */
export interface SeismometerRecord {
  quality: 'clean' | 'noisy';
  closestM: number; // closest the driving rover came during the recording window (Infinity: it never drove)
}

/**
 * The moonquake as the seismometer station recorded it. No record (null) without a station on the
 * ground at the quake. The station records for `recordWindowSeconds` before the quake (from when it
 * was set down, if later); the trace is noisy if the rover drove within `quietDistanceM` of it
 * during that time, as Chandrayaan-3's ILSA seismometer recorded its own rover driving nearby.
 */
export function seismometerRecord(
  deployedAt: Deployment | null,
  track: readonly TrackPoint[],
  quakeAt: number,
  t: InstrumentTuning['seismometer'],
): SeismometerRecord | null {
  if (!deployedAt || deployedAt.seconds > quakeAt) return null;
  const from = Math.max(deployedAt.seconds, quakeAt - t.recordWindowSeconds);
  let closestM = Infinity;
  for (const p of track) {
    if (!p.moving || p.seconds < from || p.seconds > quakeAt) continue;
    closestM = Math.min(closestM, Math.hypot(p.x - deployedAt.x, p.z - deployedAt.z));
  }
  return { quality: closestM < t.quietDistanceM ? 'noisy' : 'clean', closestM };
}

/**
 * The seismometer station over one mission: where it stands, the rover's recent track while it
 * records, the first moonquake, and the station's one record. stepSeismometer moves it on each step.
 */
export interface SeismometerTrack {
  deployedAt: Deployment | null;
  points: TrackPoint[]; // the rover's track while the station records, trimmed to the record window
  quakeAt: number | null; // mission seconds of the step the first moonquake struck in
  result: 'clean' | 'noisy' | 'missed' | null; // the one record per mission (missed: set down after the quake)
}

export function emptySeismometerTrack(): SeismometerTrack {
  return { deployedAt: null, points: [], quakeAt: null, result: null };
}

/** True while a station on the ground is waiting for the moonquake (it listens for the rover's driving). */
export function seismometerRecording(tr: SeismometerTrack): boolean {
  return tr.deployedAt !== null && tr.result === null;
}

/** What one step meant for the station, for the mission screen's notices and HUD trace. */
export type SeismometerOutcome =
  | { kind: 'deployed' }
  | { kind: 'missed' } // set down after the moonquake: nothing to record
  | { kind: 'recorded'; record: SeismometerRecord };

/** What happened to the station in one step. */
export interface SeismometerStepInput {
  point: TrackPoint; // the rover at the end of the step (point.seconds = mission time)
  deployed?: { x: number; z: number } | null; // the station was set down this step, here
  quake: boolean; // the moonquake struck this step
}

/**
 * One mission step for the seismometer station, in this order: a station set down this step, the
 * rover's position, then a moonquake this step. The quake counts at the step's time, so a station
 * that finishes setting down in the same step as the quake counts as down in time (as in
 * seismometerRecord, which needs deployedAt.seconds <= quakeAt). A station set down after an
 * earlier quake has missed it. Only the first quake counts: one record per mission.
 * The track's `points` array is updated in place and shared with the returned track, so keep only the
 * returned track (the mission screen replaces its track each step).
 */
export function stepSeismometer(
  tr: SeismometerTrack,
  input: SeismometerStepInput,
  t: InstrumentTuning['seismometer'],
): { track: SeismometerTrack; outcomes: SeismometerOutcome[] } {
  const { point } = input;
  const next: SeismometerTrack = { ...tr };
  const outcomes: SeismometerOutcome[] = [];
  if (input.deployed && !tr.deployedAt) {
    next.deployedAt = { seconds: point.seconds, x: input.deployed.x, z: input.deployed.z };
    if (tr.quakeAt !== null && tr.quakeAt < point.seconds) {
      next.result = 'missed';
      outcomes.push({ kind: 'missed' });
    } else outcomes.push({ kind: 'deployed' });
  }
  if (seismometerRecording(next)) {
    // Trimmed in place (the points are in time order): no copy of the window every step.
    const from = point.seconds - t.recordWindowSeconds;
    let old = 0;
    while (old < next.points.length && next.points[old]!.seconds < from) old++;
    if (old > 0) next.points.splice(0, old);
    next.points.push(point);
  }
  if (input.quake && next.quakeAt === null) {
    next.quakeAt = point.seconds;
    if (seismometerRecording(next)) {
      const record = seismometerRecord(next.deployedAt, next.points, point.seconds, t);
      if (record) {
        next.result = record.quality;
        next.points = [];
        outcomes.push({ kind: 'recorded', record });
      }
    }
  }
  return { track: next, outcomes };
}

/** What the new instruments recorded in one mission, for the debrief's instrument log. Earns nothing yet. */
export interface InstrumentLog {
  carried: Instrument[]; // the payload at launch, in bay order
  rocks: { boulder: number; rock: string }[]; // X-ray readings, one per boulder, in order
  quake: 'clean' | 'noisy' | 'missed' | null; // seismometer: missed = set down after the quake; null = no station down at a quake
  stationPlaced: boolean; // the seismometer station was set down (whether or not a quake came after)
  reflectorPlaced: boolean;
  hydrogenPeak: number | null; // highest neutron spectrometer reading (null: never switched on)
}

export function emptyInstrumentLog(carried: Instrument[]): InstrumentLog {
  return { carried: [...carried], rocks: [], quake: null, stationPlaced: false, reflectorPlaced: false, hydrogenPeak: null };
}

/** True inside the near-lander zone: ground the lander disturbed, too close to set a station down. */
export function stationTooClose(p: Point, zones: Zone[]): boolean {
  const z = zones.find((x) => x.id === 'near-lander');
  return z ? zoneContains(z, { x: p.x, y: 0, z: p.z }) : false;
}

/** What a station's key says on the ground: a needsEarth station without Earth in view is refused outright, ahead of the too-close warning. */
export function stationHint(needsEarth: boolean, earthInView: boolean, tooClose: boolean): 'no-earth' | 'too-close' | 'ok' {
  if (needsEarth && !earthInView) return 'no-earth';
  return tooClose ? 'too-close' : 'ok';
}

/** The reflector's Earth light: hidden, in view, or in view but too close to the lander. */
export function reflectorEarthLight(earthInView: boolean, tooClose: boolean): 'hidden' | 'in-view' | 'in-view-too-close' {
  if (!earthInView) return 'hidden';
  return tooClose ? 'in-view-too-close' : 'in-view';
}

/** A first press of a station key inside the near-lander zone, waiting for its confirming second press. */
export interface StationPending {
  instrument: Instrument;
  seconds: number;
}

/**
 * One press of a station key. Outside the near-lander zone the station is set down at once. Inside,
 * the press for the same instrument within `confirmSeconds` (inclusive) of the pending first press
 * sets it down; any other press is a first press and waits for confirmation.
 */
export function stationPress(
  pending: StationPending | null,
  instrument: Instrument,
  seconds: number,
  tooClose: boolean,
  confirmSeconds: number,
): { action: 'place' | 'confirm'; pending: StationPending | null } {
  if (!tooClose) return { action: 'place', pending: null };
  if (pending && pending.instrument === instrument && seconds - pending.seconds <= confirmSeconds) return { action: 'place', pending: null };
  return { action: 'confirm', pending: { instrument, seconds } };
}
