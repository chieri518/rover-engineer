// The desk's night tile (Mars M15): the battery's net change over one night, asleep and awake with lights,
// coloured by state, with the breakdown in one sentence. Mars text, numbers from the data; none on the Moon or Titan.
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { selectedParts } from '../rules/rover';
import type { Build, Part } from '../rules/types';
import { nightBudgetLine, nightBudgetTile, signedEnergy } from './marsMission';

const build: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: [],
};
const swap = (slot: Part['slot'], effects: Part['effects']) => (p: Part) => (p.slot === slot ? { ...p, effects } : p);
const RTG = { steadyIncome: 0.6, heat: 2 };
const ELECTRIC = { heat: 3, heaterDraw: 1.2 };

describe('night tile', () => {
  const mars = worldGameData('mars');

  it('shows the net change asleep and with lights for a solar rover, coloured against the battery', () => {
    const tile = nightBudgetTile(mars, selectedParts(build, mars.parts))!;
    expect(tile.label).toBe('Night energy (15 s)');
    expect(tile.items).toEqual([
      { key: 'asleep', label: 'Asleep', value: '−3', state: 'small' },
      { key: 'lights', label: 'Awake with lights', value: '−60', state: 'large' }, // 60 of a 400 battery: 15%
    ]);
    expect(tile.sentence).toBe(
      'Over one 15 s night: asleep uses 3, awake with lights uses 60, so the battery changes by −3 asleep and −60 with lights. Awake with lights: one night uses 15% of the battery.');
    // A bigger battery takes the same loss as a small share: neutral.
    expect(nightBudgetTile(mars, selectedParts({ ...build, battery: 'battery-large' }, mars.parts))!.items[1]!.state).toBe('small');
  });

  it('gives the RTG and the electric heater in the sentence, and an RTG that covers a sleeping night is green', () => {
    const parts = selectedParts(build, mars.parts).map(swap('power', RTG)).map(swap('heater', ELECTRIC));
    const tile = nightBudgetTile(mars, parts)!;
    expect(tile.items.map((x) => [x.value, x.state])).toEqual([['−12', 'small'], ['−69', 'large']]);
    expect(tile.sentence).toBe(
      'Over one 15 s night: asleep uses 21, awake with lights uses 78, each including 18 for the heater; the RTG adds 9, so the battery changes by −12 asleep and −69 with lights. Awake with lights: one night uses 17% of the battery.');
    const rtg = nightBudgetTile(mars, selectedParts(build, mars.parts).map(swap('power', RTG)))!;
    expect(rtg.items[0]).toMatchObject({ value: '+6', state: 'gain' });
    expect(rtg.sentence).toContain('the RTG adds 9');
  });

  it('turns red when a night would empty the battery', () => {
    const parts = selectedParts(build, mars.parts).map(swap('battery', { batteryCapacity: 50 }));
    const tile = nightBudgetTile(mars, parts)!;
    expect(tile.items[1]).toMatchObject({ value: '−60', state: 'empties' });
    expect(tile.sentence).toContain('Awake with lights: one night would empty the battery.');
  });

  it('reads "No lights" in place of the second value on a rover without lights', () => {
    const tile = nightBudgetTile(mars, selectedParts({ ...build, lights: 'lights-none' }, mars.parts))!;
    expect(tile.items).toEqual([
      { key: 'asleep', label: 'Asleep', value: '−3', state: 'small' },
      { key: 'lights', label: 'Awake with lights', value: 'No lights', state: null },
    ]);
    expect(tile.sentence).toBe('Over one 15 s night: asleep uses 3, so the battery changes by −3 asleep.');
    const heater = selectedParts({ ...build, lights: 'lights-none', heater: 'heater-electric' }, mars.parts);
    expect(nightBudgetTile(mars, heater)!.sentence).toBe('Over one 15 s night: asleep uses 21, including 18 for the heater, so the battery changes by −21 asleep.');
  });

  it('keeps a loss neutral until a battery is chosen, and shows a dash until the power source is', () => {
    const parts = selectedParts(build, mars.parts);
    expect(nightBudgetTile(mars, parts.filter((p) => p.slot !== 'battery'))!.items.map((x) => x.state)).toEqual(['small', 'small']);
    expect(nightBudgetTile(mars, parts.filter((p) => p.slot !== 'power'))).toMatchObject({ items: [], sentence: '—' });
  });

  it('keeps nightBudgetLine: the label and the sentence', () => {
    const parts = selectedParts(build, mars.parts);
    expect(nightBudgetLine(mars, parts)).toEqual({ label: 'Night energy (15 s)', value: nightBudgetTile(mars, parts)!.sentence });
    expect(nightBudgetLine(mars, parts.filter((p) => p.slot !== 'power'))?.value).toBe('—');
  });

  it('is not shown on the Moon or Titan', () => {
    for (const world of ['moon', 'titan'] as const) {
      const data = worldGameData(world);
      expect(nightBudgetLine(data, selectedParts(build, data.parts)), world).toBeNull();
      expect(nightBudgetTile(data, selectedParts(build, data.parts)), world).toBeNull();
    }
  });

  it('signs energy with a true minus and a plus, never "-0"', () => {
    expect(signedEnergy(6)).toBe('+6');
    expect(signedEnergy(0)).toBe('+0');
    expect(signedEnergy(-0.01)).toBe('+0');
    expect(signedEnergy(-12.04)).toBe('−12');
    expect(signedEnergy(2.25)).toBe('+2.3');
  });
});
