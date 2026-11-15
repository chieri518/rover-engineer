import { describe, expect, it } from 'vitest';
import {
  fitPayload, instrumentCosts, instrumentForKey, instrumentKeys, instrumentsOf, isBayOverCapacity, mountingPoints, payloadProblems,
  togglePayload, upgradeSavedBuild,
} from './payload';
import { selectedParts } from './rover';
import { testParts } from './testData';
import type { Build, PartsFile } from './types';

const build: Build = {
  chassis: 'steel', wheels: 'solid', power: 'panel', battery: 'battery', lights: 'lamp', heater: 'heater', payload: ['camera'],
};

describe('mounting points', () => {
  it('come from the chassis: steel 3, titanium 2 in the test data; none without a chassis', () => {
    expect(mountingPoints(selectedParts(build, testParts))).toBe(3);
    expect(mountingPoints(selectedParts({ ...build, chassis: 'titanium' }, testParts))).toBe(2);
    expect(mountingPoints([])).toBe(0);
  });

  it('the instruments a rover carries, in bay order', () => {
    expect(instrumentsOf(selectedParts({ ...build, payload: ['drill', 'camera'] }, testParts))).toEqual(['drill', 'camera']);
    expect(instrumentsOf(selectedParts({ ...build, payload: [] }, testParts))).toEqual([]);
  });
});

describe('payload problems', () => {
  it('none for a bay that fits, an empty bay, or an unconfirmed one', () => {
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

  it('reports more instruments than mounting points, once a chassis is chosen', () => {
    const three = ['camera', 'drill', 'extra'];
    const catalog: PartsFile = {
      ...testParts,
      parts: [...testParts.parts, { id: 'extra', slot: 'instrument', name: 'x', description: '', cost: 1, mass: 1, size: 1, effects: { instrument: 'camera' } }],
    };
    expect(payloadProblems({ chassis: 'titanium', payload: three }, catalog)).toContainEqual({ kind: 'over-capacity', count: 3, points: 2 });
    expect(isBayOverCapacity({ chassis: 'titanium', payload: ['camera', 'drill'] }, testParts)).toBe(false);
    expect(isBayOverCapacity({ payload: three }, catalog)).toBe(false); // no chassis yet
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

  it('keeps a current build as it is, and an unconfirmed bay unconfirmed', () => {
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
    expect(upgradeSavedBuild({ chassis: 'steel', instrument: 'gone' }, testParts)).toEqual({ chassis: 'steel' });
  });

  it('a bay emptied by dropped ids is unconfirmed, so the player chooses again', () => {
    expect(upgradeSavedBuild({ ...build, payload: ['gone'] }, testParts)).not.toHaveProperty('payload');
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
      { instrument: 'drill', energyPerUse: 10, standbyEnergy: 0, useSeconds: 3 },
      { instrument: 'camera', energyPerUse: 0, standbyEnergy: 0, useSeconds: 0 },
    ]);
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
