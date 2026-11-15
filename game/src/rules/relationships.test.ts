import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import type { SeismometerOutcome } from './instruments';
import type { UseSite } from './mission';
import {
  addToNotebook, FIRED_RELATIONSHIPS, LESSON_IDS, lessonFor, meet, metIds, notebookView, onSeismometer, onShadowStop, onUseDone,
  onUseStart, relationshipProblems, reviewItems, shortUseLines, taughtLessons, type RelationshipEvent,
} from './relationships';
import type { Build, Relationship, RelationshipsFile } from './types';

const data = loadGameData();
const file = data.relationships;
const site = (patch: Partial<UseSite> = {}): UseSite => ({ boulder: null, inDarkCrater: false, slowedByCold: false, fasterInShadow: false, ...patch });

describe('neutron spectrometer finds, drill confirms', () => {
  it('fires when a drill sample finds no ice in the dark crater on a rover without a neutron spectrometer', () => {
    expect(onUseDone('drill', site({ inDarkCrater: true }), ['drill', 'camera'], false)).toEqual([{ id: 'neutron-drill' }]);
  });

  it('does not fire on a lucky sample that finds the ice', () => {
    expect(onUseDone('drill', site({ inDarkCrater: true }), ['drill'], true)).toEqual([]);
  });

  it('does not fire outside the crater, with a neutron spectrometer aboard (even switched off), or for other instruments', () => {
    expect(onUseDone('drill', site(), ['drill'], false)).toEqual([]);
    expect(onUseDone('drill', site({ inDarkCrater: true }), ['drill', 'neutron'], false)).toEqual([]);
    expect(onUseDone('xray', site({ inDarkCrater: true }), ['xray'], false)).toEqual([]);
  });
});

describe('the seismometer needs quiet ground', () => {
  const recorded = (quality: 'clean' | 'noisy'): SeismometerOutcome => ({ kind: 'recorded', record: { quality, closestM: quality === 'noisy' ? 40 : Infinity } });

  it('fires when the moonquake record is noisy', () => {
    expect(onSeismometer(recorded('noisy'))).toEqual([{ id: 'seismometer-quiet' }]);
  });

  it('does not fire on a clean record, a set-down, or a missed quake (driving near the station alone teaches nothing yet)', () => {
    expect(onSeismometer(recorded('clean'))).toEqual([]);
    expect(onSeismometer({ kind: 'deployed' })).toEqual([]);
    expect(onSeismometer({ kind: 'missed' })).toEqual([]);
  });
});

describe('cold and dark', () => {
  it('fires when a use is slowed by the cold (no heater)', () => {
    expect(onUseStart({ slowedByCold: true, fasterInShadow: false })).toEqual([{ id: 'cold-dark' }]);
    expect(onUseStart({ slowedByCold: false, fasterInShadow: false })).toEqual([]);
  });
});

describe('colder X-ray detector, sharper reading', () => {
  it('fires when a reading is faster because the rover is in shadow', () => {
    expect(onUseStart({ slowedByCold: false, fasterInShadow: true })).toEqual([{ id: 'xray-cold' }]);
  });
});

describe('no lights, no permanent shadow', () => {
  it('fires when a rover without lights is stopped at the edge of permanent shadow', () => {
    expect(onShadowStop({ hasLights: false, stopped: true })).toEqual([{ id: 'no-lights' }]);
    expect(onShadowStop({ hasLights: false, stopped: false })).toEqual([]);
    expect(onShadowStop({ hasLights: true, stopped: true })).toEqual([]);
  });
});

describe('meeting relationships in a mission', () => {
  it('each relationship is fresh once per mission', () => {
    const a = meet([], [{ id: 'xray-cold' }, { id: 'cold-dark' }]);
    expect(a.fresh).toHaveLength(2);
    const b = meet(a.met, [{ id: 'xray-cold' }, { id: 'no-lights' }, { id: 'no-lights' }]);
    expect(b.fresh).toEqual([{ id: 'no-lights' }]);
    expect(meet(b.met, [{ id: 'cold-dark' }]).fresh).toEqual([]);
    expect(metIds(b.met)).toEqual(['xray-cold', 'cold-dark', 'no-lights']);
  });

  it('the first-time notice replaces the short slow-in-the-cold or faster-in-shadow line; later uses get the short line', () => {
    const cold = { slowedByCold: true, fasterInShadow: false };
    const shade = { slowedByCold: false, fasterInShadow: true };
    expect(shortUseLines(cold, [{ id: 'cold-dark' }])).toEqual({ slowCold: false, fastShadow: false });
    expect(shortUseLines(cold, [])).toEqual({ slowCold: true, fastShadow: false });
    expect(shortUseLines(shade, [{ id: 'xray-cold' }])).toEqual({ slowCold: false, fastShadow: false });
    expect(shortUseLines(shade, [])).toEqual({ slowCold: false, fastShadow: true });
    // Another relationship met at the same time does not hide the line.
    expect(shortUseLines(cold, [{ id: 'xray-cold' }])).toEqual({ slowCold: true, fastShadow: false });
  });
});

