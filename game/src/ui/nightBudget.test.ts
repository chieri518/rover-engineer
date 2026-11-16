// The desk's night budget line (Mars M15): Mars text, numbers from the data; none on the Moon.
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { selectedParts } from '../rules/rover';
import type { Build, Part } from '../rules/types';
import { nightBudgetLine } from './marsMission';

const build: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: [],
};

describe('night budget line', () => {
  it("shows one night's energy asleep and with lights on Mars", () => {
    const mars = worldGameData('mars');
    const parts = selectedParts(build, mars.parts);
    expect(nightBudgetLine(mars, parts)).toEqual({ label: 'Night energy (15 s)', value: '3 asleep · 60 with lights' });
    expect(nightBudgetLine(mars, selectedParts({ ...build, lights: 'lights-none' }, mars.parts))?.value).toBe('3 asleep');
    expect(nightBudgetLine(mars, parts.filter((p) => p.slot !== 'heater'))?.value).toBe('—');
  });

  it('adds the electric heater and an RTG when the build has them', () => {
    const mars = worldGameData('mars');
    const swap = (slot: Part['slot'], effects: Part['effects']) => (p: Part) => (p.slot === slot ? { ...p, effects } : p);
    const parts = selectedParts(build, mars.parts).map(swap('power', { steadyIncome: 0.6, heat: 2 })).map(swap('heater', { heat: 3, heaterDraw: 1.2 }));
    expect(nightBudgetLine(mars, parts)?.value).toBe('21 asleep · 78 with lights · heater 18 of each · RTG +9');
  });

  it('is not shown on the Moon', () => {
    const moon = worldGameData('moon');
    expect(nightBudgetLine(moon, selectedParts(build, moon.parts))).toBeNull();
  });
});
