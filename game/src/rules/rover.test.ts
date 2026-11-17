import { describe, expect, it } from 'vitest';
import { cheapestBuild, chosenParts, completeBuild, isChassisOverloaded, isCompleteBuild, meetsRequirements, missingSlots, roverTotals, selectedParts } from './rover';
import { testMilestones, testParts } from './testData';
import type { Build } from './types';

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'],
};
const parts = (b: Partial<Build>) => selectedParts({ ...build, ...b }, testParts);
const byId = (id: string) => testMilestones.find((m) => m.id === id)!;

describe('rover totals', () => {
  it('sums cost, mass and size of the selected parts', () => {
    expect(roverTotals(parts({}))).toEqual({ cost: 245, mass: 85, size: 18 });
    expect(roverTotals(parts({ chassis: 'titanium', payload: ['drill'] }))).toEqual({ cost: 385, mass: 75, size: 21 });
  });

  it('rejects unknown parts and parts in the wrong slot', () => {
    expect(() => parts({ wheels: 'nope' })).toThrow();
    expect(() => parts({ wheels: 'steel' })).toThrow();
  });

  it('defaults to the cheapest option in every required slot, with no systems and an empty bay', () => {
    const { lights: _l, heater: _h, ...bus } = build;
    expect(cheapestBuild(testParts)).toEqual({ ...bus, payload: [] });
  });
});

describe('payload bay in the build', () => {
  it('lists the bus parts in slot order, then the instruments in bay order', () => {
    expect(parts({ payload: ['drill', 'camera'] }).map((p) => p.id)).toEqual([
      'steel', 'solid', 'panel', 'battery', 'lamp', 'heater', 'drill', 'camera',
    ]);
    expect(parts({ payload: [] })).toHaveLength(6);
    expect(roverTotals(parts({ payload: ['camera', 'drill'] }))).toEqual({ cost: 335, mass: 95, size: 23 });
  });

  it('rejects unknown ids and bus parts in the bay', () => {
    expect(() => parts({ payload: ['nope'] })).toThrow();
    expect(() => parts({ payload: ['steel'] })).toThrow();
  });

  it('is complete once the required bus is chosen: systems and the bay may be empty', () => {
    const { payload: _payload, lights: _l, heater: _h, ...bus } = build;
    expect(missingSlots(bus, testParts)).toEqual([]);
    expect(isCompleteBuild(bus, testParts)).toBe(true);
    expect(completeBuild(bus, testParts)).toEqual({ ...bus, payload: [] }); // an untouched bay is an empty one
    expect(completeBuild({ ...build, payload: ['drill'] }, testParts)).toEqual({ ...build, payload: ['drill'] });
    expect(missingSlots({}, testParts)).toEqual(['chassis', 'wheels', 'power', 'battery']);
    expect(missingSlots({ chassis: 'steel', lights: 'lamp' }, testParts)).toEqual(['wheels', 'power', 'battery']);
    expect(isCompleteBuild({ ...bus, battery: undefined }, testParts)).toBe(false);
    expect(completeBuild({ ...bus, battery: undefined }, testParts)).toBeNull();
  });

  it('a system left off is skipped in the part list; a none part stays (it adds nothing)', () => {
    const { lights: _l, heater: _h, ...bus } = build;
    expect(selectedParts(bus, testParts).map((p) => p.id)).toEqual(['steel', 'solid', 'panel', 'battery', 'camera']);
    expect(selectedParts({ ...bus, lights: 'no-lights' }, testParts).map((p) => p.id)).toEqual(['steel', 'solid', 'panel', 'battery', 'no-lights', 'camera']);
    expect(() => selectedParts({ ...bus, battery: undefined as unknown as string }, testParts)).toThrow();
  });

  it('chosen parts of a draft include the bay so far', () => {
    expect(chosenParts({ chassis: 'titanium', payload: ['drill'] }, testParts).map((p) => p.id)).toEqual(['titanium', 'drill']);
    expect(chosenParts({ wheels: 'mesh' }, testParts).map((p) => p.id)).toEqual(['mesh']);
  });
});

describe('chassis overload', () => {
  it('is overloaded when total mass exceeds the chassis max load', () => {
    expect(isChassisOverloaded(parts({}))).toBe(true); // 85 > 80
    expect(isChassisOverloaded(parts({ wheels: 'mesh' }))).toBe(false); // 75
  });

  it('is not overloaded at exactly the max load', () => {
    // titanium: 15 + 20 + 10 + 10 + 5 + 5 + 5 = 70, max load 70
    expect(isChassisOverloaded(parts({ chassis: 'titanium' }))).toBe(false);
    expect(isChassisOverloaded(parts({ chassis: 'titanium', payload: ['drill'] }))).toBe(true);
  });
});

describe('milestone requirements', () => {
  it('needs the matching instrument somewhere in the bay', () => {
    expect(meetsRequirements(parts({}), byId('layers'))).toBe(true);
    expect(meetsRequirements(parts({ payload: ['drill'] }), byId('layers'))).toBe(false);
    expect(meetsRequirements(parts({ payload: ['drill', 'camera'] }), byId('layers'))).toBe(true);
    expect(meetsRequirements(parts({ payload: [] }), byId('layers'))).toBe(false);
  });

  it('needs a slot part that actually provides its capability: a none part and an empty slot alike fail', () => {
    expect(meetsRequirements(parts({}), byId('dark'))).toBe(true);
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('dark'))).toBe(false);
    expect(meetsRequirements(parts({ lights: undefined }), byId('dark'))).toBe(false);
    expect(meetsRequirements(parts({ heater: undefined }), byId('dark'))).toBe(false);
  });

  it('passes milestones with no requirements', () => {
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('boulders'))).toBe(true);
  });
});