describe('debrief: what the rover taught us', () => {
  const met: RelationshipEvent[] = [{ id: 'xray-cold' }, { id: 'neutron-drill' }];

  it('lists each relationship met, in order, with the real fact and source only with Mission history on', () => {
    const on = taughtLessons(met, file, true);
    expect(on.map((l) => l.id)).toEqual(['xray-cold', 'neutron-drill']);
    expect(on[0]).toMatchObject({ name: lessonName('xray-cold'), fact: expect.any(String), source: expect.any(String) });
    expect(on[0]!.answers.length).toBeGreaterThanOrEqual(2);
    const off = taughtLessons(met, file, false);
    expect(off.map((l) => l.id)).toEqual(['xray-cold', 'neutron-drill']);
    expect(off.every((l) => l.fact === undefined && l.source === undefined)).toBe(true);
  });

  it('a result without relationships (an older result) teaches nothing', () => {
    expect(taughtLessons(undefined, file, true)).toEqual([]);
    expect(taughtLessons([], file, true)).toEqual([]);
  });

  it('a fired id with no lesson in the data is skipped without crashing', () => {
    const stripped: RelationshipsFile = {
      relationships: file.relationships.map((r) => (r.id === 'xray-cold' ? { ...r, notice: undefined, debrief: undefined, answers: undefined } : r)),
    };
    expect(taughtLessons(met, stripped, true).map((l) => l.id)).toEqual(['neutron-drill']);
    expect(taughtLessons(met, { relationships: [] }, true)).toEqual([]);
    expect(lessonFor(stripped, { id: 'xray-cold' })).toBeUndefined();
  });
});

describe('engineering notebook', () => {
  it('adds new ids once, keeping the order discovered', () => {
    expect(addToNotebook(['xray-cold'], ['cold-dark', 'xray-cold', 'cold-dark'])).toEqual(['xray-cold', 'cold-dark']);
  });

  it('shows discovered lessons in order and counts all Moon lessons; unknown or repeated ids are skipped', () => {
    const v = notebookView(['cold-dark', 'retired-lesson', 'neutron-drill', 'cold-dark'], file);
    expect(v.entries.map((e) => e.id)).toEqual(['cold-dark', 'neutron-drill']);
    expect(v.entries[0]!.lesson.answers.length).toBeGreaterThanOrEqual(2);
    expect(v.total).toBe(LESSON_IDS.length);
    expect(v.total).toBe(5);
    expect(notebookView([], file).entries).toEqual([]);
  });
});

describe('pre-launch review', () => {
  const base: Build = {
    chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
    lights: 'lights-led', heater: 'heater-none', payload: [],
  };
  const build = (patch: Partial<Build>): Build => ({ ...base, ...patch });
  const everything = [...LESSON_IDS];
  const review = (b: Build, notebook: readonly string[]) => reviewItems(b, notebook, data).map((i) => [i.id, i.color]);

  it('a first build (empty notebook) shows only hard blocks', () => {
    const full = build({ payload: ['instrument-drill', 'instrument-xray', 'instrument-seismometer'] });
    expect(review(full, [])).toEqual([]);
    expect(review({ ...full, lights: 'lights-none' }, [])).toEqual([['no-lights', 'red']]);
  });

  it('the no-lights hard block shows whether or not it was discovered, and only without lights', () => {
    const item = reviewItems(build({ lights: 'lights-none' }), ['no-lights'], data);
    expect(item).toMatchObject([{ id: 'no-lights', color: 'red', hardBlock: true }]);
    expect(review(build({}), ['no-lights'])).toEqual([]);
  });

  it('shows only discovered relationships the build triggers', () => {
    const b = build({ payload: ['instrument-drill', 'instrument-seismometer'] });
    expect(review(b, ['seismometer-quiet'])).toEqual([['seismometer-quiet', 'yellow']]);
    expect(review(b, everything)).toEqual([['neutron-drill', 'yellow'], ['seismometer-quiet', 'yellow'], ['cold-dark', 'yellow']]);
    expect(review(build({ payload: ['instrument-camera'] }), everything)).toEqual([]); // a photo is instant: the cold cannot slow it
  });

  it('a build that carries the answer shows the relationship green, as solved', () => {
    const both = reviewItems(build({ payload: ['instrument-drill', 'instrument-neutron'], heater: 'heater-rhu' }), everything, data);
    expect(both.map((i) => [i.id, i.color, i.solved])).toEqual([['neutron-drill', 'green', true], ['cold-dark', 'green', true]]);
    expect(both[0]!.text).toBe(file.relationships.find((r) => r.id === 'neutron-drill')!.reviewSolved);
  });

  it('the X-ray spectrometer: helpful, green; cold tolerant, so it does not raise cold and dark', () => {
    expect(review(build({ payload: ['instrument-xray'] }), everything)).toEqual([['xray-cold', 'green']]);
  });
});

