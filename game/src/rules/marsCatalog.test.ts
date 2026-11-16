// Mars step 3 (engineering plan Phase 3): the Mars bus parts, support hardware (arm and mast), the four
// Mars instruments as data, and the Mars ticket tiers, on real data. The Moon must not move.
import { describe, expect, it } from 'vitest';
import { loadGameData, worldGameData } from '../gameData';
import { quoteBuild } from './quote';
import { chosenParts, cheapestBuild, isCompleteBuild, missingSlots, selectedParts, slotPartId, withSlotPart } from './rover';
import { carryBuild, payloadProblems, supportProvided, unmetNeeds, upgradeSavedBuild } from './payload';
import { withPartsOverlay } from './merge';
import { validateGameData } from './validate';
import { marsSetup, missionSetup, setStandby, startInstrumentUse, startMission, stepMission, type MissionSample } from './mission';
import { seededRng } from './events';
import { ticketTier } from './tiers';
import { nightBudgetLine } from '../ui/marsMission';
import type { Build, DraftBuild, PartsFile } from './types';

const mars = loadGameData('mars');
const moon = loadGameData('moon');
const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 }; // Jezero, as in marsNight.test.ts

/** A titanium camera scout on Mars, with no arm and no mast. */
const scout: Build = {
  chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-none', heater: 'heater-rhu', payload: ['instrument-camera'], support: { arm: 'arm-none', mast: 'mast-none' },
};
const withArm = (b: Build): Build => ({ ...b, support: { ...b.support, arm: 'arm-robotic' } });
const withMast = (b: Build): Build => ({ ...b, support: { ...b.support, mast: 'mast-remote' } });
const part = (id: string) => mars.parts.parts.find((p) => p.id === id)!;

describe('Mars parts (data)', () => {
  it('adds the Mars bus parts, support parts and instruments, Mars only, in the right slots', () => {
    const want: [string, string][] = [
      ['power-rtg', 'power'], ['power-arrays', 'power'], ['battery-large', 'battery'], ['heater-electric', 'heater'],
      ['wheels-grouser', 'wheels'], ['arm-none', 'arm'], ['arm-robotic', 'arm'], ['mast-none', 'mast'], ['mast-remote', 'mast'],
      ['instrument-weather', 'instrument'], ['instrument-radar', 'instrument'], ['instrument-laser', 'instrument'], ['instrument-organics', 'instrument'],
    ];
    for (const [id, slot] of want) {
      expect(part(id), id).toMatchObject({ slot, worlds: ['mars'] });
      expect(moon.parts.parts.some((p) => p.id === id), id).toBe(false);
    }
    expect(part('arm-robotic').effects.arm).toBe(true);
    expect(part('mast-remote').effects.mast).toBe(true);
  });

  it('the four Mars instruments: their ids, button text and support needs', () => {
    for (const inst of ['weather', 'radar', 'laser', 'organics'] as const) {
      expect(part(`instrument-${inst}`).effects.instrument, inst).toBe(inst);
      expect(mars.text.instrumentText[inst]?.button, inst).toBeTruthy();
    }
    expect(part('instrument-weather').effects.needs).toBeUndefined();
    expect(part('instrument-radar').effects.needs).toBeUndefined();
    expect(part('instrument-laser').effects.needs).toEqual(['mast']);
    expect(part('instrument-organics').effects.needs).toEqual(['arm']);
  });

  it('the X-ray spectrometer needs the arm on Mars only (Mars M6)', () => {
    expect(part('instrument-xray').effects.needs).toEqual(['arm']);
    expect(moon.parts.parts.find((p) => p.id === 'instrument-xray')!.effects.needs).toBeUndefined();
  });

  it('keeps the spoiler guard on the desk: no dust, neutrons, noise or slopes in the new parts\' words', () => {
    for (const p of mars.parts.parts.filter((x) => x.worlds?.includes('mars'))) {
      const words = `${p.name} ${p.description}`;
      expect(words, p.id).not.toMatch(/less dust|dust settles|neutron|noise|slope|level ground|flat ground|steep/i);
    }
  });
});

