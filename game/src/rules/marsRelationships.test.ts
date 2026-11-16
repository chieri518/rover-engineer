// Mars step 5d: the three Mars relationships (the RTG's neutron noise, dust on the panels, the arm on a
// slope) and the Mars no-lights hard block. Each fires from its condition, once per mission, never on the
// Moon; the review's predicates on the Mars desk; the notebook. Behaviour only: no tuned values are pinned.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { marsSetup, marsStatus, missionSetup, startInstrumentUse, startMission, stepMission, type MissionSample, type UseConditions } from './mission';
import {
  lessonFor, meet, notebookView, onDust, onNeutronMeter, onNightNoLights, onUseRefused, onWorld, relationshipEntry, relationshipsOf, reviewItems,
  taughtLessons, type RelationshipEvent, type RelationshipId,
} from './relationships';
import { seededRng } from './events';
import { selectedParts } from './rover';
import type { DustTuning } from './marsTypes';
import type { Build } from './types';

const mars = loadGameData('mars');
const moon = loadGameData('moon');
const file = mars.relationships;
const dust = mars.tuning.dust!;
const MARS_IDS: RelationshipId[] = ['rtg-neutron', 'dust-panels', 'arm-slope', 'no-lights-night'];
const site = { latitudeDeg: 18.4447, longitudeDeg: 77.4508 }; // Jezero, as in marsNight.test.ts

/** A steel rover with a fixed panel and lights, no arm or mast. */
const base: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: ['instrument-camera'], support: { arm: 'arm-none', mast: 'mast-none' },
};
const build = (patch: Partial<Build>): Build => ({ ...base, ...patch, support: { ...base.support, ...patch.support } });
const review = (b: Build, notebook: readonly string[]) => reviewItems(b, notebook, mars).map((i) => [i.id, i.color]);

/** Meet a sequence of steps' events; returns the ids fresh at each step. */
function meetSteps(steps: RelationshipEvent[][]): string[][] {
  let met: RelationshipEvent[] = [];
  return steps.map((events) => {
    const r = meet(met, onWorld(events, file, 'mars'));
    met = r.met;
    return r.fresh.map((e) => e.id);
  });
}

describe('the RTG adds neutron noise', () => {
  it('fires while the neutron spectrometer reads on a noisy (RTG) rover', () => {
    expect(onNeutronMeter({ reading: true, noisy: true })).toEqual([{ id: 'rtg-neutron' }]);
  });

  it('does not fire with the meter off or on a quiet (solar) rover', () => {
    expect(onNeutronMeter({ reading: false, noisy: true })).toEqual([]);
    expect(onNeutronMeter({ reading: true, noisy: false })).toEqual([]);
  });

  it('fires once per mission, however long the meter reads', () => {
    const on = onNeutronMeter({ reading: true, noisy: true });
    expect(meetSteps([[], on, on, on])).toEqual([[], ['rtg-neutron'], [], []]);
  });
});

describe('dust on the panels', () => {
  const lesson = 1 - dust.lessonLoss;

  it('fires once dust has cut solar income by the lesson share (tuning.dust.lessonLoss), not before', () => {
    expect(onDust(1, dust)).toEqual([]);
    expect(onDust(lesson + 0.01, dust)).toEqual([]);
    expect(onDust(lesson, dust)).toEqual([{ id: 'dust-panels' }]);
    expect(onDust(dust.minFactor, dust)).toEqual([{ id: 'dust-panels' }]);
  });

  it('reads its threshold from the data', () => {
    const strict: DustTuning = { ...dust, lessonLoss: 0.3 };
    expect(onDust(0.75, strict)).toEqual([]);
    expect(onDust(0.7, strict)).toEqual([{ id: 'dust-panels' }]);
  });

  it('never fires on a world without dust', () => {
    expect(onDust(0.1, undefined)).toEqual([]);
  });

  it('fires once per mission, even after a dust devil cleans the panels and dust settles again', () => {
    expect(meetSteps([onDust(1, dust), onDust(lesson, dust), onDust(1, dust), onDust(lesson - 0.05, dust)])).toEqual([[], ['dust-panels'], [], []]);
  });

  it('a solar rover meets it in a mission as dust settles; an RTG rover never does', () => {
    const fly = (power: string) => {
      const parts = selectedParts(build({ power }), mars.parts);
      const setup = missionSetup(parts, mars.tuning, [], marsSetup(site, mars.events, seededRng(1), mars.tuning));
      let s = startMission(setup);
      const sample: MissionSample = {
        dt: 1, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0, throttling: false, impactMps: 0, upY: 1,
      };
      let met: RelationshipEvent[] = [];
      let firstAt: number | null = null;
      for (let i = 0; i < 2000 && !s.end; i++) {
        s = stepMission(s, sample, setup, mars.tuning, mars.events).state;
        const r = meet(met, onDust(marsStatus(s, setup, mars.tuning)!.dustFactor, mars.tuning.dust));
        met = r.met;
        if (r.fresh.length > 0) firstAt ??= s.seconds;
      }
      return { met: met.map((e) => e.id), firstAt, lasted: s.seconds };
    };
    const panel = fly('power-fixed-panel');
    expect(panel.met).toEqual(['dust-panels']);
    expect(panel.firstAt).toBeGreaterThan(0);
    const rtg = fly('power-rtg');
    expect(rtg.lasted).toBeGreaterThan(panel.firstAt!); // long enough that a solar rover would have met it
    expect(rtg.met).toEqual([]);
  });
});

