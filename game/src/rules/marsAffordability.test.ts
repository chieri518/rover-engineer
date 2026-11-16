// Mars affordability (engineering plan, Affordability check and M12): which Mars builds can launch under
// the Mars ticket tiers, the plan's reference builds, and what each relationship answer costs. Mars
// balance is by hand (the winPaths model is retired): this test asserts only that the reference builds and
// the answers that are builds can launch; masses, tiers, spends and launch shares are reported, not asserted.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { allBuilds as allMoonBuilds } from './balance';
import { allBuildsWithSupport, supportFor } from './builds';
import { payloadProblems } from './payload';
import { quoteBuild } from './quote';
import type { Build, BusSlot } from './types';

const mars = loadGameData('mars');
const moon = loadGameData('moon');

/** The plan's default reference build: titanium, solid wheels, fixed panel, lithium-ion, heater units, no lights. */
const base: Record<BusSlot, string> = {
  chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-none', heater: 'heater-rhu',
};
const STEEL = { chassis: 'chassis-steel' };
const LIGHTS = { lights: 'lights-led' };
const RTG_NO_HEATER = { power: 'power-rtg', heater: 'heater-none' };
/** The robotic arm fitted by choice: since November 16 the X-ray needs none, and the arm is its upgrade. */
const ARM = { arm: 'arm-robotic' };
/** A reference build: the defaults, these changes, this bay, and the support hardware the bay needs. */
const ref = (payload: string[], changes: Partial<Record<BusSlot, string>> = {}, support?: Build['support']): Build =>
  ({ ...base, ...changes, payload: payload.map((i) => `instrument-${i}`), support: { ...supportFor(payload.map((i) => `instrument-${i}`), mars), ...support } });

/** game-design.md "Where the sample builds land" (= the plan's M12 table): the builds, by name. */
const REFERENCE: [string, Build][] = [
  ['Camera scout', ref(['camera'])],
  ['Neutron prospector', ref(['neutron'])],
  ['Fast empty bay', ref([], { wheels: 'wheels-mesh', ...LIGHTS })],
  ['Electric heater, larger battery, lights, camera', ref(['camera'], { heater: 'heater-electric', battery: 'battery-large', ...LIGHTS })],
  ['Weather watcher', ref(['weather', 'camera'])],
  ['X-ray, no arm', ref(['xray'])],
  ['X-ray + camera, no arm', ref(['xray', 'camera'])],
  ['Arm + X-ray', ref(['xray'], {}, ARM)],
  ['Field geologist', ref(['camera', 'drill'])],
  ['Radar surveyor', ref(['radar', 'camera'])],
  ['Mast + laser', ref(['laser'])],
  ['Rock hound', ref(['xray', 'camera'], {}, ARM)],
  ['Organics hunter', ref(['organics'])],
  ['RTG, lights, no heater, camera', ref(['camera'], { ...RTG_NO_HEATER, ...LIGHTS })],
  ['Remote geologist', ref(['laser', 'camera'])],
  ['RTG geologist', ref(['camera', 'drill'], { ...RTG_NO_HEATER, ...LIGHTS })],
  ['Empty bay (steel)', ref([], STEEL)],
  ['Empty bay + lights (steel)', ref([], { ...STEEL, ...LIGHTS })],
  ['Steel, RTG, lights, no heater, camera', ref(['camera'], { ...STEEL, ...RTG_NO_HEATER, ...LIGHTS })],
  ['Steel geologist', ref(['xray', 'drill'], STEEL, ARM)],
  ['Steel, arm + X-ray + mast + laser', ref(['xray', 'laser'], STEEL, ARM)],
  ['Steel, arm + X-ray + organics + drill', ref(['xray', 'organics', 'drill'], STEEL)],
];

/**
 * Builds that fitted when the arm, the mast and the lights took no mounting point, and do not fit since
 * November 16 (game-design.md "Payload: instruments and systems", the arithmetic check).
 */
const NO_LONGER_FIT: [string, Build][] = [
  ['Steel, lights, arm + mast, laser + X-ray + camera (the old Heavy example)', ref(['laser', 'xray', 'camera'], { ...STEEL, ...LIGHTS }, ARM)],
  ['Titanium, lights, heater units, arm, X-ray + camera', ref(['xray', 'camera'], LIGHTS, ARM)],
];

/** Builds that fit again since the X-ray needs no arm (game-design.md, The X-ray spectrometer and the robotic arm). */
const FIT_WITHOUT_ARM: [string, Build][] = [
  ['Titanium, lights, heater units, X-ray + camera, no arm', ref(['xray', 'camera'], LIGHTS)],
];

/** "Valid" Mars builds as the M12 analysis counted them: support only when needed (allBuilds does that), and a heater unless an RTG. */
const sensible = (b: Build) => b.power === 'power-rtg' || b.heater !== 'heater-none';

