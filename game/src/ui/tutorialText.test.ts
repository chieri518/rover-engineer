import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import type { Instrument } from '../rules/types';
import { instrumentLine, missionVars, pageStrings, tutorialPages, type TutorialPageText } from './tutorialText';
import { fill } from './dom';

const data = loadGameData();

describe('tutorial text', () => {
  /** Every string the drive help shows, page by page (instrument rows read "Name: step · step. Counts"). */
  const driveStrings = (d: typeof data, mission: 'moon' | 'mars' | 'titan', instruments: Instrument[]) =>
    tutorialPages('drive', d, { mission, instruments }).flatMap(pageStrings);
  const rows = (d: typeof data, mission: 'moon' | 'mars' | 'titan', instruments: Instrument[]) =>
    tutorialPages('drive', d, { mission, instruments }).flatMap((p) => p.instruments ?? []);

  it('fills every placeholder on both tutorials', () => {
    for (const id of ['design', 'drive'] as const) {
      const pages = tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill'] });
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) for (const s of pageStrings(p)) expect(s).not.toMatch(/\{\w+\}/);
    }
  });

  it('takes numbers from the game data and shows only the instruments carried, with their bay keys', () => {
    const drive = (...instruments: Instrument[]) => driveStrings(data, 'moon', instruments).join('\n');
    expect(drive('camera')).toContain(`${data.tuning.ground.maxSlopeDegrees}°`);
    expect(drive('camera')).toContain(`at least ${data.tuning.milestones.earthPhotoMinDistanceM} m from the lander`);
    expect(drive('camera')).toContain('Camera: Press 1 ·');
    expect(drive('camera')).not.toContain('Drill:');
    expect(drive('drill')).toContain(`at least ${data.tuning.milestones.sampleSpacingM} m from the lander and from each other`);
    expect(drive('drill', 'camera')).toContain('Drill: Stop · Press 1 ·');
    expect(drive('drill', 'camera')).toContain('Camera: Press 2 ·');
    expect(drive()).not.toMatch(/Camera:|Drill:/);
    const design = tutorialPages('design', data, { mission: 'moon', instruments: [] }).flatMap((p) => p.paragraphs).join('\n');
    for (const tier of data.tiers.tiers) expect(design).toContain(`${tier.massLimit} kg`);
  });

  it('has a row for each of the six instruments, keyed in bay order, with no placeholder left', () => {
    const all: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];
    const names = ['Camera', 'Drill', 'Neutron spectrometer', 'X-ray spectrometer', 'Seismometer station', 'Laser retroreflector'];
    for (const bay of [all, [...all].reverse()]) {
      const r = rows(data, 'moon', bay);
      expect(r.map((x) => x.key)).toEqual(bay.map((_, i) => i + 1));
      expect(r.map((x) => x.name)).toEqual(bay.map((i) => names[all.indexOf(i)]));
      for (const x of r) {
        expect(x.steps.length, x.name).toBeGreaterThan(0);
        expect(x.steps, x.name).toContain(`Press ${x.key}`);
        for (const s of [x.name, ...x.steps, x.counts ?? '']) expect(s, x.name).not.toMatch(/[{}]/);
      }
    }
    // The instrument rows are on their own page (the second, on every world), and the map and the notebook on another.
    const pages = tutorialPages('drive', data, { mission: 'moon', instruments: all });
    const inst = pages.find((p) => p.instruments)!;
    expect(inst.title).toBe('Instruments');
    expect(pages.indexOf(inst)).toBe(1);
    expect(pageStrings(inst).join('\n')).not.toMatch(/notebook|The map starts/);
    expect(pages.find((p) => p.title === 'Map and notebook')!.paragraphs.join('\n')).toMatch(/The map starts[\s\S]*engineering notebook/);
  });

  it('opens the drive help with the controls as key caps, the bay keys from the instruments carried', () => {
    for (const world of ['moon', 'mars', 'titan'] as const) {
      const d = loadGameData(world);
      const pages = (instruments: Instrument[]) => tutorialPages('drive', d, { mission: world, instruments });
      const first = pages(['camera', 'drill'])[0]!;
      expect(first.controls, world).toBeDefined();
      expect(first.controls!.heading).toBe(d.text.tutorial.controlsHeading);
      const keys = first.controls!.keys;
      const caps = keys.map((k) => k.caps.flat());
      for (const want of [['W', 'A', 'S', 'D'], ['Space'], ['P'], ['N'], ['M']]) {
        expect(caps.some((c) => want.every((w) => c.includes(w))), `${world} ${want.join(' ')}`).toBe(true);
      }
      expect(keys.find((k) => k.caps.flat().includes('W'))!.caps).toHaveLength(2); // W A S D or the arrows
      if (world !== 'moon') expect(keys.find((k) => k.caps.flat().includes('P'))!.label).toMatch(/sleep/i);
      // The bay's keys: 1 to n for the instruments carried, just 1 for one, and none for an empty bay.
      const bay = keys.at(-1)!;
      expect(bay.caps).toEqual([['1'], ['2']]);
      expect(bay.join).toBe(d.text.tutorial.keysTo);
      expect(pages(['camera'])[0]!.controls!.keys.at(-1)!.caps).toEqual([['1']]);
      expect(pages([])[0]!.controls!.keys.map((k) => k.label)).not.toContain(bay.label);
      expect(pages([])[0]!.controls!.keys).toHaveLength(keys.length - 1);
      // Only the first page has key caps, and the old sentence of keys is gone.
      for (const p of pages(['camera']).slice(1)) expect(p.controls, p.title).toBeUndefined();
      expect(pages(['camera']).flatMap(pageStrings).join('\n'), world).not.toMatch(/W A S D or arrow keys/);
    }
  });

  it('covers the bay and the notebook, and announces no relationship', () => {
    const join = (id: 'design' | 'drive') =>
      tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'] })
        .flatMap(pageStrings).join('\n');
    const design = join('design');
    expect(design).not.toMatch(/No instruments|No lights|No heater/); // leaving a part off is not a choice on the desk (November 16)
    expect(design).toMatch(/energy/i);
    const drive = join('drive');
    expect(drive).toContain('engineering notebook');
    expect(drive).toMatch(/\bN\b/);
    expect(drive).toMatch(/pauses/);
    for (const text of [design, drive]) {
      expect(text).not.toMatch(/noise|noisy|quiet|slow(ly|s) .*cold|sharper|colder detector|drive away/i);
    }
  });

  it('the drive tutorial gives the stations\' lander distance from the data, with no placeholder left', () => {
    const r = rows(data, 'moon', ['seismometer', 'reflector']);
    const distance = data.tuning.milestones.sampleMinDistanceM;
    for (const name of ['Seismometer station', 'Laser retroreflector']) {
      const row = r.find((x) => x.name === name);
      expect(row, name).toBeDefined();
      expect(row!.counts).toContain(`more than ${distance} m from the lander`);
      expect(instrumentLine(row!)).not.toMatch(/[{}]/);
    }
    expect(r.find((x) => x.name === 'Laser retroreflector')!.steps).toEqual(['Stop', 'Earth in view', 'Press 2', 'Sets it down']);
    const changed = { ...data, tuning: { ...data.tuning, milestones: { ...data.tuning.milestones, sampleMinDistanceM: 250 } } };
    expect(rows(changed, 'moon', ['seismometer'])[0]!.counts).toContain('more than 250 m from the lander');
  });

  it('the drive tutorial says so for an empty bay, with no instrument rows', () => {
    for (const world of ['moon', 'mars', 'titan'] as const) {
      const d = loadGameData(world);
      const page = tutorialPages('drive', d, { mission: world, instruments: [] }).find((p) => p.title === 'Instruments')!;
      expect(page.instruments, world).toBeUndefined();
      expect(page.paragraphs, world).toEqual([d.text.tutorial.drive.find((p) => p.instruments)!.emptyBay]);
      expect(page.paragraphs[0]).toMatch(/empty/);
      const full = tutorialPages('drive', d, { mission: world, instruments: ['camera'] }).find((p) => p.title === 'Instruments')!;
      expect(full.paragraphs.join('\n')).toMatch(/number key/);
      expect(full.instruments).toHaveLength(1);
    }
  });

  it('Titan: a row for every instrument its parts offer, claiming only what holds there', () => {
    const titan = loadGameData('titan');
    const all: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];
    const r = rows(titan, 'titan', all);
    expect(r.map((x) => x.key)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const row of r) expect(row.steps.length, row.name).toBeGreaterThan(0); // none is a bare key-and-name row
    expect(r[1]!.name).toBe('Drill');
    expect(r[1]!.counts).toContain(`at least ${titan.tuning.milestones.sampleSpacingM} m from the lander`);
    expect(r[0]!.counts).toMatch(/dune crest/);
    // No quake, no Earth in the sky and no milestone for these four on Titan: the rows must not promise one.
    expect(titan.events.quake).toBeFalsy();
    expect(r.slice(2).map((x) => x.counts).join('\n')).not.toMatch(/moonquake|before the quake|Earth in view|more than \d+ m/);
    expect(r[5]!.steps).not.toContain('Earth in view');
    for (const s of driveStrings(titan, 'titan', all)) expect(s).not.toMatch(/[{}]/);
  });

  it('shows each instrument\'s energy cost on its row, from the part data', () => {
    for (const world of ['moon', 'mars', 'titan'] as const) {
      const d = loadGameData(world);
      const insts = d.allParts.parts.flatMap((p) => (p.effects.instrument && (!p.worlds || p.worlds.includes(world)) ? [p.effects.instrument] : []));
      for (const inst of insts) {
        const part = d.allParts.parts.find((p) => p.effects.instrument === inst)!;
        const row = rows(d, world, [inst])[0]!;
        const { energyPerUse, standbyEnergy } = part.effects;
        if (energyPerUse) expect(row.steps, `${world} ${inst}`).toContain(`${energyPerUse} energy`);
        else if (standbyEnergy) expect(row.steps, `${world} ${inst}`).toContain(`${standbyEnergy} energy/s`);
      }
    }
    // Change the data and the row follows.
    const moon = loadGameData();
    const changed = { ...moon, allParts: { ...moon.allParts, parts: moon.allParts.parts.map((p) => (p.effects.instrument === 'drill' ? { ...p, effects: { ...p.effects, energyPerUse: 77 } } : p.effects.instrument === 'neutron' ? { ...p, effects: { ...p.effects, standbyEnergy: 0.9 } } : p)) } };
    const r = rows(changed, 'moon', ['drill', 'neutron']);
    expect(r[0]!.steps).toContain('77 energy');
    expect(r[1]!.steps).toContain('0.9 energy/s');
  });

  it('the design tutorial says each instrument card lists its milestones (every Moon instrument earns some)', () => {
    const design = tutorialPages('design', data, { mission: 'moon', instruments: [] }).flatMap((p) => p.paragraphs).join('\n');
    expect(design).toMatch(/the milestones each instrument can earn/);
    expect(design).not.toMatch(/earn no milestones yet/);
    expect(design).not.toMatch(/a few problems/);
  });

  it('the Instruments page is page 2 of the drive help on every world, with or without instruments', () => {
    for (const [world, d] of [['moon', data], ['mars', loadGameData('mars')], ['titan', loadGameData('titan')]] as const) {
      for (const bay of [['camera'], []] as Instrument[][]) {
        const pages = tutorialPages('drive', d, { mission: world, instruments: bay });
        expect(pages[1]!.title, `${world} ${bay.length}`).toBe('Instruments');
        expect(pages.filter((p) => p.title === 'Instruments')).toHaveLength(1);
      }
    }
  });
});

