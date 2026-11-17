import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { groupMilestones, instrumentMilestones, notReached, rockTypeTally, earnedWith, unmetSupport } from './milestoneLists';
import { selectedParts } from './rover';
import type { Build, Instrument } from './types';

const data = loadGameData();
const mars = loadGameData('mars');
const all = data.milestones.milestones;
const names = (ms: { name: string }[]) => ms.map((m) => m.name);

/** A complete build with these bus choices and instruments (bay order = the order given). */
function build(opts: { lights?: boolean; heater?: boolean; instruments: Instrument[] }): Build {
  return {
    chassis: 'chassis-steel', wheels: 'wheels-mesh', power: 'power-fixed-panel', battery: 'battery-li-ion',
    lights: opts.lights ? 'lights-led' : 'lights-none', heater: opts.heater ? 'heater-rhu' : 'heater-none',
    payload: opts.instruments.map((i) => `instrument-${i}`),
  };
}
const partsOf = (b: Build) => selectedParts(b, data.parts);

describe('desk cards: what each instrument can earn', () => {
  it('lists every milestone that requires the instrument, combos on both cards, in catalog order', () => {
    expect(names(instrumentMilestones('camera', all))).toEqual(['Crater layers', 'Earth on the horizon', 'Rim panorama', 'Boulder track', 'Documented sample']);
    expect(names(instrumentMilestones('xray', all))).toEqual(['Rock collection', 'Rare rock', 'Documented sample']);
    expect(names(instrumentMilestones('neutron', all))).toEqual(['Cold trap survey', 'Hidden hydrogen', 'Ice deposit located']);
    expect(names(instrumentMilestones('seismometer', all))).toEqual(['Moonquake record', 'Clean seismogram', 'Science station']);
    expect(names(instrumentMilestones('reflector', all))).toEqual(['Laser ranging site', 'Science station']);
    expect(names(instrumentMilestones('drill', all))).toEqual(['Regolith sample', 'Water ice', 'Fresh ejecta sample']);
  });

  it('on Mars the Moon stations earn nothing, and every Mars instrument earns a milestone (Mars step 4b)', () => {
    for (const inst of ['seismometer', 'reflector'] as const) expect(instrumentMilestones(inst, mars.milestones.milestones)).toEqual([]);
    for (const inst of ['camera', 'drill', 'neutron', 'xray', 'weather', 'radar', 'laser', 'organics'] as const) {
      expect(instrumentMilestones(inst, mars.milestones.milestones).length, inst).toBeGreaterThan(0);
    }
  });
});

describe('debrief groups', () => {
  it('the rover first, then each instrument in bay order, then the combos; empty groups left out', () => {
    const ids = ['touchdown', 'documented-sample', 'rock-collection', 'boulder-track', 'odometer', 'cold-trap-survey'];
    const earned = all.filter((m) => ids.includes(m.id));
    const groups = groupMilestones(earned, ['xray', 'camera', 'neutron']);
    expect(groups.map((g) => (g.key.kind === 'instrument' ? g.key.instrument : g.key.kind))).toEqual(['rover', 'xray', 'camera', 'neutron', 'combo']);
    expect(names(groups[0]!.milestones)).toEqual(['Touchdown', 'Odometer']);
    expect(names(groups[4]!.milestones)).toEqual(['Documented sample']);
    expect(groupMilestones([], ['camera'])).toEqual([]);
  });

  it('the log links each instrument to the earned milestones that need it, combos included', () => {
    const earned = [{ id: 'rock-collection', stages: 2 }, { id: 'documented-sample' }, { id: 'touchdown' }];
    expect(names(earnedWith('xray', all, earned))).toEqual(['Rock collection', 'Documented sample']);
    expect(names(earnedWith('neutron', all, earned))).toEqual([]);
    expect(names(earnedWith('xray', all, [{ id: 'rock-collection', stages: 0 }]))).toEqual([]);
  });

  it('rock types: distinct types read out of the five in the suites', () => {
    const xray = data.tuning.instruments.xray;
    expect(rockTypeTally([], xray)).toEqual({ count: 0, total: 5 });
    expect(rockTypeTally([{ rock: 'ferroan-anorthosite' }, { rock: 'ferroan-anorthosite' }, { rock: 'impact-melt-breccia' }], xray)).toEqual({ count: 2, total: 5 });
  });
});