describe('the organics reading needs gentle ground (arm-slope; the X-ray\'s too until November 16)', () => {
  it('fires when a contact reading is refused for the slope, and for no other refusal', () => {
    expect(onUseRefused('slope')).toEqual([{ id: 'arm-slope' }]);
    for (const reason of ['no-boulder', 'moving', 'energy', 'no-target', 'busy', 'powered-down'] as const) expect(onUseRefused(reason)).toEqual([]);
  });

  it('fires from the mission\'s own slope refusal, once per mission', () => {
    const parts = selectedParts(build({ payload: ['instrument-organics', 'instrument-xray'], support: { arm: 'arm-robotic' } }), mars.parts);
    const setup = missionSetup(parts, mars.tuning, [], marsSetup(site, mars.events, seededRng(1), mars.tuning));
    const s = startMission(setup);
    const at = (slopeDeg: number): UseConditions => ({ speedMps: 0, inColdZone: false, sunlight: 1, boulderInReach: true, boulder: 0, slopeDeg });
    const steep = mars.tuning.instruments.arm!.slopeLimitDeg + 3;
    const refusals = [steep, 0, steep].map((slope) => {
      const r = startInstrumentUse(s, 'organics', at(slope), setup, mars.tuning);
      return r.ok ? [] : onUseRefused(r.reason);
    });
    expect(meetSteps(refusals)).toEqual([['arm-slope'], [], []]);
    // The X-ray on the same ground, with the same arm, is never refused, so it never meets the lesson.
    expect(startInstrumentUse(s, 'xray', at(steep), setup, mars.tuning).ok).toBe(true);
  });

  it('names only the organics spectrometer and the arm', () => {
    const r = relationshipEntry(file, 'arm-slope')!;
    expect(r.parts).toEqual(['arm-robotic', 'instrument-organics']);
    for (const t of [r.name, r.notice, r.reviewText, r.debrief, ...(r.answers ?? [])]) expect(t, t).not.toMatch(/x-ray|laser/i);
    expect(r.name).toMatch(/organics/i);
  });
});

describe('no lights, no driving at night (the Mars entry)', () => {
  const night = { isNight: true, poweredDown: false, hasLights: false, canDrive: false };

  it('fires when night stops an awake rover without lights', () => {
    expect(onNightNoLights(night)).toEqual([{ id: 'no-lights-night' }]);
  });

  it('does not fire by day, asleep, with lights, or on a night that lets it drive', () => {
    expect(onNightNoLights({ ...night, isNight: false, canDrive: true })).toEqual([]);
    expect(onNightNoLights({ ...night, poweredDown: true })).toEqual([]);
    expect(onNightNoLights({ ...night, hasLights: true, canDrive: true })).toEqual([]);
    expect(onNightNoLights({ ...night, canDrive: true })).toEqual([]);
  });

  it('fires once per mission, however many nights', () => {
    const e = onNightNoLights(night);
    expect(meetSteps([e, [], e])).toEqual([['no-lights-night'], [], []]);
  });

  it('the mission\'s night status gives the hook what it needs', () => {
    const parts = selectedParts(build({ lights: 'lights-none' }), mars.parts);
    const setup = missionSetup(parts, mars.tuning, [], marsSetup(site, mars.events, seededRng(1), mars.tuning));
    let s = startMission(setup);
    const sample: MissionSample = {
      dt: 1, distanceM: 0, speedMps: 0, uphillDeg: 0, slopeDeg: 0, sunlight: 1, inColdZone: false, softness: 0, throttling: false, impactMps: 0, upY: 1,
    };
    let met: RelationshipEvent[] = [];
    for (let i = 0; i < 400 && !s.end && met.length === 0; i++) {
      s = stepMission(s, sample, setup, mars.tuning, mars.events).state;
      const m = marsStatus(s, setup, mars.tuning)!;
      met = meet(met, onNightNoLights({ isNight: m.clock.isNight, poweredDown: s.poweredDown, hasLights: setup.hasLights, canDrive: m.canDrive })).met;
      if (!m.clock.isNight) expect(met).toEqual([]);
    }
    expect(met.map((e) => e.id)).toEqual(['no-lights-night']);
  });
});