describe('the Rover Operations Guide (the Moon design tutorial) and briefing lines', () => {
  it('has the three guide pages, every number filled from the data', () => {
    const pages = tutorialPages('design', data, { mission: 'moon', instruments: [] });
    expect(pages.map((p) => p.title)).toEqual(['Welcome to REL', 'Mission funding', 'Rover design']);
    const strings = pages.flatMap((p) => [p.title, ...p.blocks.flatMap((b) => (b.kind === 'list' ? b.items : b.kind === 'table' ? [...b.head, ...b.rows.flat()] : [b.text]))]);
    for (const s of strings) expect(s).not.toMatch(/\{\w+\}/);
    const all = strings.join('\n');
    const budget = `$${data.tuning.budget.startingBudget}k`;
    const pass = `$${data.tuning.budget.minimumBudget.mars}k`;
    // The Moon's finances table.
    const finances = pages[1]!.blocks.find((b) => b.kind === 'table');
    expect(finances?.kind === 'table' && finances.rows.map((r) => r[1])).toEqual([budget, pass]);
    // The ticket table: one row per tier, from tiers.json.
    const tickets = pages[2]!.blocks.find((b) => b.kind === 'table');
    expect(tickets?.kind === 'table' && tickets.rows).toEqual(data.tiers.tiers.map((t) => [t.name, `${t.massLimit} kg`, `${t.sizeLimit}`, `$${t.price}k`]));
    // Lines are parsed, not shown as markdown.
    expect(pages[0]!.blocks[0]).toMatchObject({ kind: 'p', text: expect.stringMatching(/^The Rover Exploration Laboratory \(REL\) designs/) });
    expect(all).not.toMatch(/^(### |- )/m);
    expect(all).not.toMatch(/research point|\bRP\b/);
  });

  it('fills the mission briefing on every world', () => {
    for (const world of ['moon', 'mars', 'titan'] as const) {
      const d = loadGameData(world);
      expect(fill(d.text.mission.briefing, missionVars(d))).not.toMatch(/\{\w+\}/);
    }
    expect(fill(data.text.mission.briefing, missionVars(data))).toContain(`${data.tuning.mission.gameDays} days`);
    const mars = loadGameData('mars');
    expect(fill(mars.text.mission.briefing, missionVars(mars))).toContain(`${mars.tuning.sol!.sols} sols`);
  });
});

describe('Mars tutorial and briefing text', () => {
  const mars = loadGameData('mars');
  const all = (pages: TutorialPageText[]) => pages.flatMap(pageStrings).join('\n');
  const unfilled = /\{\w+\}|\[placeholder\]/;

  it('Mars has its own design and drive pages, with every placeholder filled', () => {
    for (const instruments of [['camera'], ['drill'], []] as Instrument[][]) {
      for (const id of ['design', 'drive'] as const) {
        const text = all(tutorialPages(id, mars, { mission: 'mars', instruments, balance: 900 }));
        expect(text).not.toMatch(unfilled);
        expect(text).not.toBe(all(tutorialPages(id, data, { mission: 'moon', instruments })));
      }
    }
  });

  it('takes the night, storm and pass-mark numbers from the Mars data', () => {
    const sol = mars.tuning.sol!;
    const storm = mars.events.duststorm!;
    const drive = all(tutorialPages('drive', mars, { mission: 'mars', instruments: ['camera'] }));
    expect(drive).toContain(`${sol.sols} sols`);
    expect(drive).toContain(`${sol.daySeconds} s of daylight followed by ${sol.nightSeconds} s of night`);
    expect(drive).toContain(`about ${Math.round(storm.solarFactor * 100)}%`);
    expect(drive).toContain(mars.text.night!.sunset);
    const design = all(tutorialPages('design', mars, { mission: 'mars', instruments: [], balance: 900 }));
    expect(design).toContain('$900k');
    expect(design).toContain(`($${mars.tuning.budget.minimumBudget.titan}k)`);
  });

  it('Mars step 8: a line for each of the eight Mars instruments, keyed in bay order, and the near sites first', () => {
    const names: Partial<Record<Instrument, string>> = {
      camera: 'Camera', drill: 'Drill', neutron: 'Neutron spectrometer', xray: 'X-ray spectrometer',
      weather: 'Weather mast', radar: 'Radar', laser: 'Laser spectrometer', organics: 'Organics spectrometer',
    };
    const offered = mars.parts.parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : []));
    expect(offered).toHaveLength(8);
    const pages = tutorialPages('drive', mars, { mission: 'mars', instruments: offered });
    const lines = pages.flatMap(pageStrings);
    const r = pages.flatMap((p) => p.instruments ?? []);
    expect(r.map((x) => x.name)).toEqual(offered.map((inst) => names[inst]));
    for (const [i, x] of r.entries()) {
      expect(x.key, x.name).toBe(i + 1);
      expect(x.steps, x.name).toContain(`Press ${i + 1}`);
      expect(x.counts, x.name).toBeTruthy();
      expect(instrumentLine(x), x.name).not.toMatch(/[{}]/);
    }
    // A full Mars bay (five mounting points at most) in another order keeps the bay order.
    const five = offered.slice(3);
    expect(tutorialPages('drive', mars, { mission: 'mars', instruments: five }).flatMap((p) => p.instruments ?? []).map((x) => x.name)).toEqual(five.map((inst) => names[inst]));
    const drive = lines.join('\n');
    const mt = mars.tuning.milestones;
    expect(drive).toContain(`at least ${mt.sampleMinDistanceM} m from the lander and ${mt.sampleSpacingM} m from each other`);
    for (const site of ['Rocky area 2', 'Rocky area 1', 'young craters']) expect(drive).toContain(site);
    expect(drive).toMatch(/nearest lead is drawn larger and listed first/);
    // With an empty bay every page still has text (the instrument page keeps its empty-bay line).
    for (const p of tutorialPages('drive', mars, { mission: 'mars', instruments: [] })) expect(p.paragraphs.length, p.title).toBeGreaterThan(0);
  });

  it('Mars step 8: the design tutorial explains the night budget line, the power choices, the two heaters and the support slots', () => {
    const design = all(tutorialPages('design', mars, { mission: 'mars', instruments: [], balance: 900 }));
    expect(design).toContain(`one ${mars.tuning.sol!.nightSeconds} s night`);
    expect(design).toContain('Night energy tile');
    for (const part of ['deployable solar arrays', 'radioisotope generator (RTG)', 'Radioisotope heater units', 'electric heater', 'robotic arm', 'remote sensing mast']) {
      expect(design).toContain(part);
    }
  });

  it('the landing and design transition text is complete', () => {
    const c = mars.text.campaign!;
    const vars = missionVars(mars);
    for (const line of c.newOnMars) expect(fill(line, vars)).not.toMatch(unfilled);
    for (const s of [mars.text.story.kicker, c.ticketNote, c.sources, mars.text.landing.briefing, mars.text.comingSoon.heading]) {
      expect(s).not.toMatch(unfilled);
    }
    expect(mars.text.comingSoon.heading).toBe('Titan: coming soon');
    expect(data.text.campaign).toBeUndefined(); // the Moon screens are unchanged
  });
});
