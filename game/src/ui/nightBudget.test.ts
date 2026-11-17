// The desk's night tile (Mars M15): the battery's net rate at night per second, asleep and awake with lights,
// with the night's net change underneath, coloured by state, and the breakdown in one sentence. Mars text, numbers from the data; none on the Moon or Titan.
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { selectedParts } from '../rules/rover';
import type { Build, Part } from '../rules/types';
import { nightBudgetLine, nightBudgetTile, signedEnergy, signedRate } from './marsMission';

const build: Build = {
  chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-li-ion',
  lights: 'lights-led', heater: 'heater-rhu', payload: [],
};
const swap = (slot: Part['slot'], effects: Part['effects']) => (p: Part) => (p.slot === slot ? { ...p, effects } : p);
const RTG = { steadyIncome: 0.6, heat: 2 };
const ELECTRIC = { heat: 3, heaterDraw: 1.2 };

describe('night tile', () => {
  const mars = worldGameData('mars');

  it('shows the net rate asleep and with lights for a solar rover, the night under each, coloured against the battery', () => {
    const tile = nightBudgetTile(mars, selectedParts(build, mars.parts))!;
    expect(tile.label).toBe('Night energy');
    expect(tile.items).toEqual([
      { key: 'asleep', label: 'Asleep', value: '−0.2', unit: '/s', sub: '−3 per night', state: 'small' },
      // 60 of a 400 battery: 15%
      { key: 'lights', label: 'Awake with lights', value: '−4.0', unit: '/s', sub: '−60 per night · 15%', state: 'large' },
    ]);
    expect(tile.sentence).toBe(
      "At night this rover's battery changes by −0.2 per second asleep (−3 over a 15 s night) and −4.0 per second awake with lights (−60 over a night). Asleep uses 3 per night, awake with lights uses 60. Awake with lights: one night uses 15% of the battery.");
    // A bigger battery takes the same loss as a small share: neutral.
    expect(nightBudgetTile(mars, selectedParts({ ...build, battery: 'battery-large' }, mars.parts))!.items[1]).toMatchObject({ state: 'small', sub: '−60 per night' });
  });

  it('gives the RTG and the electric heater in the sentence, and an RTG that covers a sleeping night is green', () => {
    const parts = selectedParts(build, mars.parts).map(swap('power', RTG)).map(swap('heater', ELECTRIC));
    const tile = nightBudgetTile(mars, parts)!;
    expect(tile.items.map((x) => [x.value, x.sub, x.state])).toEqual([['−0.8', '−12 per night', 'small'], ['−4.6', '−69 per night · 17%', 'large']]);
    expect(tile.sentence).toBe(
      "At night this rover's battery changes by −0.8 per second asleep (−12 over a 15 s night) and −4.6 per second awake with lights (−69 over a night). Asleep uses 21 per night, awake with lights uses 78, each including 18 for the heater; the RTG adds 9. Awake with lights: one night uses 17% of the battery.");
    const rtg = nightBudgetTile(mars, selectedParts(build, mars.parts).map(swap('power', RTG)))!;
    expect(rtg.items[0]).toMatchObject({ value: '+0.4', unit: '/s', sub: '+6 per night', state: 'gain' });
    expect(rtg.sentence).toContain('the RTG adds 9');
  });

  it('turns red when a night would empty the battery', () => {
    const parts = selectedParts(build, mars.parts).map(swap('battery', { batteryCapacity: 50 }));
    const tile = nightBudgetTile(mars, parts)!;
    expect(tile.items[1]).toMatchObject({ value: '−4.0', sub: '−60 per night · 120%', state: 'empties' });
    expect(tile.sentence).toContain('Awake with lights: one night would empty the battery.');
  });

  it('reads "No lights" in place of the second value on a rover without lights', () => {
    const tile = nightBudgetTile(mars, selectedParts({ ...build, lights: 'lights-none' }, mars.parts))!;
    expect(tile.items).toEqual([
      { key: 'asleep', label: 'Asleep', value: '−0.2', unit: '/s', sub: '−3 per night', state: 'small' },
      { key: 'lights', label: 'Awake with lights', value: 'No lights', unit: '', sub: null, state: null },
    ]);
    expect(tile.sentence).toBe("At night this rover's battery changes by −0.2 per second asleep (−3 over a 15 s night). Asleep uses 3 per night.");
    const heater = selectedParts({ ...build, lights: 'lights-none', heater: 'heater-electric' }, mars.parts);
    expect(nightBudgetTile(mars, heater)!.sentence).toBe(
      "At night this rover's battery changes by −1.4 per second asleep (−21 over a 15 s night). Asleep uses 21 per night, including 18 for the heater.");
  });

  it('keeps a loss neutral until a battery is chosen, and shows a dash until the power source is', () => {
    const parts = selectedParts(build, mars.parts);
    expect(nightBudgetTile(mars, parts.filter((p) => p.slot !== 'battery'))!.items.map((x) => x.state)).toEqual(['small', 'small']);
    expect(nightBudgetTile(mars, parts.filter((p) => p.slot !== 'power'))).toMatchObject({ items: [], sentence: '—' });
  });

  it('keeps nightBudgetLine: the label and the sentence', () => {
    const parts = selectedParts(build, mars.parts);
    expect(nightBudgetLine(mars, parts)).toEqual({ label: 'Night energy', value: nightBudgetTile(mars, parts)!.sentence });
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

  it('gives a rate one decimal, or two under 0.1 so a small rate never reads "0.0"', () => {
    expect(signedRate(0.4)).toBe('+0.4');
    expect(signedRate(-3.4)).toBe('−3.4');
    expect(signedRate(2)).toBe('+2.0');
    expect(signedRate(-4)).toBe('−4.0');
    expect(signedRate(0.1)).toBe('+0.1');
    expect(signedRate(-0.05)).toBe('−0.05');
    expect(signedRate(0.04)).toBe('+0.04');
    expect(signedRate(-0.0133)).toBe('−0.01');
    expect(signedRate(0)).toBe('+0.00');
    expect(signedRate(-0.001)).toBe('+0.00'); // never "−0"
  });

  it('shows a small rate with two decimals on the tile: a night that loses 1 shows −0.07 /s', () => {
    // An RTG that nearly covers a sleeping night with an electric heater: 0.2 + 1.2 drawn, 1.333 earned per second.
    const parts = selectedParts({ ...build, lights: 'lights-none', heater: 'heater-electric' }, mars.parts).map(swap('power', { steadyIncome: 1.4 - 1 / 15 }));
    expect(nightBudgetTile(mars, parts)!.items[0]).toMatchObject({ value: '−0.07', unit: '/s', sub: '−1 per night', state: 'small' });
  });
});
