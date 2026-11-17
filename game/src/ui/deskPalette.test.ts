import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { quoteBuild } from '../rules/quote';
import type { DraftBuild, Part } from '../rules/types';
import { buildWithPart, categoryOf, categoryOfGroup, choosePart, isChosen, overBudget, partForGroup, startCategory, tapAction } from './deskPalette';
import { placeCard } from './partCard';

const moon = loadGameData('moon');
const mars = loadGameData('mars');
const part = (id: string, data = mars): Part => data.parts.parts.find((p) => p.id === id)!;

const full: DraftBuild = { chassis: 'chassis-steel', wheels: 'wheels-solid', power: 'power-fixed-panel', battery: 'battery-nih2' };

describe('desk palette: categories', () => {
  it('puts the four required slots in their own categories and everything else in the payload', () => {
    expect(categoryOf(part('chassis-titanium'))).toBe('chassis');
    expect(categoryOf(part('battery-large'))).toBe('battery');
    for (const id of ['lights-led', 'heater-rhu', 'arm-robotic', 'mast-remote', 'instrument-xray']) expect(categoryOf(part(id))).toBe('payload');
  });

  it('maps a clicked model group to its category', () => {
    expect(categoryOfGroup('wheels')).toBe('wheels');
    expect(categoryOfGroup('power')).toBe('power');
    for (const g of ['lights', 'heater', 'arm', 'mast', 'camera', 'neutron'] as const) expect(categoryOfGroup(g)).toBe('payload');
  });

  it('finds the part on the build for a clicked model group', () => {
    const build: DraftBuild = { ...full, lights: 'lights-led', support: { arm: 'arm-robotic' }, payload: ['instrument-camera', 'instrument-xray'] };
    expect(partForGroup('chassis', build, mars.parts)).toBe('chassis-steel');
    expect(partForGroup('lights', build, mars.parts)).toBe('lights-led');
    expect(partForGroup('arm', build, mars.parts)).toBe('arm-robotic');
    expect(partForGroup('xray', build, mars.parts)).toBe('instrument-xray');
    expect(partForGroup('drill', build, mars.parts)).toBeUndefined();
  });

  it('opens on Frame for a new build, then the first empty required slot, then the payload', () => {
    expect(startCategory({}, moon.parts)).toBe('chassis');
    expect(startCategory({ chassis: 'chassis-steel', wheels: 'wheels-mesh' }, moon.parts)).toBe('power');
    expect(startCategory({ chassis: 'chassis-steel', wheels: 'wheels-mesh', power: 'power-fixed-panel' }, moon.parts)).toBe('battery');
    expect(startCategory(full, moon.parts)).toBe('payload');
  });
});

describe('desk palette: choosing parts', () => {
  it('replaces a required part, and a smaller chassis drops the instruments fitted last', () => {
    expect(choosePart(full, part('wheels-mesh'), mars.parts).build.wheels).toBe('wheels-mesh');
    const roomy: DraftBuild = { ...full, payload: ['instrument-camera', 'instrument-drill', 'instrument-neutron', 'instrument-xray', 'instrument-weather'] };
    const { build, dropped } = choosePart(roomy, part('chassis-titanium'), mars.parts);
    expect(build.chassis).toBe('chassis-titanium');
    expect(dropped).toEqual(['instrument-weather']);
    expect(build.payload).toHaveLength(4);
  });

  it('toggles a payload item, and refuses one that needs a missing arm', () => {
    const fitted = choosePart(full, part('instrument-camera'), mars.parts).build;
    expect(isChosen(fitted, part('instrument-camera'), mars.parts)).toBe(true);
    expect(choosePart(fitted, part('instrument-camera'), mars.parts).build.payload).toEqual([]);
    expect(choosePart(full, part('instrument-organics'), mars.parts).build).toBe(full);
  });

  it('fits the X-ray without the arm on Mars (November 16: the arm is its upgrade, not its need)', () => {
    expect(full.support?.arm).toBeUndefined();
    expect(choosePart(full, part('instrument-xray'), mars.parts).build.payload).toEqual(['instrument-xray']);
  });

  it('prices a part as fitted even when the bay would refuse it now', () => {
    expect(buildWithPart(full, part('instrument-xray'), mars.parts).payload).toEqual(['instrument-xray']);
    expect(buildWithPart(full, part('heater-electric'), mars.parts).heater).toBe('heater-electric');
    expect(buildWithPart(full, part('wheels-grouser'), mars.parts).wheels).toBe('wheels-grouser');
  });
});

describe('desk palette: over budget', () => {
  const total = (b: DraftBuild) => quoteBuild(b, mars, 0).totalCost;

  it('marks a part that would take the total over the budget, not one already fitted or one that fits', () => {
    const balance = total(full) + 1;
    expect(overBudget(full, part('instrument-camera'), mars, balance)).toBe(total({ ...full, payload: ['instrument-camera'] }) > balance);
    expect(overBudget(full, part('instrument-camera'), mars, 1e9)).toBe(false);
    expect(overBudget(full, part('chassis-steel'), mars, 0)).toBe(false); // already on the build
    expect(overBudget(full, part('instrument-camera'), mars, 0)).toBe(true);
  });

  it('never marks a cheaper swap, even while the build is over budget', () => {
    const pricey: DraftBuild = { ...full, chassis: 'chassis-titanium' };
    const steel = part('chassis-steel');
    expect(total({ ...pricey, chassis: 'chassis-steel' })).toBeLessThan(total(pricey));
    expect(overBudget(pricey, steel, mars, 0)).toBe(false);
  });
});

describe('desk palette: taps', () => {
  it('a first touch tap opens the card, a second tap on the same tile fits', () => {
    expect(tapAction('touch', false)).toBe('card');
    expect(tapAction('touch', true)).toBe('fit');
  });

  it('a mouse click, a pen or a key press fits at once', () => {
    expect(tapAction('mouse', false)).toBe('fit');
    expect(tapAction('pen', false)).toBe('fit');
    expect(tapAction('', false)).toBe('fit');
  });
});

describe('hover card placement', () => {
  const view = { width: 1280, height: 800 };
  const card = { width: 290, height: 200 };

  it('goes right of the tile when there is room, top-aligned', () => {
    expect(placeCard({ left: 20, top: 300, right: 120, bottom: 400 }, card, view)).toEqual({ left: 130, top: 300 });
  });

  it('goes left when the right side is too close to the edge, and stays inside the viewport', () => {
    const at = placeCard({ left: 1100, top: 700, right: 1200, bottom: 790 }, card, view);
    expect(at.left).toBe(1100 - 10 - 290);
    expect(at.top + card.height).toBeLessThanOrEqual(view.height - 8);
  });

  it('goes below (or above) on a narrow screen, never over the tile', () => {
    const narrow = { width: 375, height: 800 };
    const tile = { left: 140, top: 100, right: 240, bottom: 200 };
    const below = placeCard(tile, card, narrow);
    expect(below.top).toBe(210);
    expect(below.left + card.width).toBeLessThanOrEqual(375 - 8);
    const above = placeCard({ ...tile, top: 650, bottom: 750 }, card, narrow);
    expect(above.top + card.height).toBeLessThanOrEqual(650);
  });
});