describe('Mars relationships stay on Mars', () => {
  const all = MARS_IDS.map((id) => ({ id }));

  it('the Mars data holds the four Mars lessons, each with a notice, a debrief, two answers or more, a fact and a source', () => {
    expect(relationshipsOf(file, 'mars').map((r) => r.id)).toEqual(MARS_IDS);
    for (const id of MARS_IDS) {
      const lesson = lessonFor(file, { id });
      expect(lesson?.notice, id).toBeTruthy();
      expect(lesson!.answers.length, id).toBeGreaterThanOrEqual(2);
      expect(relationshipEntry(file, id)?.fact, id).toBeTruthy();
    }
    expect(relationshipEntry(file, 'no-lights-night')).toMatchObject({ hardBlock: true, review: 'red' });
  });

  it('Mars events are dropped on the Moon, so no Mars lesson fires there', () => {
    expect(onWorld(all, moon.relationships, 'moon')).toEqual([]);
    expect(onWorld(all, file, 'mars')).toEqual(all);
  });

  it('the debrief teaches a Mars lesson with its real fact only with Mission history on', () => {
    expect(taughtLessons(all, file, true).map((l) => [l.id, Boolean(l.fact)])).toEqual(MARS_IDS.map((id) => [id, true]));
    expect(taughtLessons(all, file, false).every((l) => l.fact === undefined)).toBe(true);
  });

  it('the Mars notebook counts the four Mars lessons and holds the found ones', () => {
    expect(notebookView([], file, 'mars')).toEqual({ entries: [], total: 4 });
    expect(notebookView(['arm-slope', 'cold-dark'], file, 'mars').entries.map((e) => e.id)).toEqual(['arm-slope']);
    expect(notebookView(MARS_IDS, file, 'moon').entries).toEqual([]);
  });

  it('the Mars no-lights text never says a Mars rover drives at night or carries floodlights', () => {
    const e = relationshipEntry(file, 'no-lights-night')!;
    for (const s of [e.fact, e.source, e.notice, e.debrief, e.reviewText, ...(e.answers ?? [])]) expect(s).not.toMatch(/floodlight/i);
    expect(e.fact).not.toMatch(/Mars rovers? (drive|drives|drove) at night/i);
  });

  it('the dust notice names the loss the mission measured', () => {
    expect(lessonFor(file, { id: 'dust-panels' })!.notice).toContain('{loss}');
  });
});

describe('the Mars pre-launch review', () => {
  it('a first build (empty notebook) shows only the Mars no-lights hard block', () => {
    const risky = build({ power: 'power-rtg', lights: 'lights-none', payload: ['instrument-neutron', 'instrument-xray'], support: { arm: 'arm-robotic' } });
    expect(review(risky, [])).toEqual([['no-lights-night', 'red']]);
    expect(review({ ...risky, lights: 'lights-led' }, [])).toEqual([]);
  });

  it('the no-lights block shows for a rover without lights, discovered or not, and never with lights', () => {
    expect(reviewItems(build({ lights: 'lights-none' }), [], mars)).toMatchObject([{ id: 'no-lights-night', color: 'red', hardBlock: true }]);
    expect(review(build({}), MARS_IDS).map(([id]) => id)).not.toContain('no-lights-night');
  });

  it('RTG noise: a risk for the neutron spectrometer on an RTG, solved on solar power, silent without the neutron spectrometer', () => {
    const known = ['rtg-neutron'];
    expect(review(build({ power: 'power-rtg', payload: ['instrument-neutron'] }), known)).toEqual([['rtg-neutron', 'yellow']]);
    const solar = reviewItems(build({ payload: ['instrument-neutron'] }), known, mars);
    expect(solar).toMatchObject([{ id: 'rtg-neutron', color: 'green', solved: true, text: relationshipEntry(file, 'rtg-neutron')!.reviewSolved }]);
    expect(review(build({ power: 'power-rtg' }), known)).toEqual([]);
  });

  it('dust: a risk for every solar part (the higher solar mast too), solved by an RTG', () => {
    const known = ['dust-panels'];
    for (const power of ['power-fixed-panel', 'power-solar-mast', 'power-arrays']) expect(review(build({ power }), known), power).toEqual([['dust-panels', 'yellow']]);
    expect(review(build({ power: 'power-rtg' }), known)).toEqual([['dust-panels', 'green']]);
  });

  it('the organics lesson: a risk for the organics spectrometer, nothing for the X-ray (with the arm or without) or a build without one (the laser alone, say)', () => {
    const known = ['arm-slope'];
    expect(review(build({ payload: ['instrument-xray'], support: { arm: 'arm-robotic' } }), known)).toEqual([]);
    expect(review(build({ payload: ['instrument-xray'] }), known)).toEqual([]);
    expect(review(build({ payload: ['instrument-organics'], support: { arm: 'arm-robotic' } }), known)).toEqual([['arm-slope', 'yellow']]);
    expect(review(build({ payload: ['instrument-laser'], support: { mast: 'mast-remote' } }), known)).toEqual([]);
    expect(review(build({}), known)).toEqual([]);
  });

  it('shows only discovered Mars relationships, in data order, and no Moon line', () => {
    const b = build({ power: 'power-rtg', lights: 'lights-none', payload: ['instrument-neutron', 'instrument-organics'], support: { arm: 'arm-robotic' } });
    expect(review(b, ['arm-slope', 'cold-dark', 'no-lights', 'xray-cold'])).toEqual([['arm-slope', 'yellow'], ['no-lights-night', 'red']]);
    expect(review(b, MARS_IDS)).toEqual([['rtg-neutron', 'yellow'], ['dust-panels', 'green'], ['arm-slope', 'yellow'], ['no-lights-night', 'red']]);
  });
});
