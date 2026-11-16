import { describe, expect, it } from 'vitest';
import { cheapestBuild, chosenParts, isChassisOverloaded, isCompleteBuild, meetsRequirements, missingSlots, roverTotals, selectedParts } from './rover';
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

  it('defaults to the cheapest option in every slot, with an empty bay', () => {
    expect(cheapestBuild(testParts)).toEqual({ ...build, lights: 'no-lights', payload: [] });
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

  it('needs a confirmed bay to be complete; an empty bay counts once confirmed', () => {
    const { payload: _payload, ...bus } = build;
    expect(missingSlots(bus, testParts)).toEqual(['instrument']);
    expect(isCompleteBuild(bus, testParts)).toBe(false);
    expect(isCompleteBuild({ ...bus, payload: [] }, testParts)).toBe(true);
    expect(missingSlots({}, testParts)).toEqual([...testParts.slots, 'instrument']);
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

  it('needs a slot part that actually provides its capability', () => {
    expect(meetsRequirements(parts({}), byId('dark'))).toBe(true);
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('dark'))).toBe(false);
  });

  it('passes milestones with no requirements', () => {
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('boulders'))).toBe(true);
  });
});