describe('debrief "Not reached"', () => {
  const run = (b: Build, earned: { id: string; stages?: number }[] = [], held: string[] = []) =>
    names(notReached(all, partsOf(b), earned, held, b.payload.map((id) => data.parts.parts.find((p) => p.id === id)!.effects.instrument!)));

  it('lists the milestones the rover carried every part for and did not earn, by bay order then combos', () => {
    expect(run(build({ instruments: ['xray', 'camera'] }))).toEqual([
      'Rock collection', 'Rare rock', 'Crater layers', 'Earth on the horizon', 'Rim panorama', 'Boulder track', 'Documented sample',
    ]);
  });

  it('a missing part leaves the milestone out: lights for Ice deposit located, lights and heater for Water ice, both instruments for a combo', () => {
    expect(run(build({ instruments: ['neutron'] }))).toEqual(['Cold trap survey', 'Hidden hydrogen']);
    expect(run(build({ lights: true, instruments: ['neutron'] }))).toEqual(['Cold trap survey', 'Hidden hydrogen', 'Ice deposit located']);
    expect(run(build({ lights: true, instruments: ['drill'] }))).toEqual(['Regolith sample', 'Fresh ejecta sample']);
    expect(run(build({ lights: true, heater: true, instruments: ['drill'] }))).toEqual(['Regolith sample', 'Water ice', 'Fresh ejecta sample']);
    expect(run(build({ instruments: ['seismometer'] }))).toEqual(['Moonquake record', 'Clean seismogram']);
    expect(run(build({ instruments: ['seismometer', 'reflector'] }))).toEqual(['Moonquake record', 'Clean seismogram', 'Laser ranging site', 'Science station']);
  });

  it('earned milestones are left out, and a staged one with a single stage earned is not listed', () => {
    const b = build({ instruments: ['xray'] });
    expect(run(b, [{ id: 'rock-collection', stages: 1 }])).toEqual(['Rare rock']);
    expect(run(b, [{ id: 'rare-rock' }])).toEqual(['Rock collection']);
  });

  it('a record already held at launch is left out', () => {
    expect(run(build({ instruments: ['xray'] }), [], ['rare-rock', 'touchdown'])).toEqual(['Rock collection']);
    expect(run(build({ instruments: ['seismometer', 'reflector'] }), [], ['science-station'])).not.toContain('Science station');
  });

  it('capability milestones are never listed, even when not earned or when their slots are carried (Into the dark)', () => {
    expect(run(build({ lights: true, heater: true, instruments: [] }))).toEqual([]);
    const listed = run(build({ lights: true, heater: true, instruments: ['camera', 'drill', 'neutron'] }));
    for (const m of all.filter((x) => x.category === 'capability')) expect(listed).not.toContain(m.name);
    expect(listed).not.toContain('Touchdown');
  });
});

describe('debrief "Not reached": a missing support part (Mars M18)', () => {
  const marsParts = (...ids: string[]) => ids.map((id) => mars.parts.parts.find((p) => p.id === id)!);
  const byId = (id: string) => mars.milestones.milestones.find((m) => m.id === id)!;

  it('names the support part a carried instrument needs and the rover lacks, from the instrument\'s needs', () => {
    expect(unmetSupport(byId('organic-signals'), marsParts('arm-none', 'instrument-organics'))).toEqual(['arm']);
    expect(unmetSupport(byId('remote-reading'), marsParts('arm-robotic', 'mast-none', 'instrument-laser'))).toEqual(['mast']);
    // Since November 16 the X-ray needs no arm: its milestones, and its combo with the camera, name nothing.
    expect(unmetSupport(byId('mars-rock-collection'), marsParts('arm-none', 'mast-none', 'instrument-xray'))).toEqual([]);
    expect(unmetSupport(byId('mars-documented-sample'), marsParts('arm-none', 'instrument-camera', 'instrument-xray'))).toEqual([]);
  });

  it('nothing when the rover carries the support part, the instrument needs none, or the milestone needs no instrument', () => {
    expect(unmetSupport(byId('mars-rock-collection'), marsParts('arm-robotic', 'mast-none', 'instrument-xray'))).toEqual([]);
    expect(unmetSupport(byId('remote-reading'), marsParts('arm-none', 'mast-remote', 'instrument-laser'))).toEqual([]);
    expect(unmetSupport(byId('long-profile'), marsParts('arm-none', 'mast-none', 'instrument-radar'))).toEqual([]);
    expect(unmetSupport(byId('mars-clean-run'), marsParts('arm-none', 'mast-none'))).toEqual([]);
  });

  it('the Moon is unchanged: its X-ray needs no arm', () => {
    const rock = all.find((m) => m.id === 'rock-collection')!;
    expect(unmetSupport(rock, partsOf(build({ instruments: ['xray', 'camera'] })))).toEqual([]);
  });
});
