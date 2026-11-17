import { describe, expect, it } from 'vitest';
import {
  bayCapacity, bayParts, carryBuild, catalogFor, earnsMilestones, fitBayToChassis, fitPayload, fitRefusal, fittedSystem, fittedSystems, isFitted, isSystemPart, offeredOn,
  instrumentCosts, instrumentForKey, instrumentKeys, instrumentsOf, isBayOverCapacity, mountingPoints, payloadProblems, pointsUsed, systemSlotsOf, toggleBayPart,
  togglePayload, upgradeSavedBuild,
} from './payload';
import { selectedParts } from './rover';
import { testParts } from './testData';
import type { Build, DraftBuild, Part, PartsFile } from './types';

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'],
};

describe('mounting points', () => {
  it('come from the chassis: steel 5, titanium 4 in the test data; none without a chassis', () => {
    expect(mountingPoints(selectedParts(build, testParts))).toBe(5);
    expect(mountingPoints(selectedParts({ ...build, chassis: 'titanium' }, testParts))).toBe(4);
    expect(mountingPoints([])).toBe(0);
  });

  it('the instruments a rover carries, in bay order', () => {
    expect(instrumentsOf(selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts))).toEqual(['drill', 'camera']);
    expect(instrumentsOf(selectedParts({ ...build, payload: [] }, testParts))).toEqual([]);
  });
});

describe('payload problems', () => {
  it('none for a bay that fits, an empty bay, or an untouched one', () => {
    expect(payloadProblems({ ...build, payload: ['camera', 'drill'] }, testParts)).toEqual([]);
    expect(payloadProblems({ ...build, payload: [] }, testParts)).toEqual([]);
    expect(payloadProblems({ chassis: 'titanium' }, testParts)).toEqual([]);
  });

  it('reports unknown ids, non-instrument parts and duplicates', () => {
    expect(payloadProblems({ payload: ['nope', 'steel', 'camera', 'camera'] }, testParts)).toEqual([
      { kind: 'unknown', id: 'nope' },
      { kind: 'not-instrument', id: 'steel' },
      { kind: 'duplicate', id: 'camera' },
    ]);
  });

  it('counts two parts giving the same instrument as a duplicate', () => {
    const catalog: PartsFile = {
      ...testParts,
      parts: [...testParts.parts, { ...testParts.parts.find((p) => p.id === 'camera')!, id: 'camera-2' }],
    };
    expect(payloadProblems({ payload: ['camera', 'camera-2'] }, catalog)).toEqual([{ kind: 'duplicate', id: 'camera-2' }]);
  });

  it('reports more payload items than mounting points, once a chassis is chosen', () => {
    const five = ['camera', 'drill', 'neutron', 'xray', 'seismometer'];
    expect(payloadProblems({ chassis: 'titanium', payload: five }, testParts)).toContainEqual({ kind: 'over-capacity', count: 5, points: 4 });
    expect(isBayOverCapacity({ chassis: 'titanium', payload: five.slice(0, 4) }, testParts)).toBe(false);
    expect(isBayOverCapacity({ payload: five }, testParts)).toBe(false); // no chassis yet
  });

  it('counts the fitted systems with the instruments; a none part or an empty slot counts nothing', () => {
    const three = ['camera', 'drill', 'neutron'];
    expect(payloadProblems({ chassis: 'titanium', lights: 'lamp', heater: 'heater', payload: three }, testParts)).toContainEqual({ kind: 'over-capacity', count: 5, points: 4 });
    expect(isBayOverCapacity({ chassis: 'titanium', lights: 'lamp', payload: three }, testParts)).toBe(false);
    expect(isBayOverCapacity({ chassis: 'titanium', lights: 'no-lights', heater: 'heater', payload: three }, testParts)).toBe(false);
  });
});

