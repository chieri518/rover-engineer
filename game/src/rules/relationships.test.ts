import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { emptySeismometerTrack, stepSeismometer, type SeismometerTrack, type TrackPoint } from './instruments';
import type { UseSite } from './mission';
import {
  FIRED_RELATIONSHIPS, lessonFor, meet, metIds, onPhoto, onStep, onUseDone, onUseStart, relationshipProblems,
  type RelationshipEvent,
} from './relationships';
import { testTuning } from './testData';
import type { RelationshipsFile } from './types';

const data = loadGameData();
const s = testTuning.instruments.seismometer; // 150 m quiet distance
const site = (patch: Partial<UseSite> = {}): UseSite => ({ boulder: null, inDarkCrater: false, slowedByCold: false, fasterInShadow: false, ...patch });

describe('neutron spectrometer finds, drill confirms', () => {
  it('fires when a drill sample finishes in the dark crater on a rover without a neutron spectrometer', () => {
    expect(onUseDone('drill', site({ inDarkCrater: true }), ['drill', 'camera'])).toEqual([{ id: 'neutron-drill' }]);
  });

  it('does not fire outside the crater, with a neutron spectrometer aboard (even switched off), or for other instruments', () => {
    expect(onUseDone('drill', site(), ['drill'])).toEqual([]);
    expect(onUseDone('drill', site({ inDarkCrater: true }), ['drill', 'neutron'])).toEqual([]);
    expect(onUseDone('xray', site({ inDarkCrater: true }), ['xray'])).toEqual([]);
  });
});

describe('the seismometer needs quiet ground', () => {
  const pt = (seconds: number, x: number, moving = true): TrackPoint => ({ seconds, x, z: 0, moving });
  const deployed = (): SeismometerTrack => stepSeismometer(emptySeismometerTrack(), { point: pt(10, 0, false), deployed: { x: 0, z: 0 }, quake: false }, s).track;

  it('fires while the rover drives within the quiet distance of a station that is still recording', () => {
    expect(onStep(deployed(), pt(12, 100), s)).toEqual([{ id: 'seismometer-quiet' }]);
  });

  it('does not fire parked, far away, without a station, or once the quake has passed', () => {
    expect(onStep(deployed(), pt(12, 100, false), s)).toEqual([]);
    expect(onStep(deployed(), pt(12, 150), s)).toEqual([]);
    expect(onStep(emptySeismometerTrack(), pt(12, 10), s)).toEqual([]);
    const recorded = stepSeismometer(deployed(), { point: pt(100, 500, false), quake: true }, s).track;
    expect(onStep(recorded, pt(101, 10), s)).toEqual([]);
    const missed = stepSeismometer(
      stepSeismometer(emptySeismometerTrack(), { point: pt(50, 0), quake: true }, s).track,
      { point: pt(60, 0, false), deployed: { x: 0, z: 0 }, quake: false }, s).track;
    expect(onStep(missed, pt(61, 10), s)).toEqual([]);
  });
});

describe('cold and dark', () => {
  it('heater: a use slowed by the cold', () => {
    expect(onUseStart({ slowedByCold: true, fasterInShadow: false })).toEqual([{ id: 'cold-dark', variant: 'heater' }]);
    expect(onUseStart({ slowedByCold: false, fasterInShadow: false })).toEqual([]);
  });

  it('lights: a photo inside permanent shadow on a rover without lights', () => {
    expect(onPhoto({ inColdZone: true, hasLights: false })).toEqual([{ id: 'cold-dark', variant: 'lights' }]);
    expect(onPhoto({ inColdZone: true, hasLights: true })).toEqual([]);
    expect(onPhoto({ inColdZone: false, hasLights: false })).toEqual([]);
  });
});

describe('colder X-ray detector, sharper reading', () => {
  it('fires when a reading is faster because the rover is in shadow', () => {
    expect(onUseStart({ slowedByCold: false, fasterInShadow: true })).toEqual([{ id: 'xray-cold' }]);
  });
});

describe('meeting relationships in a mission', () => {
  it('each relationship is fresh once; cold and dark once per variant', () => {
    const a = meet([], [{ id: 'xray-cold' }, { id: 'cold-dark', variant: 'heater' }]);
    expect(a.fresh).toHaveLength(2);
    const b = meet(a.met, [{ id: 'xray-cold' }, { id: 'cold-dark', variant: 'lights' }, { id: 'cold-dark', variant: 'lights' }]);
    expect(b.fresh).toEqual([{ id: 'cold-dark', variant: 'lights' }]);
    expect(meet(b.met, [{ id: 'cold-dark', variant: 'heater' }]).fresh).toEqual([]);
    expect(metIds(b.met)).toEqual(['xray-cold', 'cold-dark']);
  });
});

describe('relationships.json', () => {
  const partIds = new Set(data.parts.parts.map((p) => p.id));

  it('holds the four Moon relationships and the no-lights hard block, each with a lesson for every fired variant', () => {
    expect(data.relationships.relationships.map((r) => r.id)).toEqual(['neutron-drill', 'seismometer-quiet', 'cold-dark', 'xray-cold', 'no-lights']);
    expect(data.relationships.relationships.find((r) => r.id === 'no-lights')).toMatchObject({ hardBlock: true, review: 'red' });
    const events: RelationshipEvent[] = Object.entries(FIRED_RELATIONSHIPS).flatMap(([id, vs]) =>
      vs.length ? vs.map((variant) => ({ id, variant }) as RelationshipEvent) : [{ id } as RelationshipEvent]);
    for (const e of events) expect(lessonFor(data.relationships, e)?.notice, `${e.id} ${e.variant ?? ''}`).toBeTruthy();
    expect(relationshipProblems(data.relationships, partIds)).toEqual([]);
  });

  it('validation catches a repeated id, an unknown part, missing text, a bad color, a soft hard block and a missing fired entry', () => {
    const [neutron, quiet, cold, , block] = data.relationships.relationships.map((r) => ({ ...r }));
    const file: RelationshipsFile = {
      relationships: [
        { ...neutron!, parts: ['instrument-neutron', 'instrument-sonar'] },
        { ...quiet!, notice: '', answers: ['Drive away.'] },
        { ...quiet!, review: 'orange' as 'red' },
        { ...cold!, variants: { heater: cold!.variants!.heater! } },
        { ...block!, review: 'yellow' },
      ],
    };
    expect(relationshipProblems(file, partIds)).toEqual([
      'relationship neutron-drill names unknown part instrument-sonar',
      'relationship seismometer-quiet needs a notice and a debrief',
      'relationship seismometer-quiet needs at least two answers',
      'duplicate relationship id seismometer-quiet',
      'relationship seismometer-quiet has unknown review color orange',
      'relationship no-lights is a hard block, so its review is red',
      'relationship cold-dark needs a lights variant',
      'relationship xray-cold is used by the mission but missing from relationships.json',
    ]);
  });
});
