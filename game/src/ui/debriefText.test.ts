import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { emptyInstrumentLog } from '../rules/instruments';
import type { Payout } from '../rules/payout';
import type { GameData } from '../rules/types';
import {
  debriefBadge, debriefTabs, groupHeading, instrumentLogGroups, lessonIsNew, overviewTiles, payoutRows, withoutPrefix,
  type DebriefCounts,
} from './debriefText';

const moon = loadGameData();
const mars = loadGameData('mars');
const titan = loadGameData('titan');
const worlds: [string, GameData][] = [['moon', moon], ['mars', mars], ['titan', titan]];

const payout = (over: Partial<Payout> = {}): Payout => ({
  survivalPayout: 200, milestones: [], milestoneMoney: 90, milestoneRp: 8, penalty: 0, money: 290, rp: 8, newRecords: [], ...over,
});

describe('debrief tabs', () => {
  const t = moon.text.debrief;
  const full: DebriefCounts = { milestones: 4, lessons: 2, newLessons: 1, logGroups: 3, photos: 5, camera: true };

  it('Overview first, then Milestones, Lessons, Instrument log and Photos, with counts in the labels', () => {
    const tabs = debriefTabs(full, t);
    expect(tabs.map((x) => x.id)).toEqual(['overview', 'milestones', 'lessons', 'log', 'photos']);
    expect(tabs.map((x) => x.label)).toEqual(['Overview', 'Milestones · 4', 'Lessons · 1 new', 'Instrument log', 'Photos · 5']);
  });

  it('Lessons counts all of them when none is new', () => {
    expect(debriefTabs({ ...full, newLessons: 0 }, t).find((x) => x.id === 'lessons')!.label).toBe('Lessons · 2');
  });

  it('hides empty Lessons, Instrument log and Photos; Milestones always shows', () => {
    const tabs = debriefTabs({ milestones: 0, lessons: 0, newLessons: 0, logGroups: 0, photos: 0, camera: false }, t);
    expect(tabs.map((x) => x.id)).toEqual(['overview', 'milestones']);
    expect(tabs[1]!.label).toBe('Milestones · 0');
  });

  it('Photos shows when a camera was carried even with an empty album (its panel says none were taken); no camera, no photos: hidden', () => {
    const none: DebriefCounts = { milestones: 0, lessons: 0, newLessons: 0, logGroups: 0, photos: 0, camera: true };
    expect(debriefTabs(none, t).map((x) => x.label)).toEqual(['Overview', 'Milestones · 0', 'Photos · 0']);
    expect(debriefTabs({ ...none, camera: false }, t).map((x) => x.id)).not.toContain('photos');
    expect(debriefTabs({ ...none, camera: false, photos: 2 }, t).map((x) => x.id)).toContain('photos');
  });

  it('every world fills every tab label with no placeholder left', () => {
    for (const [w, d] of worlds) {
      for (const tab of debriefTabs(full, d.text.debrief)) expect(tab.label, `${w} ${tab.id}`).not.toMatch(/[{}]/);
    }
  });
});

describe('the round badge', () => {
  it('names the unlocked world, or that the round failed', () => {
    expect(debriefBadge(false, moon.text.debrief)).toEqual({ text: 'Passed · Mars unlocked', tone: 'good' });
    expect(debriefBadge(true, moon.text.debrief)).toEqual({ text: 'Failed · restart the round', tone: 'bad' });
    expect(debriefBadge(false, mars.text.debrief).text).toBe('Passed · Titan unlocked');
    expect(debriefBadge(true, mars.text.debrief).text).toBe('Failed · restart the round');
  });

  it('Titan passes on survival', () => {
    expect(debriefBadge(false, titan.text.debrief).text).toBe('Titan survived');
    expect(debriefBadge(true, titan.text.debrief)).toEqual({ text: 'Rover lost', tone: 'bad' });
  });
});

describe('new lessons', () => {
  it('a lesson is new when the notebook at launch did not hold it; unknown launch notebook: none is new', () => {
    expect(lessonIsNew('a', [])).toBe(true);
    expect(lessonIsNew('a', ['a'])).toBe(false);
    expect(lessonIsNew('a', null)).toBe(false);
  });
});

describe('the Overview tiles and payout rows', () => {
  const base = { payout: payout(), balance: 1200, failed: false, last: false, milestones: 3, notReached: 0 };

  it('net change, balance, research points, milestones (the next minimum budget is not repeated on a tile)', () => {
    const tiles = overviewTiles(base, moon);
    expect(tiles.map((x) => x.id)).toEqual(['net', 'balance', 'rp', 'milestones']);
    expect(tiles[0]).toMatchObject({ label: 'Net change', tone: 'good' });
    expect(tiles[0]!.value).toBe(`${moon.text.moneyPrefix}290${moon.text.moneySuffix}`);
    expect(tiles[1]).toMatchObject({ label: 'Balance', sub: null, tone: 'good' });
    expect(tiles[2]).toMatchObject({ value: '8', sub: null });
    expect(tiles[3]).toMatchObject({ value: '3', sub: null });
    for (const [w, d] of worlds) expect(overviewTiles(base, d)[1]!.sub, w).toBeNull();
  });

  it('a failed round shows the balance in the warning color, a loss the net change too; missed milestones are counted', () => {
    const tiles = overviewTiles({ ...base, payout: payout({ money: -50 }), failed: true, notReached: 2 }, moon);
    expect(tiles[0]!.tone).toBe('bad');
    expect(tiles[0]!.value.startsWith('−')).toBe(true);
    expect(tiles[1]!.tone).toBe('bad');
    expect(tiles[3]!.sub).toBe('2 not reached');
  });

  it('Titan: the balance tile has no tone (it passes on survival, not on the balance)', () => {
    expect(overviewTiles({ ...base, last: true }, titan)[1]!.tone).toBeNull();
  });

  it('the payout rows: survival payout, milestone rewards, the loss penalty with its cause', () => {
    expect(payoutRows(payout(), { survived: true }, moon).map((r) => r.label)).toEqual(['Survival payout', 'Milestone rewards', 'Loss penalty']);
    const lost = payoutRows(payout({ penalty: 100 }), { survived: false, cause: 'energy' }, moon);
    expect(lost[2]).toMatchObject({ label: `Loss penalty (${moon.text.causes.energy})`, tone: 'bad' });
    expect(lost[2]!.value.startsWith('−')).toBe(true);
    expect(payoutRows(payout({ penalty: 100 }), { survived: false, cause: 'destroyed', detail: 'rollover' }, moon)[2]!.label).toBe(`Loss penalty (${moon.text.debrief.rollover})`);
  });
});