describe('changing the bay', () => {
  it('adds at the end of the bay and removes, but never past the mounting points', () => {
    expect(togglePayload(undefined, 'camera', 2)).toEqual(['camera']);
    expect(togglePayload(['camera'], 'drill', 2)).toEqual(['camera', 'drill']);
    expect(togglePayload(['camera', 'drill'], 'camera', 2)).toEqual(['drill']);
    expect(togglePayload(['camera', 'drill'], 'extra', 2)).toEqual(['camera', 'drill']);
    expect(togglePayload([], 'camera', 0)).toEqual([]);
  });

  it('fitting the bay to a smaller chassis drops the instruments added last', () => {
    expect(fitPayload(['camera', 'drill', 'extra'], 2)).toEqual({ kept: ['camera', 'drill'], dropped: ['extra'] });
    expect(fitPayload(['camera'], 2)).toEqual({ kept: ['camera'], dropped: [] });
  });
});

describe('saved builds', () => {
  it('a save from before the payload bay moves its instrument into the bay', () => {
    expect(upgradeSavedBuild({ chassis: 'steel', instrument: 'camera' }, testParts)).toEqual({ chassis: 'steel', payload: ['camera'] });
  });

  it('keeps a current build as it is; a save without a bay loads without one (an empty bay)', () => {
    expect(upgradeSavedBuild(build, testParts)).toEqual(build);
    expect(upgradeSavedBuild({ ...build, payload: [] }, testParts)).toEqual({ ...build, payload: [] });
    expect(upgradeSavedBuild({ chassis: 'steel' }, testParts)).toEqual({ chassis: 'steel' });
    expect(upgradeSavedBuild(null, testParts)).toEqual({});
    expect(upgradeSavedBuild('steel', testParts)).toEqual({});
  });

  it('leaves a bus slot empty when its part id is unknown or names a part of another slot', () => {
    const { chassis: _c, wheels: _w, ...rest } = build;
    expect(upgradeSavedBuild({ ...build, chassis: 'chassis-renamed', wheels: 'panel' }, testParts)).toEqual(rest);
    expect(upgradeSavedBuild({ ...build, chassis: 42 }, testParts)).not.toHaveProperty('chassis');
    expect(upgradeSavedBuild({ ...build, extra: 'steel' }, testParts)).toEqual(build); // not a bus slot
  });

  it('drops unknown, non-instrument and repeated payload ids, keeping bay order', () => {
    expect(upgradeSavedBuild({ ...build, payload: ['gone', 'drill', 'steel', 'drill', 7, 'camera'] }, testParts).payload).toEqual(['drill', 'camera']);
    expect(upgradeSavedBuild({ chassis: 'steel', instrument: 'gone' }, testParts)).toEqual({ chassis: 'steel', payload: [] });
  });

  it('a bay emptied by dropped ids is just empty (no bay confirmation since November 16)', () => {
    expect(upgradeSavedBuild({ ...build, payload: ['gone'] }, testParts).payload).toEqual([]);
  });

  it('a "None" system from an old save loads as not fitted', () => {
    const { lights: _l, heater: _h, ...bus } = build;
    expect(upgradeSavedBuild({ ...build, lights: 'no-lights' }, testParts)).toEqual({ ...bus, heater: 'heater', payload: ['camera'] });
    expect(upgradeSavedBuild({ ...bus, payload: [] }, testParts)).toEqual({ ...bus, payload: [] });
  });

  it('an old save now over capacity loads as it is, with the over-capacity problem', () => {
    // Titanium, lamp, heater and three instruments: 5 items on 4 points (it fitted when systems took no point).
    const old = upgradeSavedBuild({ ...build, chassis: 'titanium', payload: ['camera', 'drill', 'neutron'] }, testParts);
    expect(old.payload).toEqual(['camera', 'drill', 'neutron']);
    expect(old.lights).toBe('lamp');
    expect(isBayOverCapacity(old, testParts)).toBe(true);
  });

  it('keeps more instruments than mounting points for the desk to report', () => {
    const saved = upgradeSavedBuild({ ...build, chassis: 'titanium', payload: ['camera', 'drill', 'camera-2'] }, {
      ...testParts,
      parts: [...testParts.parts, { id: 'camera-2', slot: 'instrument', name: 'x', description: '', cost: 1, mass: 1, size: 1, effects: { instrument: 'drill' } }],
    });
    expect(saved.payload).toEqual(['camera', 'drill']); // camera-2 repeats the drill instrument
    const oneSlot: PartsFile = {
      ...testParts,
      parts: testParts.parts.map((p) => (p.id === 'titanium' ? { ...p, effects: { ...p.effects, mountingPoints: 1 } } : p)),
    };
    const over = upgradeSavedBuild({ ...build, chassis: 'titanium', payload: ['camera', 'drill'] }, oneSlot);
    expect(over.payload).toEqual(['camera', 'drill']);
    expect(isBayOverCapacity(over, oneSlot)).toBe(true);
  });
});