describe('relationships.json', () => {
  const partIds = new Set(data.parts.parts.map((p) => p.id));

  it('holds the four Moon relationships and the no-lights hard block, each fired one with a lesson', () => {
    expect(file.relationships.map((r) => r.id)).toEqual(['neutron-drill', 'seismometer-quiet', 'cold-dark', 'xray-cold', 'no-lights']);
    expect(file.relationships.find((r) => r.id === 'no-lights')).toMatchObject({ hardBlock: true, review: 'red' });
    for (const id of Object.keys(FIRED_RELATIONSHIPS)) expect(lessonFor(file, { id })?.notice, id).toBeTruthy();
    expect(relationshipProblems(file, partIds)).toEqual([]);
  });

  it('validation catches a repeated id, an unknown part, missing text, a bad color, a soft hard block and a missing fired entry', () => {
    const [neutron, quiet, , , block] = file.relationships.map((r) => ({ ...r }));
    const bad: RelationshipsFile = {
      relationships: [
        { ...neutron!, parts: ['instrument-neutron', 'instrument-sonar'] },
        { ...quiet!, notice: '', answers: ['Drive away.'] },
        { ...quiet!, review: 'orange' as 'red' },
        { ...block!, review: 'yellow' },
      ],
    };
    expect(relationshipProblems(bad, partIds)).toEqual([
      'relationship neutron-drill names unknown part instrument-sonar',
      'relationship seismometer-quiet needs a notice and a debrief',
      'relationship seismometer-quiet needs at least two answers',
      'duplicate relationship id seismometer-quiet',
      'relationship seismometer-quiet has unknown review color orange',
      'relationship no-lights is a hard block, so its review is red',
      'relationship cold-dark is used by the mission but missing from relationships.json',
      'relationship xray-cold is used by the mission but missing from relationships.json',
    ]);
  });

  it('validation rejects variants, unfilled or misplaced placeholders, a missing solved line, and an entry nothing can show', () => {
    const entry = (id: string) => ({ ...file.relationships.find((r) => r.id === id)! });
    const others = file.relationships.filter((r) => !['cold-dark', 'xray-cold', 'neutron-drill'].includes(r.id));
    const stray: Relationship = { ...entry('xray-cold'), id: 'sonar-echo' };
    const bad: RelationshipsFile = {
      relationships: [
        ...others,
        { ...entry('cold-dark'), variants: { heater: { notice: 'a', debrief: 'b', answers: ['c', 'd'] } } } as Relationship,
        { ...entry('xray-cold'), notice: 'Faster within {distance} m.', debrief: 'Read in {place}.' },
        { ...entry('neutron-drill'), reviewSolved: undefined },
        stray,
      ],
    };
    expect(relationshipProblems(bad, partIds)).toEqual([
      'relationship cold-dark has variants, but the mission fires one lesson per relationship',
      'relationship xray-cold notice uses {distance}, which the mission does not fill',
      'relationship xray-cold uses {place} outside its notice',
      'relationship neutron-drill needs a reviewSolved line',
      'relationship sonar-echo has no build predicate, so the review cannot show it',
      'relationship sonar-echo is never fired by the mission and is not a hard block',
    ]);
  });
});

function lessonName(id: string): string {
  return file.relationships.find((r) => r.id === id)!.name;
}
