// What the Moon's new instruments read: the neutron spectrometer's hydrogen meter, the X-ray
// spectrometer's boulder target and rock type, and the seismometer station's moonquake record. The
// mission screen measures (position, cold, track) and draws; the numbers are in tuning.instruments.
// Pure: no rendering, no DOM.
import type { Instrument, InstrumentTuning } from './types';
import type { Boulder } from './boulders';
import { zoneContains, type Point, type Zone } from './milestones';

/**
 * The neutron spectrometer's live hydrogen reading, 0 to 1. Hydrogen in the top meter of soil cuts
 * the neutrons escaping the surface, which is what the meter senses. In permanent shadow (inside the
 * dark crater's outline or any other cold zone) the reading is at least the cold background, and it
 * rises toward the hidden ice spot: from 0 at `iceRangeM` to 1 at the spot's center. Ordinary ground
 * reads the noise floor. `jitter` (0..1, 0.5 = none) wobbles the reading by up to ± t.jitter, so the
 * meter looks live; the mission screen passes a random number.
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
 * The rock type an X-ray reading finds at a boulder: picked by weight from the placeholder list in
 * tuning, seeded by the boulder's position, so the same boulder always reads the same rock. Which
 * rocks lie where is Moon content for later map work (rover-engineering-design.md).
 */
export function rockTypeFor(b: Boulder, t: InstrumentTuning['xray']): string {
  const total = t.rocks.reduce((s, r) => s + r.weight, 0);
  let pick = boulderHash(b) * total;
  for (const r of t.rocks) {
    pick -= r.weight;
    if (pick < 0) return r.id;
  }
  return t.rocks[t.rocks.length - 1]!.id;
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

/** What the new instruments recorded in one mission, for the debrief's instrument log. Earns nothing yet. */
export interface InstrumentLog {
  carried: Instrument[]; // the payload at launch, in bay order
  rocks: { boulder: number; rock: string }[]; // X-ray readings, one per boulder, in order
  quake: 'clean' | 'noisy' | 'missed' | null; // seismometer: missed = set down after the quake; null = no station down at a quake
  reflectorPlaced: boolean;
  hydrogenPeak: number | null; // highest neutron spectrometer reading (null: never switched on)
}

export function emptyInstrumentLog(carried: Instrument[]): InstrumentLog {
  return { carried: [...carried], rocks: [], quake: null, reflectorPlaced: false, hydrogenPeak: null };
}