describe('instrument costs and keys', () => {
  it('reads energy per use, standby energy and hold time from the parts, in bay order; absent means none', () => {
    const parts = selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts);
    expect(instrumentCosts(parts)).toEqual([
      { instrument: 'drill', mode: 'use', energyPerUse: 10, standbyEnergy: 0, useSeconds: 3, shadowHoldFactor: 1, coldTolerant: false, needsEarth: false, needsBoulder: false },
      { instrument: 'camera', mode: 'use', energyPerUse: 0, standbyEnergy: 0, useSeconds: 0, shadowHoldFactor: 1, coldTolerant: false, needsEarth: false, needsBoulder: false },
    ]);
  });

  it('the mode follows the effects: a standby draw makes a switch, deploy a deployable, otherwise a use', () => {
    const parts = selectedParts({ ...build, chassis: 'steel', payload: ['neutron', 'xray', 'seismometer'] }, testParts);
    expect(instrumentCosts(parts).map((c) => [c.instrument, c.mode])).toEqual([['neutron', 'switch'], ['xray', 'use'], ['seismometer', 'deploy']]);
    expect(instrumentCosts(parts)[1]).toMatchObject({ shadowHoldFactor: 0.5, coldTolerant: true, needsBoulder: true });
  });

  it('numbers the instruments 1, 2, 3 in bay order', () => {
    const parts = selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts);
    expect([...instrumentKeys(parts)]).toEqual([['drill', 1], ['camera', 2]]);
    expect(instrumentKeys(selectedParts({ ...build, payload: [] }, testParts)).size).toBe(0);
  });

  it('maps Digit and Numpad keys to the instrument at that bay position', () => {
    const parts = selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts);
    expect(instrumentForKey('Digit1', parts)).toBe('drill');
    expect(instrumentForKey('Numpad2', parts)).toBe('camera');
    expect(instrumentForKey('Digit3', parts)).toBeUndefined(); // no third instrument
    expect(instrumentForKey('Digit0', parts)).toBeUndefined();
    expect(instrumentForKey('KeyC', parts)).toBeUndefined();
    expect(instrumentForKey('Digit10', parts)).toBeUndefined();
  });
});

describe('earnsMilestones', () => {
  const file = { milestones: [{ requires: { instrument: 'camera' } }, { requires: {} }] } as unknown as import('./types').MilestonesFile;
  it('is true only for an instrument some milestone requires', () => {
    expect(earnsMilestones('camera', file)).toBe(true);
    expect(earnsMilestones('xray', file)).toBe(false);
  });
});