describe('the instrument log, grouped by instrument', () => {
  it('nothing without a log or for instruments not carried', () => {
    expect(instrumentLogGroups(null, moon, [])).toEqual([]);
    expect(instrumentLogGroups(emptyInstrumentLog(['camera', 'drill']), moon, [])).toEqual([]);
  });

  it('the X-ray: one heading, its rock readings under it without the repeated name, the rock collection and what it earned', () => {
    const log = { ...emptyInstrumentLog(['xray', 'neutron']), rocks: [{ boulder: 1, rock: 'ferroan-anorthosite' }, { boulder: 2, rock: 'magnesian-norite' }], hydrogenPeak: 0.42 };
    const groups = instrumentLogGroups(log, moon, [{ id: 'rock-collection', stages: 2 }]);
    expect(groups.map((g) => g.instrument)).toEqual(['neutron', 'xray']); // the log's own instrument order, as before
    const xray = groups[1]!;
    expect(xray.heading).toBe('X-ray spectrometer');
    expect(xray.lines).toHaveLength(2);
    expect(xray.lines[0]).toMatch(/^Ferroan anorthosite\. /);
    for (const l of xray.lines) expect(l).not.toMatch(/X-ray spectrometer/);
    expect(xray.summary).toMatch(/^Rock collection: 2 of \d+ rock types\.$/);
    expect(xray.earned).toBe('Earned: Rock collection.');
    expect(groups[0]).toMatchObject({ heading: 'Neutron spectrometer', lines: ['Highest hydrogen reading 42%.'], summary: null, earned: null });
  });

  it('plain wording when unused, every Moon instrument', () => {
    const groups = instrumentLogGroups(emptyInstrumentLog(['neutron', 'xray', 'seismometer', 'reflector']), moon, []);
    expect(groups.map((g) => [g.heading, g.lines])).toEqual([
      ['Neutron spectrometer', ['Not switched on.']],
      ['X-ray spectrometer', ['No rocks were read.']],
      ['Seismometer station', ['Not set down.']],
      ['Laser retroreflector', ['Not placed.']],
    ]);
    expect(groups.every((g) => g.summary === null && g.earned === null)).toBe(true);
  });

  it('Mars: the weather mast, radar, laser and organics lines, under their part names', () => {
    const log = {
      ...emptyInstrumentLog(['weather', 'radar', 'laser', 'organics']),
      weatherSeconds: 40, stormForecastByMast: true, radarLongestM: 120.4, radarLayers: ['floor', 'delta'],
      laser: [{ target: 'cliff' as const, boulder: null, rock: null }], organics: 2,
    };
    const groups = instrumentLogGroups(log, mars, []);
    expect(groups.map((g) => g.heading)).toEqual(['Weather mast', 'Ground-penetrating radar', 'Laser spectrometer', 'Organics spectrometer']);
    expect(groups[0]!.lines[0]).toMatch(/^Recorded pressure and dust for 40 s\. It forecast/);
    expect(groups[1]!.lines[0]).toMatch(/^Longest unbroken profile 120 m\./);
    expect(groups[2]!.lines[0]).toBe(mars.text.instrumentText.laser.resultCliff); // its own prefix stays
    expect(groups[3]!.lines[0]).toMatch(/^Finished readings: 2\./);
  });

  it('every world leaves no placeholder in any line', () => {
    for (const [w, d] of worlds) {
      const carried = [...new Set(d.parts.parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : [])))];
      for (const g of instrumentLogGroups(emptyInstrumentLog(carried), d, [])) {
        for (const line of g.lines) expect(line, `${w} ${g.instrument}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('drops only the heading\'s own prefix, and capitalizes what follows', () => {
    expect(withoutPrefix('X-ray spectrometer: no rocks were read.', 'X-ray spectrometer')).toBe('No rocks were read.');
    expect(withoutPrefix('Laser reading: Basalt.', 'Laser spectrometer')).toBe('Laser reading: Basalt.');
  });

  it('group headings: the rover, the instrument part, instruments together', () => {
    expect(groupHeading({ kind: 'rover' }, moon)).toBe(moon.text.debrief.groupRover);
    expect(groupHeading({ kind: 'instrument', instrument: 'drill' }, moon)).toBe('Regolith drill');
    expect(groupHeading({ kind: 'combo' }, moon)).toBe(moon.text.debrief.groupCombo);
  });
});
