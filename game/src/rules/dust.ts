// Dust on the panels and dust devils (Mars M8, MS8; Owner B, provisional, for Chieri's review). Pure.
//
// Dust factor: a solar rover's income multiplier from dust, 1 = clean. Dust settles all the time, day
// and night, at tuning.dust.perSol of the clean income per sol times the power part's dustRate (a straight
// line, not compounding), three times as fast at full storm strength. It never falls below minFactor.
// A rover without solar income (the RTG) has a dust rate of 0, so dust never touches it. The rate is
// compressed like time (real panels lose about 0.2% per sol).
//
// Dust devils: on average one every `everySols` sols, by day only. The schedule (times and the random
// geometry) is drawn before the mission from a seeded generator; each devil is placed when it forms,
// relative to where the rover is then, so it passes that point within maxPassM. It moves in a straight
// line as a dust column. One passing within dustDevilCleanM of the rover resets its dust factor to clean.
import type { DustDevil, DustDevilSlot, DustDevilSpec, DustTuning, SolTuning } from './marsTypes';
import type { Rng } from './events';

interface Point { x: number; z: number }

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------------------------------
// Dust on the panels

/** The effects that matter for dust (PartEffects gains `dustRate` in step 2). */
export interface DustPartEffects {
  energyIncome?: number;
  dustRate?: number;
}

/**
 * The rover's dust rate: its solar parts' dustRate weighted by their income (a part without one counts ×1).
 * 0 for a rover with no solar income, such as an RTG rover, so dust never touches it.
 */
export function roverDustRate(effects: DustPartEffects[]): number {
  let income = 0;
  let weighted = 0;
  for (const e of effects) {
    const i = Math.max(0, e.energyIncome ?? 0);
    income += i;
    weighted += i * Math.max(0, e.dustRate ?? 1);
  }
  return income > 0 ? weighted / income : 0;
}

/** Share of the clean income lost per second: perSol × dustRate, sped up by the storm (intensity 0..1), per sol of play. */
export function dustLossPerSecond(dustRate: number, stormIntensity: number, dust: DustTuning, secondsPerSol: number): number {
  if (secondsPerSol <= 0) return 0;
  const storm = 1 + (dust.stormMultiplier - 1) * Math.min(Math.max(stormIntensity, 0), 1);
  return (Math.max(0, dust.perSol) * Math.max(0, dustRate) * storm) / secondsPerSol;
}

/** The dust factor after `dt` seconds of settling, never below minFactor. No dust tuning (the Moon): unchanged. */
export function settleDust(
  factor: number,
  dt: number,
  dustRate: number,
  stormIntensity: number,
  dust: DustTuning | undefined,
  secondsPerSol: number,
): number {
  if (!dust) return factor;
  const floor = Math.min(Math.max(dust.minFactor, 0), 1);
  if (factor <= floor) return factor;
  return Math.max(floor, factor - dustLossPerSecond(dustRate, stormIntensity, dust, secondsPerSol) * Math.max(0, dt));
}

/** One step of the dust factor: back to clean (1) if a dust devil cleaned the panels this step, else it settles. */
export function stepDust(
  factor: number,
  step: { dt: number; dustRate: number; stormIntensity: number; cleaned: boolean },
  dust: DustTuning | undefined,
  secondsPerSol: number,
): number {
  if (!dust) return factor;
  return step.cleaned ? 1 : settleDust(factor, step.dt, step.dustRate, step.stormIntensity, dust, secondsPerSol);
}

/** The share of solar income dust has cut: 0 when clean. For the HUD's energy income line. */
export function dustIncomeLoss(factor: number): number {
  return Math.min(Math.max(1 - factor, 0), 1);
}

/** The dust lesson: dust has cut solar income by at least lessonLoss. Never without dust tuning. */
export function dustLessonReached(factor: number, dust: DustTuning | undefined): boolean {
  if (!dust || dust.lessonLoss <= 0) return false;
  return dustIncomeLoss(factor) >= dust.lessonLoss - 1e-9;
}

// ---------------------------------------------------------------------------------------------------
// Dust devils

/**
 * The mission's dust devils, in time order. The sols are split into runs of `everySols`; each run gets one
 * devil on a random sol of the run, at a random time inside daySecondsWindow after that sol's sunrise. A devil
 * whose sol is past the mission's last sol, or that would form before the start or outlast the mission, is
 * dropped. So 10 sols with everySols 3 give 3 devils, plus a fourth one time in three: one every 3 sols on
 * average. Every run draws the same five numbers whether it is kept or not, so a seed replays exactly.
 */
export function scheduleDustDevils(
  spec: DustDevilSpec | undefined,
  sol: SolTuning | undefined,
  lengthSeconds: number,
  rng: Rng,
): DustDevilSlot[] {
  if (!spec || !sol || spec.everySols <= 0 || spec.lifeSeconds <= 0) return [];
  const runs = Math.ceil(sol.sols / spec.everySols);
  const [w0, w1] = spec.daySecondsWindow;
  const shift = Math.max(0, sol.startSecondsIntoDay ?? 0);
  const list: DustDevilSlot[] = [];
  for (let i = 0; i < runs; i++) {
    const solIndex = Math.floor(spec.everySols * (i + rng())); // 0-based
    const daySecond = w0 + (w1 - w0) * rng();
    const passM = Math.max(0, spec.maxPassM) * rng();
    const headingDeg = 360 * rng();
    const side: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const at = solIndex * sol.secondsPerSol + daySecond - shift;
    if (solIndex >= sol.sols || at < 0 || at + spec.lifeSeconds > lengthSeconds) continue;
    list.push({ at, passM, headingDeg, side });
  }
  return list.sort((a, b) => a.at - b.at);
}

