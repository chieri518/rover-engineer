// Mars affordability (engineering plan, Affordability check and M12): which Mars builds can launch under
// the Mars ticket tiers, the plan's reference builds in the tiers its table says, and what each
// relationship answer costs. No Mars winPaths model (MS13): rewards and the pass test wait for the
// balance patch (M13), so answers' costs are reported here and the known issues (M14) listed, not asserted.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { allBuilds, supportFor } from './balance';
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
/** A reference build: the defaults, these changes, this bay, and the support hardware the bay needs. */
const ref = (payload: string[], changes: Partial<Record<BusSlot, string>> = {}, support?: Build['support']): Build =>
  ({ ...base, ...changes, payload: payload.map((i) => `instrument-${i}`), support: { ...supportFor(payload.map((i) => `instrument-${i}`), mars), ...support } });

/** game-design.md "Where the sample builds land" (= the plan's M12 table): mass, size, tier, parts cost. */
const REFERENCE: [string, Build, number, number, string, number][] = [
  ['Camera scout', ref(['camera']), 58, 17, 'small', 430],
  ['Neutron prospector', ref(['neutron']), 59, 18, 'small', 460],
  ['Fast empty bay', ref([], { wheels: 'wheels-mesh', ...LIGHTS }), 50, 19, 'small', 525],
  ['Electric heater, larger battery, lights, camera', ref(['camera'], { heater: 'heater-electric', battery: 'battery-large', ...LIGHTS }), 66, 19, 'medium', 480],
  ['Weather watcher', ref(['weather', 'camera']), 63, 19, 'medium', 490],
  ['Arm + X-ray', ref(['xray']), 65, 19, 'medium', 500],
  ['Field geologist', ref(['camera', 'drill']), 66, 20, 'medium', 520],
  ['Radar surveyor', ref(['radar', 'camera']), 61, 19, 'medium', 520],
  ['Mast + laser', ref(['laser']), 65, 19, 'medium', 530],
  ['Rock hound', ref(['xray', 'camera']), 68, 20, 'medium', 550],
  ['Organics hunter', ref(['organics']), 67, 20, 'medium', 550],
  ['RTG, lights, no heater, camera', ref(['camera'], { ...RTG_NO_HEATER, ...LIGHTS }), 63, 18, 'medium', 565],
  ['Remote geologist', ref(['laser', 'camera']), 68, 20, 'medium', 580],
  ['RTG geologist', ref(['camera', 'drill'], { ...RTG_NO_HEATER, ...LIGHTS }), 71, 21, 'medium', 655],
  ['Empty bay (steel)', ref([], STEEL), 69, 16, 'medium', 290],
  ['Empty bay + lights (steel)', ref([], { ...STEEL, ...LIGHTS }), 72, 17, 'medium', 325],
  ['Steel, RTG, lights, no heater, camera', ref(['camera'], { ...STEEL, ...RTG_NO_HEATER, ...LIGHTS }), 77, 18, 'large', 475],
  ['Steel geologist', ref(['xray', 'drill'], STEEL), 87, 22, 'large', 500],
  ['Steel, arm + X-ray + mast + laser', ref(['xray', 'laser'], STEEL), 89, 22, 'large', 560],
  ['Steel, arm + X-ray + organics + drill', ref(['xray', 'organics', 'drill'], STEEL), 91, 24, 'heavy', 610],
  ['Steel, lights, arm + mast, laser + X-ray + camera', ref(['laser', 'xray', 'camera'], { ...STEEL, ...LIGHTS }), 95, 24, 'heavy', 645],
];

/** "Valid" Mars builds as the M12 analysis counted them: support only when needed (allBuilds does that), and a heater unless an RTG. */
const sensible = (b: Build) => b.power === 'power-rtg' || b.heater !== 'heater-none';

describe('Mars build enumeration', () => {
  const builds = allBuilds(mars);

  it('enumerates every Mars bus mix with each bay that fits, giving each bay just the support it needs', () => {
    // 2 frames × 3 wheels × 4 power × 3 batteries × 2 lights × 3 heaters = 432 mixes, half per frame;
    // steel takes up to 3 of the 8 instruments (93 bays), titanium up to 2 (37).
    expect(builds).toHaveLength(216 * 93 + 216 * 37);
    expect(builds.every((b) => payloadProblems(b, mars.parts).length === 0)).toBe(true);
    expect(builds.find((b) => b.payload.length === 0)!.support).toEqual({ arm: 'arm-none', mast: 'mast-none' });
    expect(supportFor(['instrument-xray', 'instrument-laser'], mars)).toEqual({ arm: 'arm-robotic', mast: 'mast-remote' });
    expect(supportFor(['instrument-camera'], moon)).toBeUndefined();
  });

  it('most sensible Mars builds can launch under the Mars tiers; under the Moon tiers about half could (Mars M12)', () => {
    const valid = builds.filter(sensible);
    const share = (tiers: typeof mars.tiers) => valid.filter((b) => quoteBuild(b, { ...mars, tiers }, 1000).canLaunch).length / valid.length;
    expect(share(mars.tiers)).toBeGreaterThan(0.85); // 86.8% with Heavy (21,060 builds)
    expect(share(moon.tiers)).toBeLessThan(0.6); // 53.4% with the Moon's three tiers
  });

  it('the Moon enumeration has no support hardware', () => {
    expect(allBuilds(moon).some((b) => b.support !== undefined)).toBe(false);
  });
});

