// What the instruments read. The Moon's: the neutron spectrometer's hydrogen meter, the X-ray
// spectrometer's boulder target and rock type, and the seismometer station's moonquake record. Mars's
// (step 4a): the weather mast's earlier storm forecast and readout, the ground-penetrating radar's
// profile, the laser spectrometer's target, and the mast's wider photo zones. The mission screen
// measures (position, cold, track) and draws; the numbers are in tuning.instruments.
// Pure: no rendering, no DOM.
import type { Instrument, InstrumentTuning, LaserTuning, MastTuning, MilestoneTuning, Part, RadarTuning, SiteSpec, WeatherTuning } from './types';
import type { Boulder } from './boulders';
import type { DustStorm } from './storm';
import { distanceToOutline, distanceToPath, zoneContains, type Point, type Zone } from './milestones';

/** A straight line from `a` at distance 0 to `b` at distance `len`. */
const ramp = (d: number, len: number, a: number, b: number): number => a + (b - a) * Math.min(1, Math.max(0, d / len));

/**
 * The neutron spectrometer's live hydrogen reading, 0 to 1. Hydrogen in the top meter of soil cuts
 * the neutrons escaping the surface, which is what the meter senses. The reading is the highest of:
 * - the noise floor, on ordinary ground (raised by `rtgFloorRise` on a noisy rover, see below);
 * - a cold trap (any `cold-trap` zone, the dark crater's included): the cold background inside its
 *   outline, falling in a straight line to the noise floor over `edgeRampM` outside it;
 * - the hidden hydrogen spot (a `hydrogen-anomaly` zone): `anomalyPeak` at its center, `anomalyEdge`
 *   at the zone edge, then down to the noise floor at `anomalyRangeM`;
 * - the dark crater's ice signal: inside its outline the reading is at least the cold background and
 *   rises toward the hidden ice spot, from 0 at `iceRangeM` to 1 at the spot's center;
 * - Mars (Mars step 5b): inside a zone named in `unitReadings` (Séítah, the delta foot), that value.
 *   Mars has no cold traps, dark crater or ice spot, so only the floor, the units and the hidden
 *   hydrated ground apply there.
 * `jitter` (0..1, 0.5 = none) wobbles the reading by up to ± t.jitter, so the meter looks live; the
 * mission screen passes a random number (tests pass a fixed one).
 * `noisy`: the rover carries a part with `neutronNoise` (the RTG, hasNeutronNoise; C6, MS4). Its own
 * neutrons raise the floor by `rtgFloorRise` (signals above the raised floor read as before) and the
 * wobble is ± `rtgJitter` instead of ± jitter. Where the tuning has no RTG values (the Moon) it changes
 * nothing. A search cost only: the zones and milestones do not read the meter.
 */
export function hydrogenReading(p: Point, inColdZone: boolean, zones: Zone[], t: InstrumentTuning['neutron'], jitter = 0.5, noisy = false): number {
  const crater = zones.find((z) => z.id === 'shadowed-crater');
  const ice = zones.find((z) => z.id === 'ice-spot');
  const p3 = { x: p.x, y: 0, z: p.z };
  const inCrater = crater ? zoneContains(crater, p3) : false;
  let base = t.noiseFloor + (noisy ? (t.rtgFloorRise ?? 0) : 0);
  if (inColdZone || inCrater) {
    base = Math.max(base, t.coldBackground);
    if (inCrater && ice?.shape.kind === 'circle') {
      const d = Math.hypot(p.x - ice.shape.x, p.z - ice.shape.z);
      base = Math.max(base, 1 - d / t.iceRangeM);
    }
  }
  for (const z of zones) {
    const unit = t.unitReadings?.[z.id];
    if (unit !== undefined) {
      if (unit > base && zoneContains(z, p3)) base = unit;
    } else if (z.id === 'cold-trap') {
      const d = distanceToOutline(z, p);
      if (d < t.edgeRampM) base = Math.max(base, ramp(d, t.edgeRampM, t.coldBackground, t.noiseFloor));
    } else if (z.id === 'hydrogen-anomaly' && z.shape.kind === 'circle') {
      const d = Math.hypot(p.x - z.shape.x, p.z - z.shape.z);
      const r = z.shape.r;
      if (d <= r) base = Math.max(base, ramp(d, r, t.anomalyPeak, t.anomalyEdge));
      else if (d < t.anomalyRangeM) base = Math.max(base, ramp(d - r, t.anomalyRangeM - r, t.anomalyEdge, t.noiseFloor));
    }
  }
  const wobble = noisy && t.rtgJitter !== undefined ? t.rtgJitter : t.jitter;
  return Math.min(1, Math.max(0, base + (jitter * 2 - 1) * wobble));
}