describe('a catalog per world', () => {
  // The test catalog with the real data's Moon-only parts, and a part only Mars offers.
  const worldParts: PartsFile = {
    ...testParts,
    parts: [
      ...testParts.parts.map((p) => (p.id === 'seismometer' || p.id === 'reflector' ? { ...p, worlds: ['moon' as const] } : p)),
      { id: 'mast', slot: 'instrument', name: 'Mast', description: '', cost: 50, mass: 4, size: 1, effects: { instrument: 'camera' }, worlds: ['mars'] },
    ],
  };
  const ids = (f: PartsFile) => f.parts.map((p) => p.id);

  it('a part without worlds is offered everywhere; one with worlds only there', () => {
    const [steel, reflector] = [worldParts.parts[0]!, worldParts.parts.find((p) => p.id === 'reflector')!];
    expect([offeredOn(steel, 'moon'), offeredOn(steel, 'mars')]).toEqual([true, true]);
    expect([offeredOn(reflector, 'moon'), offeredOn(reflector, 'mars')]).toEqual([true, false]);
  });

  it('each world gets its own parts in catalog order, with the same slots', () => {
    expect(ids(catalogFor(worldParts, 'moon'))).toEqual(ids(testParts));
    expect(ids(catalogFor(worldParts, 'mars'))).toEqual([...ids(testParts).filter((id) => id !== 'seismometer' && id !== 'reflector'), 'mast']);
    expect(catalogFor(worldParts, 'mars').slots).toEqual(testParts.slots);
  });

  it('a Moon build carried to Mars loses the Moon-only parts and names them, bay order kept', () => {
    const moon: Build = { ...build, payload: ['reflector', 'camera', 'seismometer'] };
    const out = carryBuild(moon, worldParts, 'mars');
    expect(out.build).toEqual({ ...build, payload: ['camera'] });
    expect(out.dropped.map((p) => p.name)).toEqual(['reflector', 'seismometer']);
  });

  it('a bay holding only Moon-only parts is empty on Mars; unknown ids drop silently', () => {
    const out = carryBuild({ ...build, payload: ['reflector', 'gone'] }, worldParts, 'mars');
    expect(out.build.payload).toEqual([]);
    expect(out.dropped.map((p) => p.id)).toEqual(['reflector']);
  });

  it('nothing to drop: on its own world, without a build, or for parts every world offers', () => {
    expect(carryBuild({ ...build, payload: ['reflector'] }, worldParts, 'moon')).toEqual({ build: { ...build, payload: ['reflector'] }, dropped: [] });
    expect(carryBuild(null, worldParts, 'mars')).toEqual({ build: {}, dropped: [] });
    expect(carryBuild(build, worldParts, 'mars')).toEqual({ build, dropped: [] });
  });
});