describe('Support hardware in the build', () => {
  it('the arm and mast are payload you fit or leave off: neither world asks for them (November 16)', () => {
    const { support: _s, ...noSupport } = scout;
    expect(missingSlots(noSupport, mars.parts)).toEqual([]);
    expect(isCompleteBuild(noSupport, mars.parts)).toBe(true);
    expect(isCompleteBuild(scout, mars.parts)).toBe(true);
    expect(missingSlots({ ...noSupport, payload: undefined }, mars.parts)).toEqual([]);
    const moonBuild: Build = { ...noSupport, payload: ['instrument-camera'] };
    expect(isCompleteBuild(moonBuild, moon.parts)).toBe(true);
    expect(missingSlots(moonBuild, moon.parts)).toEqual([]);
  });

  it('selected parts list the support parts after the bus and before the bay; chosen parts skip empty slots', () => {
    const ids = selectedParts(withArm(scout), mars.parts).map((p) => p.id);
    expect(ids).toEqual(['chassis-titanium', 'wheels-solid', 'power-fixed-panel', 'battery-li-ion', 'lights-none', 'heater-rhu', 'arm-robotic', 'mast-none', 'instrument-camera']);
    const draft: DraftBuild = { power: 'power-rtg', support: { mast: 'mast-remote' } };
    expect(chosenParts(draft, mars.parts).map((p) => p.id)).toEqual(['power-rtg', 'mast-remote']);
    expect(() => selectedParts({ ...scout, support: { arm: 'mast-remote' } }, mars.parts)).toThrow(/does not belong/);
  });

  it('reads and sets a slot, bus or support, without changing the build', () => {
    expect(slotPartId(scout, 'arm')).toBe('arm-none');
    expect(slotPartId(scout, 'chassis')).toBe('chassis-titanium');
    const armed = withSlotPart(scout, 'arm', 'arm-robotic');
    expect(armed.support).toEqual({ arm: 'arm-robotic', mast: 'mast-none' });
    expect(scout.support!.arm).toBe('arm-none');
    expect(withSlotPart({}, 'mast', 'mast-remote')).toEqual({ support: { mast: 'mast-remote' } });
  });

  it('the arm and the mast take a mounting point each (November 16): titanium with the heater, both and two instruments is over', () => {
    const b = withMast(withArm({ ...scout, payload: ['instrument-xray', 'instrument-laser'] }));
    expect(payloadProblems(b, mars.parts)).toEqual([{ kind: 'over-capacity', count: 5, points: 4 }]);
    expect(quoteBuild(b, mars, 1000).canLaunch).toBe(false);
    // Steel's five points take them: heater units, arm, mast, X-ray and laser.
    const steel = { ...b, chassis: 'chassis-steel' };
    expect(payloadProblems(steel, mars.parts)).toEqual([]);
    expect(quoteBuild(steel, mars, 1000).canLaunch).toBe(true);
  });

  it('refuses an instrument whose support part is missing, with the part it needs', () => {
    const xray = { ...scout, payload: ['instrument-xray'] };
    expect(payloadProblems(xray, mars.parts)).toEqual([{ kind: 'needs', id: 'instrument-xray', support: 'arm' }]);
    expect(payloadProblems(withArm(xray), mars.parts)).toEqual([]);
    const laser = { ...scout, payload: ['instrument-laser'] };
    expect(payloadProblems(laser, mars.parts)).toEqual([{ kind: 'needs', id: 'instrument-laser', support: 'mast' }]);
    expect(payloadProblems(withMast(laser), mars.parts)).toEqual([]);
    // Still refused while the arm slot is empty, and with the arm in the wrong build: the quote cannot launch.
    expect(payloadProblems({ payload: ['instrument-organics'] }, mars.parts)).toEqual([{ kind: 'needs', id: 'instrument-organics', support: 'arm' }]);
    const q = quoteBuild(xray, mars, 1000);
    expect(q.canLaunch).toBe(false);
    expect(q.tier).not.toBeNull();
    // On the Moon the X-ray needs nothing.
    const { support: _s, ...moonXray } = xray;
    expect(payloadProblems(moonXray, moon.parts)).toEqual([]);
  });

  it('knows what the build carries and what an instrument still lacks', () => {
    expect([...supportProvided(withArm(scout), mars.parts)]).toEqual(['arm']);
    expect([...supportProvided(scout, mars.parts)]).toEqual([]);
    expect(unmetNeeds(part('instrument-organics'), scout, mars.parts)).toEqual(['arm']);
    expect(unmetNeeds(part('instrument-organics'), withArm(scout), mars.parts)).toEqual([]);
    expect(unmetNeeds(part('instrument-camera'), scout, mars.parts)).toEqual([]);
  });

  it('the quote includes the support parts in cost, mass and size', () => {
    const base = quoteBuild(scout, mars, 1000);
    const both = quoteBuild(withMast(withArm(scout)), mars, 1000);
    const added = [part('arm-robotic'), part('mast-remote')].filter((p) => !selectedParts(scout, mars.parts).some((q) => q.id === p.id));
    const sum = (key: 'cost' | 'mass' | 'size') => added.reduce((n, p) => n + p[key], 0);
    expect(added).toHaveLength(2);
    expect([both.cost - base.cost, both.mass - base.mass, both.size - base.size]).toEqual([sum('cost'), sum('mass'), sum('size')]);
  });

  it('the cheapest Mars build has no arm and no mast and can launch', () => {
    const b = cheapestBuild(mars.parts);
    expect(b.support).toBeUndefined();
    expect(quoteBuild(b, mars, 1000).canLaunch).toBe(true);
    expect(cheapestBuild(moon.parts).support).toBeUndefined();
  });
});