/** True when a part among these carries `neutronNoise` (the RTG): pass it as hydrogenReading's `noisy`. */
export function hasNeutronNoise(parts: readonly Part[]): boolean {
  return parts.some((p) => p.effects.neutronNoise === true);
}

/** The boulder the X-ray spectrometer would read: the nearest whose surface is within reach. */
export interface XrayTarget {
  index: number; // in the boulder list (scatterBoulders order): identifies the boulder
  boulder: Boulder;
  gapM: number; // from the rover's center to the boulder's surface
}

/** True when a robotic arm is among the parts ("No arm" is not one). */
export function hasArm(parts: readonly Part[]): boolean {
  return parts.some((p) => p.effects.arm === true);
}

/**
 * How far a boulder reading (the X-ray, organics) reaches, surface distance from the rover's center: the
 * arm's reach with a robotic arm fitted on a world that offers it (tuning.instruments.arm), else the X-ray's
 * (the world's contact reach). The arm is the X-ray's optional upgrade (game-design.md, The X-ray
 * spectrometer and the robotic arm): without it the X-ray reads as it always has.
 */
export function contactReachM(armFitted: boolean, t: InstrumentTuning): number {
  return armFitted && t.arm ? t.arm.reachM : t.xray.reachM;
}

/** Ground-down X-ray readings: a robotic arm fitted on a world whose arm tuning has a groundDownFactor above 1. */
export function groundDownReadings(armFitted: boolean, t: InstrumentTuning): boolean {
  return armFitted && (t.arm?.groundDownFactor ?? 1) > 1;
}

