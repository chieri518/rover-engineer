// Offline balance evaluator: every build's cost, ticket, speed and energy, plus Pareto dominance.
// Used by data.test.ts (balance targets) and balance.test.ts (the report). Pure.
import type { Build, GameData, Slot } from './types';
import { quoteBuild } from './quote';
import { selectedParts } from './rover';
import { missionSetup, startMission, stepMission, type MissionEnd } from './mission';

export interface BuildEval {
  build: Build;
  label: string; // one short code per slot, e.g. "Ti mesh mast Li L H cam"
  cost: number; // parts only
  mass: number;
  size: number;
  tier: string | null; // null: cannot launch
  ticket: number;
  total: number; // parts + ticket
  overloadKg: number;
  topSpeed: number; // game m/s on flat ground
  energyPerMeter: number;
  battery: number;
  income: number; // energy/s in full sun
  grip: number;
  lights: boolean;
  heater: boolean;
  instrument: string;
  driveDrain: number; // energy/s driving at top speed, before solar income
}

const SHORT: Record<string, string> = {
  'chassis-steel': 'St', 'chassis-titanium': 'Ti',
  'wheels-solid': 'solid', 'wheels-mesh': 'mesh',
  'power-fixed-panel': 'panel', 'power-solar-mast': 'mast',
  'battery-nih2': 'NiH2', 'battery-li-ion': 'Li',
  'lights-none': '-', 'lights-led': 'L',
  'heater-none': '-', 'heater-rhu': 'H',
  'instrument-camera': 'cam', 'instrument-drill': 'drill',
};

export function buildLabel(build: Build, slots: Slot[]): string {
  return slots.map((s) => SHORT[build[s]] ?? build[s]).join(' ');
}

export function allBuilds(data: GameData): Build[] {
  let builds: Partial<Build>[] = [{}];
  for (const slot of data.parts.slots) {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    builds = builds.flatMap((b) => options.map((o) => ({ ...b, [slot]: o.id })));
  }
  return builds as Build[];
}

export function evaluateBuild(build: Build, data: GameData): BuildEval {
  const q = quoteBuild(build, data, data.tuning.budget.startingBudget);
  const parts = selectedParts(build, data.parts);
  const d = q.drive;
  return {
    build,
    label: buildLabel(build, data.parts.slots),
    cost: q.cost,
    mass: q.mass,
    size: q.size,
    tier: q.tier?.name ?? null,
    ticket: q.ticketPrice,
    total: q.totalCost,
    overloadKg: q.maxLoad === null ? 0 : Math.max(0, q.mass - q.maxLoad),
    topSpeed: d.topSpeed,
    energyPerMeter: d.energyPerMeter,
    battery: d.batteryCapacity,
    income: d.energyIncome,
    grip: d.grip,
    lights: parts.some((p) => (p.effects.lightRange ?? 0) > 0),
    heater: parts.some((p) => (p.effects.heat ?? 0) > 0),
    instrument: parts.find((p) => p.slot === 'instrument')?.effects.instrument ?? 'none',
    driveDrain: d.topSpeed * d.energyPerMeter,
  };
}

/**
 * True when `a` is at least as good as `b` on everything the player feels (total price with the
 * ticket, speed, energy, sinkage, grip, overload, equipment) and strictly better on one. Mass and
 * size are left out on purpose: they only matter through their effects (the ticket, which is in the
 * total, speed, energy per meter, sinkage = mass / grip, and overload). Different instruments are
 * never comparable. Both must be able to launch.
 */
export function dominates(a: BuildEval, b: BuildEval): boolean {
  if (a.tier === null || b.tier === null || a.instrument !== b.instrument) return false;
  const eps = 1e-9;
  const noWorse =
    a.total <= b.total && sinkage(a) <= sinkage(b) + eps && a.topSpeed >= b.topSpeed - eps && a.energyPerMeter <= b.energyPerMeter + eps &&
    a.battery >= b.battery && a.income >= b.income && a.grip >= b.grip && a.overloadKg <= b.overloadKg &&
    (a.lights || !b.lights) && (a.heater || !b.heater);
  if (!noWorse) return false;
  return (
    a.total < b.total || sinkage(a) < sinkage(b) - eps || a.topSpeed > b.topSpeed + eps || a.energyPerMeter < b.energyPerMeter - eps ||
    a.battery > b.battery || a.income > b.income || a.grip > b.grip || a.overloadKg < b.overloadKg ||
    (a.lights && !b.lights) || (a.heater && !b.heater)
  );
}

const sinkage = (e: BuildEval) => e.mass / e.grip;

/** Every [winner, loser] pair where one build dominates another. */
export function dominatedPairs(evals: BuildEval[]): [BuildEval, BuildEval][] {
  const pairs: [BuildEval, BuildEval][] = [];
  for (const a of evals) for (const b of evals) if (a !== b && dominates(a, b)) pairs.push([a, b]);
  return pairs;
}

/** A simple drive profile: in each 10 s cycle, drive at top speed for driveShare of it, park for the rest. */
export interface DriveProfile {
  sunlight: number | ((distanceM: number) => number); // 0..1, constant or by distance driven
  driveShare: number; // 0..1
  uphillDeg?: number;
  stopAtM?: number; // stop driving (park) once this far
}

export interface ProfileResult {
  end: MissionEnd;
  energy: number; // left at the end
  distanceM: number;
}

export function simulate(build: Build, data: GameData, profile: DriveProfile): ProfileResult {
  const setup = missionSetup(selectedParts(build, data.parts), data.tuning, []);
  let s = startMission(setup);
  const dt = 0.25;
  const v = setup.stats.topSpeed;
  const sun = typeof profile.sunlight === 'number' ? () => profile.sunlight as number : profile.sunlight;
  while (!s.end) {
    const inCycle = s.seconds % 10;
    const done = profile.stopAtM !== undefined && s.distanceM >= profile.stopAtM;
    const drive = !done && inCycle < profile.driveShare * 10;
    const speed = drive ? v : 0;
    s = stepMission(s, {
      dt, distanceM: speed * dt, speedMps: speed, uphillDeg: drive ? (profile.uphillDeg ?? 0) : 0, slopeDeg: 5,
      sunlight: sun(s.distanceM), inColdZone: false, softness: 0, throttling: drive, impactMps: 0, upY: 1,
    }, setup, data.tuning, data.events).state;
  }
  return { end: s.end, energy: s.energy, distanceM: s.distanceM };
}