describe('Saves with support hardware', () => {
  it('an old save without support loads on Mars complete, with no arm and no mast fitted', () => {
    const { support: _s, ...old } = scout;
    const draft = upgradeSavedBuild(old, mars.parts);
    expect(draft.support).toBeUndefined();
    expect(missingSlots(draft, mars.parts)).toEqual([]);
  });

  it('a Mars save from before November 16 loads: "No arm", "No mast" and "No lights" read as not fitted', () => {
    const draft = upgradeSavedBuild(scout, mars.parts);
    expect(draft).toEqual({
      chassis: 'chassis-titanium', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion', heater: 'heater-rhu', payload: ['instrument-camera'],
    });
    expect(isCompleteBuild(draft, mars.parts)).toBe(true);
    // A steel rover with lights, heater, arm, mast and three instruments (it fitted before) loads with the over-capacity problem.
    const heavy = upgradeSavedBuild({
      chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion', lights: 'lights-led', heater: 'heater-rhu',
      payload: ['instrument-laser', 'instrument-xray', 'instrument-camera'], support: { arm: 'arm-robotic', mast: 'mast-remote' },
    }, mars.parts);
    expect(heavy.payload).toHaveLength(3);
    expect(heavy.support).toEqual({ arm: 'arm-robotic', mast: 'mast-remote' });
    expect(payloadProblems(heavy, mars.parts)).toEqual([{ kind: 'over-capacity', count: 7, points: 5 }]);
  });

  it('keeps support ids the catalog has in that slot and drops the rest', () => {
    expect(upgradeSavedBuild(withArm(scout), mars.parts).support).toEqual({ arm: 'arm-robotic' });
    expect(upgradeSavedBuild({ ...scout, support: { arm: 'arm-gone', mast: 'arm-robotic' } }, mars.parts).support).toBeUndefined();
    expect(upgradeSavedBuild({ ...scout, support: 'arm-robotic' }, mars.parts).support).toBeUndefined();
    // The Moon offers no support slots: they are dropped silently.
    expect(upgradeSavedBuild(withArm(scout), moon.parts).support).toBeUndefined();
  });

  it('carries a Mars build on Mars unchanged, and names the Mars parts it loses on the Moon', () => {
    const b = withArm({ ...scout, power: 'power-rtg', payload: ['instrument-xray'] });
    const { lights: _l, ...fitted } = b; // "No lights" and "No mast" read as not fitted
    expect(carryBuild(b, mars.allParts, 'mars')).toEqual({ build: { ...fitted, support: { arm: 'arm-robotic' } }, dropped: [] });
    const toMoon = carryBuild(b, mars.allParts, 'moon');
    expect(toMoon.dropped.map((p) => p.id)).toEqual(['power-rtg', 'arm-robotic']); // a "None" part is not lost
    expect(toMoon.build.power).toBeUndefined();
  });
});

describe('A Mars save carried to the Moon', () => {
  it('lists the arm and mast in the Not offered notice, even when the world has no support slots', () => {
    const b = withMast(withArm({ ...scout, payload: ['instrument-xray', 'instrument-laser'] }));
    const toMoon = carryBuild(b, mars.allParts, 'moon');
    expect(toMoon.dropped.map((p) => p.id)).toEqual(['arm-robotic', 'mast-remote', 'instrument-laser']);
    expect(toMoon.build.support).toBeUndefined();
    // Also when the catalog the build is carried from lists no support slots.
    const { supportSlots: _s, ...noSlots } = mars.allParts;
    expect(carryBuild(b, noSlots, 'moon').dropped.map((p) => p.id)).toEqual(['arm-robotic', 'mast-remote', 'instrument-laser']);
  });
});