/** The nearest boulder within `reachM` of the rover (surface distance), or null (pass contactReachM's reach, or the X-ray tuning). */
export function xrayTarget(p: Point, boulders: readonly Boulder[], t: { reachM: number }): XrayTarget | null {
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
 * `sites` is required (data.sites.sites, on either world): without it every site boulder would
 * silently read the fallback list, and the rare boulders (the Moon's rolled boulder, Mars's flood
 * boulder, whose suite holds only flood conglomerate) would never read their rare rock. On Mars each
 * site names one of the six suites (data/mars/tuning.json); a boulder with no site reads the fallback,
 * Máaz basalt. The laser reads the same rock as the X-ray; the organics spectrometer reads none.
 */
export function rockTypeFor(b: Boulder, t: InstrumentTuning['xray'], sites: readonly SiteSpec[]): string {
  const suiteId = b.site ? sites.find((s) => s.id === b.site)?.rockSuite : undefined;
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

/** What the instruments recorded in one mission, for the debrief's instrument log. */
export interface InstrumentLog {
  carried: Instrument[]; // the payload at launch, in bay order
  rocks: { boulder: number; rock: string }[]; // X-ray readings, one per boulder, in order
  quake: 'clean' | 'noisy' | 'missed' | null; // seismometer: missed = set down after the quake; null = no station down at a quake
  stationPlaced: boolean; // the seismometer station was set down (whether or not a quake came after)
  reflectorPlaced: boolean;
  hydrogenPeak: number | null; // highest neutron spectrometer reading (null: never switched on)
  // Mars (step 4a)
  weatherSeconds: number; // the weather mast switched on with the rover powered up
  stormForecastByMast: boolean; // the weather mast forecast the dust storm before the orbital report
  radarLongestM: number | null; // the radar's longest unbroken profile (null: never switched on)
  radarLayers: string[]; // the layer kinds the radar profiled, in the order first seen
  laser: LaserReading[]; // laser readings, in order
  organics: number; // finished organics readings
}

/** One laser spectrometer reading: a boulder (with the rock type it read) or the delta cliff. */
export interface LaserReading {
  target: 'boulder' | 'cliff';
  boulder: number | null; // index in the boulder list (null for the cliff)
  rock: string | null; // the rock type read (rockTypeFor; null for the cliff)
}

export function emptyInstrumentLog(carried: Instrument[]): InstrumentLog {
  return {
    carried: [...carried], rocks: [], quake: null, stationPlaced: false, reflectorPlaced: false, hydrogenPeak: null,
    weatherSeconds: 0, stormForecastByMast: false, radarLongestM: null, radarLayers: [], laser: [], organics: 0,
  };
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

/**
 * How many rock types the X-ray spectrometer can find: the distinct rocks across the site suites, the
 * total in the readout's "New type: 3 of 5" (the Moon) or "New type: n of 6" (Mars). 0 with no suites
 * (no line is shown).
 */
export function rockTypeTotal(t: InstrumentTuning['xray']): number {
  return new Set(t.suites.flatMap((s) => s.rocks.map((r) => r.id))).size;
}

/**
 * The readout's second line after a reading finds `rock`: "New type: count of total" when it is a type
 * not in `readBefore` (the rock types already read this mission, repeats allowed), else null. Null too
 * with no suites (total 0). Pure; the HUD fills ti.xrayNewType with it.
 */
export function newRockType(readBefore: readonly string[], rock: string, t: InstrumentTuning['xray']): { count: number; total: number } | null {
  const total = rockTypeTotal(t);
  if (total === 0 || readBefore.includes(rock)) return null;
  return { count: new Set(readBefore).size + 1, total };
}

// ---------------------------------------------------------------------------------------------------
// Mars instruments (Mars step 4a)

/** True when a part among these is a remote sensing mast. */
export function hasMast(parts: readonly Part[]): boolean {
  return parts.some((p) => p.effects.mast === true);
}

/**
 * The milestone tuning a mission uses for its photo zones: with a mast aboard (and tuning.instruments.mast
 * on this world), the viewpoint zones (photoZoneRadiusM) grow by mast.photoRangeFactor. Other photo ranges
 * (a boulder's) are unchanged. The same tuning object when nothing changes.
 */
export function withMastPhotoRange<T extends MilestoneTuning>(mt: T, parts: readonly Part[], mast: MastTuning | undefined): T {
  if (!mast || !hasMast(parts) || mast.photoRangeFactor === 1) return mt;
  return { ...mt, photoZoneRadiusM: mt.photoZoneRadiusM * mast.photoRangeFactor };
}

/** When the dust storm's forecast comes: the orbital report's time, or earlier thanks to the weather mast. */
export interface StormForecast {
  at: number; // mission seconds
  byMast: boolean; // the weather mast gives it, before the orbital report would
}

/**
 * The storm forecast with the weather mast (Owner B item B9, provisional, for Chieri's review). The
 * orbital report comes at storm.forecastAt. A weather mast that has been switched on, with the rover
 * powered up, since `mastOnSince` (null: not on now) gives it up to stormEarlyWarningSeconds earlier,
 * but only once it has been on for warmupSeconds: at the later of the early time and mastOnSince +
 * warmupSeconds, when that is still before the orbital report. Never before the mission starts.
 */
export function stormForecastAt(storm: DustStorm, mastOnSince: number | null, t: WeatherTuning): StormForecast {
  if (mastOnSince === null) return { at: storm.forecastAt, byMast: false };
  const early = Math.max(0, storm.forecastAt - t.stormEarlyWarningSeconds);
  const at = Math.max(early, mastOnSince + t.warmupSeconds);
  return at < storm.forecastAt ? { at, byMast: true } : { at: storm.forecastAt, byMast: false };
}

/** What the weather mast's readout reads from at one moment: the time of day and the storm. */
export interface WeatherSky {
  localSolarHours: number; // 0..24 (rules/sol.ts solClock)
  stormIntensity: number; // 0..1 (rules/storm.ts stormIntensity)
  haze: number; // 0..1, the air filling with dust ahead of the storm (stormHaze)
}

/**
 * The air filling with dust ahead of the storm, 0..1: rising from 0 to 1 over the lead before the storm
 * starts (the orbital report's lead plus the mast's early warning), staying up while it blows, and easing
 * back to 0 over the storm's last rampSeconds. 0 without a storm.
 */
export function stormHaze(seconds: number, storm: DustStorm | null, rampSeconds: number, t: WeatherTuning): number {
  if (!storm || seconds >= storm.endAt) return 0;
  const lead = storm.startAt - storm.forecastAt + t.stormEarlyWarningSeconds;
  if (seconds < storm.startAt) return lead > 0 ? Math.min(1, Math.max(0, 1 - (storm.startAt - seconds) / lead)) : 0;
  return rampSeconds > 0 ? Math.min(1, (storm.endAt - seconds) / rampSeconds) : 1;
}

export interface WeatherReading {
  pressurePa: number;
  tau: number; // dust opacity
}

/**
 * The weather mast's reading: pressure follows a daily cycle around pressurePa (peak at pressurePeakHour);
 * dust opacity is the clear value, raised by the haze ahead of the storm and by the storm itself (the
 * larger of the two).
 */
export function weatherReading(sky: WeatherSky, t: WeatherTuning): WeatherReading {
  const phase = ((sky.localSolarHours - t.pressurePeakHour) / 24) * 2 * Math.PI;
  const pressurePa = t.pressurePa * (1 + t.pressureDailySwing * Math.cos(phase));
  const tau = t.clearTau + Math.max(t.forecastHazeTau * sky.haze, (t.stormTau - t.clearTau) * sky.stormIntensity);
  return { pressurePa, tau };
}

export type Trend = 'rising' | 'falling' | 'steady';

/** A change read as a trend: steady within ± threshold. */
export function trendOf(now: number, before: number, threshold: number): Trend {
  if (now - before > threshold) return 'rising';
  if (before - now > threshold) return 'falling';
  return 'steady';
}

/** The weather mast's HUD readout: the reading now, with the pressure and dust trends since trendSeconds ago. */
export interface WeatherReadout extends WeatherReading {
  pressureTrend: Trend;
  dustTrend: Trend;
}

export function weatherReadout(now: WeatherSky, before: WeatherSky, t: WeatherTuning): WeatherReadout {
  const a = weatherReading(now, t);
  const b = weatherReading(before, t);
  return { ...a, pressureTrend: trendOf(a.pressurePa, b.pressurePa, t.pressureTrendPa), dustTrend: trendOf(a.tau, b.tau, t.dustTrendTau) };
}

/** One column of the radar profile: the layer kind under the rover, and whether a break came before it. */
export interface RadarColumn {
  layer: string;
  startsProfile: boolean; // the first column after the radar was switched on, a sharp turn or a stop
}

/** The ground-penetrating radar's profile over one mission. radarTrack moves it on each step. */
export interface RadarTrack {
  columns: RadarColumn[]; // the most recent last, at most tuning.columns
  profileM: number; // length of the current unbroken profile
  longestM: number; // the longest unbroken profile this mission
  carryM: number; // meters driven toward the next column
  columnHeadingDeg: number | null; // heading where the current column started (null: no profile under way)
  stillSeconds: number; // how long the rover has stood still with the radar on
  broken: boolean; // the next column starts a new profile
  layers: string[]; // the layer kinds profiled this mission, in the order first seen
}

export function emptyRadarTrack(): RadarTrack {
  return { columns: [], profileM: 0, longestM: 0, carryM: 0, columnHeadingDeg: null, stillSeconds: 0, broken: true, layers: [] };
}

/** What the mission screen measured for the radar over one step. */
export interface RadarSample {
  on: boolean; // switched on and the rover powered up
  dt: number;
  distanceM: number; // driven this step
  headingDeg: number; // the rover's heading, degrees (any fixed convention)
  moving: boolean; // above tuning.ground.movingSpeedMps
  layer: string; // the layer kind under the rover (radarLayer)
}

/** The layer kind under the rover: the first of tuning.layers whose zone the rover is in, else defaultLayer. */
export function radarLayer(zoneIds: readonly string[], t: RadarTuning): string {
  return t.layers.find((l) => zoneIds.includes(l.zone))?.kind ?? t.defaultLayer;
}

/** The smallest angle between two headings, degrees (0..180). */
function headingChangeDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * One step of the radar profile. Switched off (or powered down), the profile ends. Standing still for
 * stopBreakSeconds ends it too; a heading change above turnBreakDeg within one column (a sharp turn) ends
 * it and a new one starts where the turn happened. While driving, a column is added every columnM with
 * the layer kind under the rover; the profile's length counts the meters driven since the last break.
 * Gentle curves and short pauses do not break it. The strip keeps the last tuning.columns columns.
 */
export function radarTrack(prev: RadarTrack, s: RadarSample, t: RadarTuning): RadarTrack {
  const broken = { profileM: 0, carryM: 0, broken: true };
  if (!s.on) return { ...prev, ...broken, columnHeadingDeg: null, stillSeconds: 0 };
  if (!s.moving) {
    const stillSeconds = prev.stillSeconds + s.dt;
    return stillSeconds >= t.stopBreakSeconds ? { ...prev, ...broken, columnHeadingDeg: null, stillSeconds } : { ...prev, stillSeconds };
  }
  let next: RadarTrack = { ...prev, stillSeconds: 0 };
  if (next.columnHeadingDeg === null) next.columnHeadingDeg = s.headingDeg;
  else if (headingChangeDeg(s.headingDeg, next.columnHeadingDeg) > t.turnBreakDeg) next = { ...next, ...broken, columnHeadingDeg: s.headingDeg };
  const d = Number.isFinite(s.distanceM) ? Math.max(0, s.distanceM) : 0;
  next.profileM += d;
  next.carryM += d;
  if (next.carryM >= t.columnM) {
    const columns = [...next.columns];
    while (next.carryM >= t.columnM) {
      columns.push({ layer: s.layer, startsProfile: next.broken });
      next.broken = false;
      next.carryM -= t.columnM;
    }
    next.columns = columns.length > t.columns ? columns.slice(columns.length - t.columns) : columns;
    next.columnHeadingDeg = s.headingDeg;
    if (!next.layers.includes(s.layer)) next.layers = [...next.layers, s.layer];
  }
  next.longestM = Math.max(next.longestM, next.profileM);
  return next;
}

/** What the laser spectrometer would read now: a boulder or a point of the delta cliff. */
export interface LaserTarget {
  kind: 'boulder' | 'cliff';
  index: number | null; // the boulder's index in the boulder list (null for the cliff)
  x: number; // where the laser points (the boulder's center, or the cliff point)
  z: number;
  distanceM: number; // to the boulder's surface, or to the cliff point
}

/** What the laser can aim at: the boulders, and the delta cliff's foot line (terrain.json deltaFront.scarpLocal_xz). */
export interface LaserTargets {
  boulders: readonly Boulder[];
  cliff: readonly [number, number][] | null;
}

const CLIFF_SAMPLE_M = 0.5; // the cliff line is searched every half meter within reach

/**
 * The laser spectrometer's target: the nearest boulder or cliff point in a cone ahead of the rover
 * (within coneDeg of its heading, a unit vector in the x-z plane) and within reachM. A boulder counts when
 * any of its disc is inside the cone and its surface within reach; the cliff is its foot line, searched
 * every half meter where it passes within reach. Null when nothing is in the cone.
 */
export function laserTarget(p: Point, heading: Point, targets: LaserTargets, t: LaserTuning): LaserTarget | null {
  const hl = Math.hypot(heading.x, heading.z) || 1;
  const hx = heading.x / hl;
  const hz = heading.z / hl;
  const cosCone = Math.cos((t.coneDeg * Math.PI) / 180);
  /** The angle (degrees) from the heading to a point d meters away, less `widthRad` (a boulder's angular radius). */
  const offAxisDeg = (dx: number, dz: number, d: number, widthRad: number) => {
    const cos = d > 0 ? (dx * hx + dz * hz) / d : 1;
    return Math.max(0, Math.acos(Math.max(-1, Math.min(1, cos))) - widthRad) * (180 / Math.PI);
  };
  let best: LaserTarget | null = null;
  for (let index = 0; index < targets.boulders.length; index++) {
    const b = targets.boulders[index]!;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    const d = Math.hypot(dx, dz);
    const gap = Math.max(0, d - b.radius);
    if (gap > t.reachM || (best && gap >= best.distanceM)) continue;
    const width = d > b.radius ? Math.asin(b.radius / d) : Math.PI;
    if (offAxisDeg(dx, dz, d, width) > t.coneDeg) continue;
    best = { kind: 'boulder', index, x: b.x, z: b.z, distanceM: gap };
  }
  const line = targets.cliff;
  if (line && line.length > 1 && distanceToPath(line as [number, number][], p.x, p.z) <= t.reachM) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i]!;
      const [bx, bz] = line[i + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      if (len === 0 || distanceToPath([[ax, az], [bx, bz]], p.x, p.z) > t.reachM) continue;
      const n = Math.ceil(len / CLIFF_SAMPLE_M);
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const z = az + ((bz - az) * k) / n;
        const dx = x - p.x;
        const dz = z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > t.reachM || (best && d >= best.distanceM)) continue;
        if (d > 0 && (dx * hx + dz * hz) / d < cosCone) continue;
        best = { kind: 'cliff', index: null, x, z, distanceM: d };
      }
    }
  }
  return best;
}
