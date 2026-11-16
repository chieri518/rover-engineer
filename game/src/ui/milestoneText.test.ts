import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { deskCardNotes, milestoneHowTo, notReachedLine } from './milestoneText';
import type { GameData, Instrument } from '../rules/types';

const data = loadGameData();
const mars = loadGameData('mars');
const byId = (id: string) => data.milestones.milestones.find((m) => m.id === id)!;
const howTo = (id: string) => milestoneHowTo(byId(id), data)!;

describe('how-to lines from the data', () => {
  it('every Moon and Mars how-to line fills with no placeholder left', () => {
    for (const d of [data, mars]) {
      for (const m of d.milestones.milestones) expect(milestoneHowTo(m, d) ?? '', m.id).not.toMatch(/[{}]/);
    }
    for (const m of data.milestones.milestones) expect(howTo(m.id).length, m.id).toBeGreaterThan(0);
  });

  it('the how-to lines repeat no number of their own: every number comes from the data', () => {
    for (const m of data.milestones.milestones) expect(m.howTo, m.id).not.toMatch(/\d/);
  });

  it('the filled Moon lines show the numbers from the triggers and the tuning', () => {
    const mt = data.tuning.milestones;
    const trigger = <T>(id: string) => byId(id).trigger as T;
    expect(howTo('odometer')).toBe(`Drive 500 m, 1 km and 2 km in one mission.`);
    expect(trigger<{ meters: number[] }>('odometer').meters).toEqual([500, 1000, 2000]);
    expect(howTo('mapper')).toContain(`${Math.round(trigger<{ share: number }>('mapper').share * 1000) / 10}%`);
    expect(howTo('crater-descent')).toContain(`more than ${mt.craterDescentDepthM} m below`);
    expect(howTo('clean-run')).toContain(`all ${data.tuning.mission.gameDays} days`);
    expect(howTo('regolith-sample')).toContain(`at least ${mt.sampleMinDistanceM} m from the lander. Up to ${trigger<{ sites: number }>('regolith-sample').sites} sites, each ${mt.sampleSpacingM} m`);
    expect(howTo('earth-on-horizon')).toContain(`at least ${mt.earthPhotoMinDistanceM} m from the lander`);
    const survey = trigger<{ meters: number; sites: number }>('cold-trap-survey');
    expect(howTo('cold-trap-survey')).toContain(`drive ${survey.meters} m`);
    expect(howTo('cold-trap-survey')).toContain(`up to ${survey.sites}.`);
    expect(howTo('ice-deposit-located')).toContain(`at least ${Math.round(data.tuning.instruments.neutron.iceSignalShare * 100)}%`);
    expect(howTo('rock-collection')).toContain(`Read ${trigger<{ rocks: number[] }>('rock-collection').rocks.join(', ').replace(/, (\d+)$/, ' and $1')} different`);
    expect(howTo('boulder-track')).toContain(`within ${mt.boulderTrackPhotoRangeM} m`);
    expect(howTo('documented-sample')).toContain(`within ${mt.documentedSampleRangeM} m`);
    for (const id of ['fresh-ejecta-sample', 'moonquake-record', 'laser-ranging-site', 'science-station']) expect(howTo(id), id).toContain(` ${mt.sampleMinDistanceM} m from the lander`);
    expect(howTo('science-station')).toContain(`within ${trigger<{ near: { withinM: number } }>('science-station').near.withinM} m of each other`);
  });

  it('every Mars milestone has a how-to line with no number of its own (Mars step 8 added the eight carried over)', () => {
    for (const m of mars.milestones.milestones) {
      expect(milestoneHowTo(m, mars)?.length ?? 0, m.id).toBeGreaterThan(0);
      expect(m.howTo, m.id).not.toMatch(/\d/);
    }
    const noHowTo = { ...byId('touchdown'), howTo: undefined };
    expect(milestoneHowTo(noHowTo, data)).toBeUndefined();
  });

  it('the carried-over Mars lines show the numbers from the Mars triggers and tuning', () => {
    const marsHowTo = (id: string) => milestoneHowTo(mars.milestones.milestones.find((m) => m.id === id)!, mars)!;
    const mt = mars.tuning.milestones;
    expect(marsHowTo('mars-odometer')).toBe('Drive 500 m, 1.5 km and 3 km in one mission.');
    expect(marsHowTo('mars-mapper')).toBe('Explore 2.5% of the map in one mission.');
    expect(marsHowTo('night-drive')).toBe("Drive 100 m and 300 m after dark, over the mission's nights.");
    expect(marsHowTo('night-drive')).not.toMatch(/\blights?\b/i); // the no-lights block is the desk's to state
    expect(marsHowTo('core-sample')).toContain(`at least ${mt.sampleMinDistanceM} m from the lander. Up to 3 sites, each ${mt.sampleSpacingM} m`);
    expect(marsHowTo('blue-sunset')).toContain(`within ${mt.sunsetMaxElevationDeg}° of the horizon, at least ${mt.sunsetPhotoMinDistanceM} m from the lander`);
    expect(marsHowTo('mars-clean-run')).toContain(`all ${mars.tuning.mission.gameDays} sols`);
  });

  it('a changed number in the data shows in the line', () => {
    const changed = { ...data, tuning: { ...data.tuning, milestones: { ...data.tuning.milestones, sampleMinDistanceM: 250 } } };
    expect(milestoneHowTo(byId('laser-ranging-site'), changed)).toContain('more than 250 m from the lander');
  });
});