describe('Mars ticket tiers (Mars M12)', () => {
  const name = (mass: number, size: number) => ticketTier(mass, size, mars.tiers.tiers)?.id ?? null;

  it('each tier takes up to its limits and the next tier starts one above; over the top tier there is none', () => {
    const tiers = mars.tiers.tiers;
    expect(tiers.map((t) => t.id)).toEqual(['small', 'medium', 'large', 'heavy']);
    tiers.forEach((t, i) => {
      const next = tiers[i + 1]?.id ?? null;
      expect(name(t.massLimit, 1), `${t.id} mass`).toBe(t.id);
      expect(name(t.massLimit + 1, 1), `${t.id} mass +1`).toBe(next);
      expect(name(1, t.sizeLimit), `${t.id} size`).toBe(t.id);
      expect(name(1, t.sizeLimit + 1), `${t.id} size +1`).toBe(next);
    });
  });

  it('the Moon keeps its three tiers', () => {
    expect(moon.tiers.tiers.map((t) => t.id)).toEqual(['small', 'medium', 'large']);
    expect(ticketTier(95, 20, moon.tiers.tiers)).toBeNull();
  });

  it('a steel rover with heater, arm, mast and two instruments (a full bay) launches Heavy on Mars', () => {
    const b: Build = {
      chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-large',
      heater: 'heater-rhu', payload: ['instrument-laser', 'instrument-xray'],
      support: { arm: 'arm-robotic', mast: 'mast-remote' },
    };
    const q = quoteBuild(b, mars, 1000);
    expect(q.tier?.id).toBe('heavy');
    expect(q.canLaunch).toBe(true);
  });
});

describe('The night budget line with the Mars parts', () => {
  const line = (b: Build) => nightBudgetLine(mars, selectedParts(b, mars.parts))?.value;
  const lit = { ...scout, lights: 'lights-led' };

  it('changes with the power source and the heater: each segment shows when it applies', () => {
    const words = mars.text.nightBudget!;
    const has = (value: string | undefined, template: string) => template.split('{energy}').map((x) => x.trim()).filter(Boolean).every((x) => value!.includes(x));
    const asleep = line(lit);
    expect(has(asleep, words.asleep)).toBe(true);
    expect(has(asleep, words.lights)).toBe(true);
    expect(has(asleep, words.heater)).toBe(false);
    expect(has(asleep, words.steady)).toBe(false);
    expect(has(line({ ...lit, heater: 'heater-electric' }), words.heater)).toBe(true);
    expect(has(line({ ...lit, power: 'power-rtg', heater: 'heater-none' }), words.steady)).toBe(true);
    expect(has(line({ ...lit, power: 'power-rtg', heater: 'heater-electric' }), words.steady)).toBe(true);
    expect(has(line({ ...lit, power: 'power-rtg', heater: 'heater-electric' }), words.heater)).toBe(true);
    expect(line(scout)).not.toContain(words.lights.replace('{energy} ', ''));
  });
});

describe('A rover with the Mars parts runs a mission', () => {
  const sample = (over: Partial<MissionSample> = {}): MissionSample => ({
    dt: 0.25, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0,
    throttling: false, impactMps: 0, upY: 1, ...over,
  });

  it('a full Mars build (RTG, grousers, arm, mast, three new instruments on steel) runs two sols and uses them', () => {
    const b: Build = {
      chassis: 'chassis-steel', wheels: 'wheels-grouser', power: 'power-rtg', battery: 'battery-large', lights: 'lights-led', heater: 'heater-none',
      payload: ['instrument-weather', 'instrument-radar', 'instrument-organics'], support: { arm: 'arm-robotic', mast: 'mast-remote' },
    };
    const setup = missionSetup(selectedParts(b, mars.parts), mars.tuning, [], marsSetup(site, mars.events, seededRng(1), mars.tuning));
    expect(setup.heat).toBe(2); // the RTG's waste heat
    expect(setup.power.steadyIncome).toBeCloseTo(0.6, 9);
    let s = startMission(setup);
    for (const inst of ['weather', 'radar'] as const) {
      const r = setStandby(s, inst, true, setup, mars.tuning);
      expect(r.ok, inst).toBe(true);
      if (r.ok) s = r.state;
    }
    // The organics spectrometer reads a boulder in reach (Mars step 4a).
    const use = startInstrumentUse(s, 'organics', { speedMps: 0, inColdZone: false, sunlight: 1, earthInView: false, boulderInReach: true, boulder: 0 }, setup, mars.tuning);
    expect(use.ok).toBe(true);
    if (use.ok) s = use.state;
    const notices: string[] = [];
    for (let i = 0; i < 480; i++) {
      const out = stepMission(s, sample({ position: { x: 0, z: 0 } }), setup, mars.tuning, mars.events);
      s = out.state;
      notices.push(...out.notices.map((n) => n.kind));
    }
    expect(s.end).toBeNull();
    expect(notices).toContain('instrument-done');
    expect(Number.isFinite(s.energy) && s.energy > 0).toBe(true);
    expect(s.seconds).toBeCloseTo(120, 6); // two sols, nights included
  });
});