describe('Reference builds under the Mars tiers (the plan\'s Affordability / M12 tables)', () => {
  it.each(REFERENCE)('%s: mass, size, tier and parts cost as the table says, and it launches', (_name, build, mass, size, tier, cost) => {
    const q = quoteBuild(build, mars, 1000);
    expect([q.mass, q.size, q.tier?.id, q.cost]).toEqual([mass, size, tier, cost]);
    expect(q.canLaunch).toBe(true);
    expect(q.overloaded).toBe(false);
  });
});

/**
 * Each Mars relationship answer (M14, the original answers), as the cheapest reference build that
 * follows it, with its spend (parts + ticket). A Mars arrival balance is at least 780.
 */
const ANSWERS: { lesson: string; answer: string; build: Build | null; knownIssue?: string }[] = [
  { lesson: 'RTG neutron noise', answer: '(the cause) RTG + neutron spectrometer', build: ref(['neutron'], RTG_NO_HEATER), knownIssue: 'a build few players will make (M14)' },
  { lesson: 'RTG neutron noise', answer: 'Solar power instead', build: ref(['neutron']) },
  { lesson: 'RTG neutron noise', answer: 'Leave the neutron spectrometer home', build: ref(['camera']) },
  { lesson: 'Dust on the panels', answer: 'An RTG', build: ref(['camera'], { ...RTG_NO_HEATER, ...LIGHTS }), knownIssue: 'expensive: about 655 of milestone money to pass from B = 780 (M14)' },
  { lesson: 'Dust on the panels', answer: 'The higher solar mast', build: ref(['camera'], { power: 'power-solar-mast', ...LIGHTS }) },
  { lesson: 'Dust on the panels', answer: 'A route past dust devils', build: null, knownIssue: 'luck, not a plan: devils are random (M14)' },
  { lesson: 'The arm cannot reach on a slope', answer: '(the cause) arm + X-ray + camera', build: ref(['xray', 'camera']) },
  { lesson: 'The arm cannot reach on a slope', answer: 'Park on level ground', build: ref(['xray', 'camera']) },
  { lesson: 'The arm cannot reach on a slope', answer: 'The laser spectrometer from a distance', build: ref(['laser']), knownIssue: 'means buying a second build, or the 760 steel rover with both (M14)' },
  { lesson: 'The arm cannot reach on a slope', answer: 'Laser alongside a contact instrument', build: ref(['xray', 'laser'], STEEL) },
  { lesson: 'No lights, no night driving', answer: 'Fit lights', build: ref(['camera'], LIGHTS) },
  { lesson: 'No lights, no night driving', answer: 'Sleep through the night', build: ref(['camera']) },
];

describe('Relationship answers (reported; the M14 known issues are listed, not asserted)', () => {
  const spend = (b: Build) => quoteBuild(b, mars, 1000).totalCost;

  it('every answer that is a build launches; its spend is what the plan reports', () => {
    const report = ANSWERS.map((a) => `${a.lesson}: ${a.answer}: ${a.build ? spend(a.build) : 'no build'}`);
    expect(report).toEqual([
      'RTG neutron noise: (the cause) RTG + neutron spectrometer: 680',
      'RTG neutron noise: Solar power instead: 520',
      'RTG neutron noise: Leave the neutron spectrometer home: 490',
      'Dust on the panels: An RTG: 685',
      'Dust on the panels: The higher solar mast: 615',
      'Dust on the panels: A route past dust devils: no build',
      'The arm cannot reach on a slope: (the cause) arm + X-ray + camera: 670',
      'The arm cannot reach on a slope: Park on level ground: 670',
      'The arm cannot reach on a slope: The laser spectrometer from a distance: 650',
      'The arm cannot reach on a slope: Laser alongside a contact instrument: 760',
      'No lights, no night driving: Fit lights: 585',
      'No lights, no night driving: Sleep through the night: 490',
    ]);
    for (const a of ANSWERS) if (a.build) expect(quoteBuild(a.build, mars, 1000).canLaunch, a.answer).toBe(true);
  });

  it('answers without a known issue can be bought below the 780 arrival floor', () => {
    for (const a of ANSWERS.filter((x) => !x.knownIssue && x.build)) expect(spend(a.build!), a.answer).toBeLessThan(780);
  });
});
