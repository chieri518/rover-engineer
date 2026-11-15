import { describe, expect, it } from 'vitest';
import { cheapestBuild, isChassisOverloaded, meetsRequirements, roverTotals, selectedParts } from './rover';
import { testMilestones, testParts } from './testData';
import type { Build } from './types';

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', instrument: 'camera',
};
const parts = (b: Partial<Build>) => selectedParts({ ...build, ...b }, testParts);
const byId = (id: string) => testMilestones.find((m) => m.id === id)!;

describe('rover totals', () => {
  it('sums cost, mass and size of the selected parts', () => {
    expect(roverTotals(parts({}))).toEqual({ cost: 245, mass: 85, size: 18 });
    expect(roverTotals(parts({ chassis: 'titanium', instrument: 'drill' }))).toEqual({ cost: 385, mass: 75, size: 21 });
  });

  it('rejects unknown parts and parts in the wrong slot', () => {
    expect(() => parts({ wheels: 'nope' })).toThrow();
    expect(() => parts({ wheels: 'steel' })).toThrow();
  });

  it('defaults to the cheapest option in every slot', () => {
    expect(cheapestBuild(testParts)).toEqual({ ...build, lights: 'no-lights' });
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
    expect(isChassisOverloaded(parts({ chassis: 'titanium', instrument: 'drill' }))).toBe(true);
  });
});

describe('milestone requirements', () => {
  it('needs the matching instrument', () => {
    expect(meetsRequirements(parts({}), byId('layers'))).toBe(true);
    expect(meetsRequirements(parts({ instrument: 'drill' }), byId('layers'))).toBe(false);
  });

  it('needs a slot part that actually provides its capability', () => {
    expect(meetsRequirements(parts({}), byId('dark'))).toBe(true);
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('dark'))).toBe(false);
  });

  it('passes milestones with no requirements', () => {
    expect(meetsRequirements(parts({ lights: 'no-lights' }), byId('boulders'))).toBe(true);
  });
});