describe('Mars build enumeration', () => {
  const builds = allBuildsWithSupport(mars);

  it('enumerates every Mars bus mix with each bay that fits, giving each bay just the support it needs', () => {
    const mixes = mars.parts.slots.reduce((n, slot) => n * mars.parts.parts.filter((p) => p.slot === slot).length, 1);
    expect(builds.length).toBeGreaterThan(mixes);
    expect(builds.every((b) => payloadProblems(b, mars.parts).length === 0)).toBe(true);
    expect(builds.find((b) => b.payload.length === 0)!.support).toEqual({ arm: 'arm-none', mast: 'mast-none' });
    expect(supportFor(['instrument-organics', 'instrument-laser'], mars)).toEqual({ arm: 'arm-robotic', mast: 'mast-remote' });
    expect(supportFor(['instrument-xray'], mars)).toEqual({ arm: 'arm-none', mast: 'mast-none' }); // the X-ray needs no arm
    expect(supportFor(['instrument-camera'], moon)).toBeUndefined();
  });

  it('reports how many sensible Mars builds can launch under the Mars tiers and under the Moon tiers (Mars M12; not asserted)', () => {
    const valid = builds.filter(sensible);
    const share = (tiers: typeof mars.tiers) => valid.filter((b) => quoteBuild(b, { ...mars, tiers }, 1000).canLaunch).length / valid.length;
    console.log(`Mars launch share of ${valid.length} sensible builds: Mars tiers ${(share(mars.tiers) * 100).toFixed(1)}%, Moon tiers ${(share(moon.tiers) * 100).toFixed(1)}%`);
  });

  it('the Moon enumeration has no support hardware', () => {
    expect(allMoonBuilds(moon).some((b) => b.support !== undefined)).toBe(false);
  });
});

describe('Reference builds under the Mars tiers (the plan\'s Affordability / M12 tables)', () => {
  it.each(REFERENCE)('%s: can launch and is not overloaded', (_name, build) => {
    expect(payloadProblems(build, mars.parts)).toEqual([]);
    const q = quoteBuild(build, mars, 1000);
    expect(q.canLaunch).toBe(true);
    expect(q.overloaded).toBe(false);
  });

  it.each(NO_LONGER_FIT)('%s: over capacity, so it cannot launch', (_name, build) => {
    expect(payloadProblems(build, mars.parts).map((p) => p.kind)).toEqual(['over-capacity']);
    expect(quoteBuild(build, mars, 1000).canLaunch).toBe(false);
  });

  it.each(FIT_WITHOUT_ARM)('%s: fits and can launch', (_name, build) => {
    expect(build.support).toEqual({ arm: 'arm-none', mast: 'mast-none' });
    expect(payloadProblems(build, mars.parts)).toEqual([]);
    expect(quoteBuild(build, mars, 1000).canLaunch).toBe(true);
  });

  it('reports mass, size, tier and parts cost of each reference build (not asserted)', () => {
    console.table(REFERENCE.map(([name, build]) => {
      const q = quoteBuild(build, mars, 1000);
      return { name, mass: q.mass, size: q.size, tier: q.tier?.id, cost: q.cost };
    }));
  });
});

/**
 * Each Mars relationship answer (M14, the original answers), as the cheapest reference build that
 * follows it, with its spend (parts + ticket), reported only.
 */
const ANSWERS: { lesson: string; answer: string; build: Build | null; knownIssue?: string }[] = [
  { lesson: 'RTG neutron noise', answer: '(the cause) RTG + neutron spectrometer', build: ref(['neutron'], RTG_NO_HEATER), knownIssue: 'a build few players will make (M14)' },
  { lesson: 'RTG neutron noise', answer: 'Solar power instead', build: ref(['neutron']) },
  { lesson: 'RTG neutron noise', answer: 'Leave the neutron spectrometer home', build: ref(['camera']) },
  { lesson: 'Dust on the panels', answer: 'An RTG', build: ref(['camera'], { ...RTG_NO_HEATER, ...LIGHTS }), knownIssue: 'expensive: about 655 of milestone money to pass from B = 780 (M14)' },
  { lesson: 'Dust on the panels', answer: 'The higher solar mast', build: ref(['camera'], { power: 'power-solar-mast', ...LIGHTS }) },
  { lesson: 'Dust on the panels', answer: 'A route past dust devils', build: null, knownIssue: 'luck, not a plan: devils are random (M14)' },
  // Since November 16 the arm lesson is the organics spectrometer's (the X-ray reads on any drivable ground).
  { lesson: 'The organics reading needs gentle ground', answer: '(the cause) arm + organics', build: ref(['organics']) },
  { lesson: 'The organics reading needs gentle ground', answer: 'Park on level ground', build: ref(['organics']) },
  { lesson: 'The organics reading needs gentle ground', answer: 'Park on level ground within the arm\'s reach', build: ref(['organics']) },
  { lesson: 'No lights, no night driving', answer: 'Fit lights', build: ref(['camera'], LIGHTS) },
  { lesson: 'No lights, no night driving', answer: 'Sleep through the night', build: ref(['camera']) },
];

describe('Relationship answers (reported; the M14 known issues are listed, not asserted)', () => {
  const spend = (b: Build) => quoteBuild(b, mars, 1000).totalCost;

  it('every answer that is a build can launch and is not overloaded', () => {
    for (const a of ANSWERS) {
      if (!a.build) continue;
      const q = quoteBuild(a.build, mars, 1000);
      expect(payloadProblems(a.build, mars.parts), a.answer).toEqual([]);
      expect(q.canLaunch, a.answer).toBe(true);
      expect(q.overloaded, a.answer).toBe(false);
    }
  });

  it('reports each answer\'s spend and its known issue (not asserted)', () => {
    console.table(ANSWERS.map((a) => ({ lesson: a.lesson, answer: a.answer, spend: a.build ? spend(a.build) : null, knownIssue: a.knownIssue ?? '' })));
  });
});