describe('Support and power validation', () => {
  it('checks needs, support effects and slots', () => {
    const parts = mars.parts.parts.map((p) =>
      p.id === 'instrument-camera' ? { ...p, effects: { ...p.effects, needs: ['wings' as 'arm'] } }
      : p.id === 'heater-rhu' ? { ...p, effects: { ...p.effects, arm: true } }
      : p.id === 'arm-robotic' ? { ...p, effects: {} } // no arm part provides the arm any more
      : p);
    expect(validateGameData({ ...mars, parts: { ...mars.parts, parts } })).toEqual([
      'part heater-rhu has arm but is not in the arm slot',
      'part instrument-camera needs unknown support slot wings',
      'part instrument-xray needs the arm, but no arm part on mars provides it',
      'part instrument-organics needs the arm, but no arm part on mars provides it',
    ]);
  });

  it('refuses a need the world does not offer, and a support slot with no parts', () => {
    const moonParts: PartsFile = { ...moon.parts, parts: moon.parts.parts.map((p) => (p.id === 'instrument-xray' ? { ...p, effects: { ...p.effects, needs: ['arm' as const] } } : p)) };
    expect(validateGameData({ ...moon, parts: moonParts })).toEqual(['part instrument-xray needs the arm, which moon does not offer']);
    const noMast: PartsFile = { ...mars.parts, parts: mars.parts.parts.filter((p) => p.slot !== 'mast') };
    expect(validateGameData({ ...mars, parts: noMast })).toEqual([
      'support slot mast has no parts on mars',
      'part instrument-laser needs the mast, but no mast part on mars provides it',
    ]);
  });

  it('checks the power effects (Mars step 2 review) and that a night world has dust tuning', () => {
    const parts = mars.parts.parts.map((p) =>
      p.id === 'heater-electric' ? { ...p, effects: { heaterDraw: 1.2 } }
      : p.id === 'lights-led' ? { ...p, effects: { ...p.effects, lightsDraw: 'lots' as unknown as number } }
      : p);
    expect(validateGameData({ ...mars, parts: { ...mars.parts, parts } })).toEqual([
      'part lights-led needs lightsDraw to be a finite number, not negative',
      'part heater-electric has a heaterDraw but no heat',
    ]);
    const { dust: _d, ...noDust } = mars.tuning;
    expect(validateGameData({ ...mars, tuning: noDust })).toContain('tuning.dust is needed on mars, which has a night');
  });

  it('the parts overlay adds support slots and merges effects by id without changing its inputs', () => {
    const base = moon.allParts;
    const out = withPartsOverlay(base, { supportSlots: ['arm'], effects: { 'instrument-camera': { needs: ['arm'] } } });
    expect(out.supportSlots).toEqual(['arm']);
    expect(out.parts.find((p) => p.id === 'instrument-camera')!.effects).toEqual({ instrument: 'camera', needs: ['arm'] });
    expect(base.supportSlots).toBeUndefined();
    expect(base.parts.find((p) => p.id === 'instrument-camera')!.effects.needs).toBeUndefined();
    expect(withPartsOverlay(base, undefined)).toBe(base);
  });

  it('Mars data still validates; the Moon\'s too', () => {
    expect(validateGameData(worldGameData('mars'))).toEqual([]);
    expect(validateGameData(worldGameData('moon'))).toEqual([]);
  });
});