describe('desk cards: what each instrument can earn (M14) and, on Mars, where it is used', () => {
  const offered = (d: GameData): Instrument[] => d.parts.parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : []));

  it('the Moon cards are unchanged: one "Can earn" line, names only, combos on both cards', () => {
    expect(deskCardNotes('camera', data)).toEqual(['Can earn: Crater layers, Earth on the horizon, Rim panorama, Boulder track, Documented sample.']);
    expect(deskCardNotes('xray', data)).toEqual(['Can earn: Rock collection, Rare rock, Documented sample.']);
    for (const i of offered(data)) expect(deskCardNotes(i, data), i).toHaveLength(1);
  });

  it('every Mars instrument card lists its Mars milestones by name, the camera and X-ray both list Documented sample', () => {
    for (const i of offered(mars)) {
      const notes = deskCardNotes(i, mars);
      expect(notes[0], i).toMatch(/^Can earn: .+\.$/);
      expect(notes[0], i).not.toMatch(/\d|\{/); // no rewards, no placeholders
    }
    expect(deskCardNotes('camera', mars)[0]).toContain('Documented sample');
    expect(deskCardNotes('xray', mars)[0]).toBe('Can earn: Rock collection, Rare rock, Documented sample.');
    expect(deskCardNotes('organics', mars)[0]).toBe('Can earn: Organic signals, Lake organics.');
  });

  it('a world with a where line for an instrument adds it after the names; none without one', () => {
    const withWhere = { ...mars, text: { ...mars.text, design: { ...mars.text.design, instrumentWhere: { laser: 'Where: boulders at different sites.' } } } };
    expect(deskCardNotes('laser', withWhere)).toEqual(['Can earn: Remote reading, Rock from afar.', 'Where: boulders at different sites.']);
    expect(deskCardNotes('radar', withWhere)).toHaveLength(1);
    expect(data.text.design.instrumentWhere).toBeUndefined(); // the Moon desk has none
  });
});

describe('debrief "Not reached" lines', () => {
  const parts = (...ids: string[]) => ids.map((id) => mars.parts.parts.find((p) => p.id === id)!);
  const m = (id: string) => mars.milestones.milestones.find((x) => x.id === id)!;

  it('names the support part the rover lacked (Mars M18), else the name alone', () => {
    expect(notReachedLine(m('mars-rock-collection'), parts('arm-none', 'instrument-xray'), mars)).toBe('Rock collection · Needs the robotic arm.');
    expect(notReachedLine(m('rock-from-afar'), parts('mast-none', 'instrument-laser'), mars)).toBe('Rock from afar · Needs the remote sensing mast.');
    expect(notReachedLine(m('mars-rock-collection'), parts('arm-robotic', 'instrument-xray'), mars)).toBe('Rock collection');
    expect(notReachedLine(byId('rock-collection'), [], data)).toBe('Rock collection');
  });
});