describe('payload systems in the bay (November 16)', () => {
  const p = (id: string, slot: Part['slot'], effects: Part['effects'] = {}): Part => ({ id, slot, name: id, description: '', cost: 10, mass: 1, size: 1, effects });
  // The test catalog with a second heater, the "None" parts, the arm and the mast, and an instrument that needs the arm.
  const catalog: PartsFile = {
    ...testParts,
    supportSlots: ['arm', 'mast'],
    parts: [
      ...testParts.parts,
      p('no-heater', 'heater'),
      p('heater-2', 'heater', { heat: 3 }),
      p('no-arm', 'arm'),
      p('arm', 'arm', { arm: true }),
      p('no-mast', 'mast'),
      p('mast', 'mast', { mast: true }),
      p('organics', 'instrument', { instrument: 'organics', needs: ['arm'] }),
    ],
  };
  const bus = { chassis: 'titanium', wheels: 'solid', power: 'panel', battery: 'battery' }; // 4 mounting points
  const toggle = (b: DraftBuild, ...ids: string[]) => ids.reduce((acc, id) => toggleBayPart(acc, id, catalog), b);

  it('the bay offers the systems that do something, then the instruments: no "None" parts', () => {
    expect(systemSlotsOf(catalog)).toEqual(['lights', 'heater', 'arm', 'mast']);
    expect(systemSlotsOf(testParts)).toEqual(['lights', 'heater']); // no arm or mast where the world does not offer them
    expect(bayParts(catalog).map((x) => x.id)).toEqual([
      'lamp', 'heater', 'heater-2', 'arm', 'mast', 'camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector', 'organics',
    ]);
    expect(isSystemPart(catalog.parts.find((x) => x.id === 'no-lights')!, catalog)).toBe(false);
    expect(isSystemPart(catalog.parts.find((x) => x.id === 'steel')!, catalog)).toBe(false);
  });

  it('an empty system slot and a none part are both not fitted', () => {
    expect(fittedSystem({ ...bus }, 'lights', catalog)).toBeUndefined();
    expect(fittedSystem({ ...bus, lights: 'no-lights' }, 'lights', catalog)).toBeUndefined();
    expect(fittedSystem({ ...bus, support: { arm: 'no-arm' } }, 'arm', catalog)).toBeUndefined();
    expect(fittedSystem({ ...bus, lights: 'lamp' }, 'lights', catalog)?.id).toBe('lamp');
    expect(isFitted({ ...bus, lights: 'no-lights' }, 'no-lights', catalog)).toBe(false);
    expect(pointsUsed({ ...bus, lights: 'no-lights', heater: 'no-heater', support: { arm: 'no-arm', mast: 'no-mast' }, payload: ['camera'] }, catalog)).toBe(1);
  });

  it('systems take a mounting point each, like instruments', () => {
    const b = toggle({ ...bus }, 'lamp', 'heater', 'camera');
    expect(fittedSystems(b, catalog).map((x) => x.id)).toEqual(['lamp', 'heater']);
    expect(b.payload).toEqual(['camera']);
    expect(pointsUsed(b, catalog)).toBe(3);
    expect(isFitted(b, 'lamp', catalog) && isFitted(b, 'camera', catalog)).toBe(true);
  });

  it('at most one heater: fitting one replaces the other, even in a full bay', () => {
    const full = toggle({ ...bus }, 'lamp', 'heater', 'camera', 'drill');
    expect(pointsUsed(full, catalog)).toBe(4);
    expect(fitRefusal(full, 'heater-2', catalog)).toBeNull();
    const swapped = toggle(full, 'heater-2');
    expect(swapped.heater).toBe('heater-2');
    expect(pointsUsed(swapped, catalog)).toBe(4);
    // Over a none part it is a fit, not a swap, so capacity applies.
    expect(fitRefusal({ ...full, heater: 'no-heater' }, 'heater-2', catalog)).toBeNull(); // 3 used: room for one
    expect(fitRefusal({ ...full, heater: 'no-heater', payload: ['camera', 'drill', 'xray'] }, 'heater-2', catalog)).toEqual({ kind: 'full' });
  });

  it('a full bay refuses both kinds; taking something off makes room', () => {
    const full = toggle({ ...bus }, 'camera', 'drill', 'neutron', 'xray');
    expect(fitRefusal(full, 'lamp', catalog)).toEqual({ kind: 'full' });
    expect(fitRefusal(full, 'seismometer', catalog)).toEqual({ kind: 'full' });
    expect(toggle(full, 'lamp')).toBe(full); // refused: nothing changes
    const room = toggle(full, 'xray', 'lamp');
    expect(room.lights).toBe('lamp');
    expect(room.payload).toEqual(['camera', 'drill', 'neutron']);
    expect(toggle(room, 'lamp')).not.toHaveProperty('lights'); // taken off: the slot is empty again
  });

  it('without a chassis the bay takes as many items as the roomiest chassis', () => {
    expect(bayCapacity({}, catalog)).toEqual({ points: 5, chassis: false });
    expect(bayCapacity({ chassis: 'titanium' }, catalog)).toEqual({ points: 4, chassis: true });
    expect(pointsUsed(toggle({}, 'lamp', 'heater', 'camera', 'drill', 'neutron', 'xray'), catalog)).toBe(5);
  });

  it('an instrument whose support is not fitted is refused; the arm fitted, it goes in', () => {
    expect(fitRefusal({ ...bus }, 'organics', catalog)).toEqual({ kind: 'needs', support: ['arm'] });
    expect(fitRefusal({ ...bus, support: { arm: 'no-arm' } }, 'organics', catalog)).toEqual({ kind: 'needs', support: ['arm'] });
    const armed = toggle({ ...bus }, 'arm', 'organics');
    expect(armed.support).toEqual({ arm: 'arm' });
    expect(armed.payload).toEqual(['organics']);
    // Taking the arm off leaves the instrument in the bay with the needs problem (it blocks the launch).
    const unarmed = toggle(armed, 'arm');
    expect(unarmed).not.toHaveProperty('support');
    expect(payloadProblems(unarmed, catalog)).toEqual([{ kind: 'needs', id: 'organics', support: 'arm' }]);
  });

  it('refuses a part the bay does not offer, and a second part giving the same instrument', () => {
    expect(fitRefusal({ ...bus }, 'no-lights', catalog)).toEqual({ kind: 'full' });
    expect(fitRefusal({ ...bus }, 'steel', catalog)).toEqual({ kind: 'full' });
    const twin: PartsFile = { ...catalog, parts: [...catalog.parts, p('camera-2', 'instrument', { instrument: 'camera' })] };
    expect(fitRefusal({ ...bus, payload: ['camera'] }, 'camera-2', twin)).toEqual({ kind: 'full' });
  });

  it('a smaller chassis drops the instruments fitted last, never the systems', () => {
    const steel = toggle({ ...bus, chassis: 'steel' }, 'lamp', 'heater', 'camera', 'drill', 'neutron');
    expect(pointsUsed(steel, catalog)).toBe(5);
    const { build: ti, dropped } = fitBayToChassis({ ...steel, chassis: 'titanium' }, catalog);
    expect(dropped).toEqual(['neutron']);
    expect(ti.payload).toEqual(['camera', 'drill']);
    expect([ti.lights, ti.heater]).toEqual(['lamp', 'heater']);
    // All four systems on a one-point chassis: every instrument goes, the systems stay (over capacity).
    const tiny: PartsFile = { ...catalog, parts: catalog.parts.map((x) => (x.id === 'titanium' ? { ...x, effects: { ...x.effects, mountingPoints: 1 } } : x)) };
    const all = toggle({ ...bus, chassis: 'steel' }, 'lamp', 'heater', 'arm', 'mast', 'camera');
    const out = fitBayToChassis({ ...all, chassis: 'titanium' }, tiny);
    expect(out.dropped).toEqual(['camera']);
    expect(fittedSystems(out.build, tiny)).toHaveLength(4);
    expect(fitBayToChassis({ ...steel, chassis: undefined }, catalog).dropped).toEqual([]); // no chassis: nothing to fit to
  });

  it('carry-over: a Mars build on a world without the arm and mast loses them with the notice; "No arm" is not named', () => {
    const marsOnly = (x: Part): Part => (x.slot === 'arm' || x.slot === 'mast' || x.id === 'organics' ? { ...x, worlds: ['mars'] } : x);
    const all: PartsFile = { ...catalog, parts: catalog.parts.map(marsOnly) };
    const mars = { ...bus, lights: 'lamp', heater: 'heater', support: { arm: 'arm', mast: 'no-mast' }, payload: ['organics', 'camera'] };
    const onTitan = carryBuild(mars, { ...all, supportSlots: undefined }, 'titan');
    expect(onTitan.dropped.map((x) => x.id)).toEqual(['arm', 'organics']);
    expect(onTitan.build).toEqual({ ...bus, lights: 'lamp', heater: 'heater', payload: ['camera'] });
    // An old Moon save with "No lights" on Mars: the none part reads as not fitted, nothing is named lost.
    const moon = carryBuild({ ...bus, lights: 'no-lights', heater: 'heater', payload: ['camera'] }, all, 'mars');
    expect(moon).toEqual({ build: { ...bus, heater: 'heater', payload: ['camera'] }, dropped: [] });
  });
});