/** Unit vector for a heading in degrees from −z (north) toward +x (east). */
function headingVector(headingDeg: number): Point {
  return { x: Math.sin(headingDeg * DEG), z: -Math.cos(headingDeg * DEG) };
}

/**
 * Place a scheduled devil when it forms, given where the rover is then: it moves at speedMps along its
 * heading and is closest to that point (passM away, on its side) halfway through its life.
 */
export function placeDustDevil(slot: DustDevilSlot, spec: DustDevilSpec, rover: Point): DustDevil {
  const h = headingVector(slot.headingDeg);
  const right = { x: -h.z, z: h.x }; // heading turned 90° clockwise seen from above
  const half = (spec.speedMps * spec.lifeSeconds) / 2;
  const closest = { x: rover.x + right.x * slot.passM * slot.side, z: rover.z + right.z * slot.passM * slot.side };
  return {
    at: slot.at,
    endAt: slot.at + spec.lifeSeconds,
    start: { x: closest.x - h.x * half, z: closest.z - h.z * half },
    velocity: { x: h.x * spec.speedMps, z: h.z * spec.speedMps },
  };
}

/** The scheduled devils that form between two times (prev < at ≤ now), to be placed at the rover. */
export function dustDevilsForming(slots: DustDevilSlot[], prevSeconds: number, seconds: number): DustDevilSlot[] {
  return slots.filter((s) => prevSeconds < s.at && s.at <= seconds);
}

export function dustDevilActive(devil: DustDevil, seconds: number): boolean {
  return seconds >= devil.at && seconds < devil.endAt;
}

/** The column's position at `seconds` (it keeps its line before and after its life; check dustDevilActive). */
export function dustDevilPosition(devil: DustDevil, seconds: number): Point {
  const dt = seconds - devil.at;
  return { x: devil.start.x + devil.velocity.x * dt, z: devil.start.z + devil.velocity.z * dt };
}

/** 0 = gone, 1 = full column; ramps in after it forms and out before it ends. For the renderer. */
export function dustDevilStrength(devil: DustDevil, seconds: number, spec: DustDevilSpec): number {
  if (!dustDevilActive(devil, seconds)) return 0;
  const ramp = Math.min(Math.max(spec.rampSeconds, 0), (devil.endAt - devil.at) / 2);
  if (ramp <= 0) return 1;
  return Math.min(1, (seconds - devil.at) / ramp, (devil.endAt - seconds) / ramp);
}

/**
 * The closest the devil came to the rover during a step, with both moving in straight lines between the
 * two times (so a long frame cannot skip a pass). Only its active life counts; Infinity if it was not
 * standing during the step.
 */
export function dustDevilClosestM(devil: DustDevil, prevSeconds: number, seconds: number, roverPrev: Point, roverNow: Point): number {
  const a = Math.max(prevSeconds, devil.at);
  const b = Math.min(seconds, devil.endAt);
  if (b < a || (b === a && !dustDevilActive(devil, a))) return Infinity;
  const span = seconds - prevSeconds;
  const roverAt = (t: number): Point => {
    const f = span > 0 ? (t - prevSeconds) / span : 1;
    return { x: roverPrev.x + (roverNow.x - roverPrev.x) * f, z: roverPrev.z + (roverNow.z - roverPrev.z) * f };
  };
  // Devil minus rover, linear in t over [a, b]: r(t) = r0 + v (t − a).
  const d0 = dustDevilPosition(devil, a);
  const d1 = dustDevilPosition(devil, b);
  const p0 = roverAt(a);
  const p1 = roverAt(b);
  const r0 = { x: d0.x - p0.x, z: d0.z - p0.z };
  const v = { x: d1.x - p1.x - r0.x, z: d1.z - p1.z - r0.z }; // over the whole interval
  const vv = v.x * v.x + v.z * v.z;
  const u = vv > 0 ? Math.min(1, Math.max(0, -(r0.x * v.x + r0.z * v.z) / vv)) : 0;
  return Math.hypot(r0.x + v.x * u, r0.z + v.z * u);
}

/** Indices of the devils that passed within `withinM` of the rover during the step. */
export function dustDevilsWithin(
  devils: DustDevil[],
  prevSeconds: number,
  seconds: number,
  roverPrev: Point,
  roverNow: Point,
  withinM: number,
): number[] {
  const hits: number[] = [];
  devils.forEach((d, i) => {
    if (dustDevilClosestM(d, prevSeconds, seconds, roverPrev, roverNow) <= withinM) hits.push(i);
  });
  return hits;
}

/** Whether a devil passed within dustDevilCleanM of the rover during the step, cleaning its panels. */
export function dustDevilCleaned(
  devils: DustDevil[],
  prevSeconds: number,
  seconds: number,
  roverPrev: Point,
  roverNow: Point,
  dust: DustTuning | undefined,
): boolean {
  if (!dust) return false;
  return dustDevilsWithin(devils, prevSeconds, seconds, roverPrev, roverNow, dust.dustDevilCleanM).length > 0;
}
