import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import type { Instrument } from '../rules/types';
import { missionVars, tutorialPages } from './tutorialText';
import { fill } from './dom';

const data = loadGameData();

describe('tutorial text', () => {
  it('fills every placeholder on both tutorials', () => {
    for (const id of ['design', 'drive'] as const) {
      const pages = tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill'] });
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) for (const s of [p.title, ...p.paragraphs]) expect(s).not.toMatch(/\{\w+\}/);
    }
  });

  it('takes numbers from the game data and shows only the instruments carried, with their bay keys', () => {
    const drive = (...instruments: Instrument[]) =>
      tutorialPages('drive', data, { mission: 'moon', instruments }).flatMap((p) => p.paragraphs).join('\n');
    expect(drive('camera')).toContain(`${data.tuning.ground.maxSlopeDegrees}°`);
    expect(drive('camera')).toContain(`at least ${data.tuning.milestones.earthPhotoMinDistanceM} m from the lander`);
    expect(drive('camera')).toContain('Camera: 1 ');
    expect(drive('camera')).not.toContain('Drill:');
    expect(drive('drill')).toContain(`at least ${data.tuning.milestones.sampleSpacingM} m from the lander and from each other`);
    expect(drive('drill', 'camera')).toContain('press 1 ');
    expect(drive('drill', 'camera')).toContain('Camera: 2 ');
    expect(drive()).not.toMatch(/Camera:|Drill:/);
    const design = tutorialPages('design', data, { mission: 'moon', instruments: [] }).flatMap((p) => p.paragraphs).join('\n');
    for (const tier of data.tiers.tiers) expect(design).toContain(`${tier.massLimit} kg`);
  });

  it('has a line for each of the six instruments, keyed in bay order', () => {
    const all: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];
    const pages = tutorialPages('drive', data, { mission: 'moon', instruments: all });
    const text = pages.flatMap((p) => p.paragraphs).join('\n');
    for (const [i, name] of ['Camera', 'Drill', 'Neutron spectrometer', 'X-ray spectrometer', 'Seismometer station', 'Laser retroreflector'].entries()) {
      expect(text).toContain(`${name}: `);
      expect(text).toMatch(new RegExp(`${name}: [^\\n]*\\b${i + 1}\\b`));
    }
  });

  it('covers the bay, the review and the notebook, and announces no relationship', () => {
    const join = (id: 'design' | 'drive') =>
      tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'] })
        .flatMap((p) => [p.title, ...p.paragraphs]).join('\n');
    const design = join('design');
    expect(design).toContain('mounting point');
    expect(design).toContain('No instruments');
    expect(design).toContain('pre-launch review');
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
    const lines = tutorialPages('drive', data, { mission: 'moon', instruments: ['seismometer', 'reflector'] }).flatMap((p) => p.paragraphs);
    const distance = data.tuning.milestones.sampleMinDistanceM;
    for (const name of ['Seismometer station', 'Laser retroreflector']) {
      const line = lines.find((l) => l.startsWith(`${name}: `));
      expect(line, name).toBeDefined();
      expect(line).toContain(`more than ${distance} m from the lander`);
      expect(line).not.toMatch(/[{}]/);
    }
    const changed = { ...data, tuning: { ...data.tuning, milestones: { ...data.tuning.milestones, sampleMinDistanceM: 250 } } };
    const moved = tutorialPages('drive', changed, { mission: 'moon', instruments: ['seismometer'] }).flatMap((p) => p.paragraphs).join('\n');
    expect(moved).toContain('more than 250 m from the lander');
  });

  it('the drive tutorial leaves out the number-key line for an empty bay', () => {
    const lines = (instruments: Instrument[]) => tutorialPages('drive', data, { mission: 'moon', instruments }).flatMap((p) => p.paragraphs).join('\n');
    expect(lines([])).not.toMatch(/number key/);
    expect(lines(['camera'])).toMatch(/number key/);
  });

  it('the design tutorial says each instrument card lists its milestones (every Moon instrument earns some)', () => {
    const design = tutorialPages('design', data, { mission: 'moon', instruments: [] }).flatMap((p) => p.paragraphs).join('\n');
    expect(design).toMatch(/lists the milestones it can earn/);
    expect(design).not.toMatch(/earn no milestones yet/);
    expect(design).not.toMatch(/a few problems/);
  });
});

describe('Mars tutorial and briefing text', () => {
  const mars = loadGameData('mars');
  const all = (pages: { title: string; paragraphs: string[] }[]) => pages.flatMap((p) => [p.title, ...p.paragraphs]).join('\n');
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

  it('the landing and design transition text is complete', () => {
    const c = mars.text.campaign!;
    const vars = missionVars(mars);
    for (const line of c.newOnMars) expect(fill(line, vars)).not.toMatch(unfilled);
    for (const s of [c.kicker, c.sameParts, c.ticketNote, c.sources, mars.text.landing.briefing, mars.text.comingSoon.heading]) {
      expect(s).not.toMatch(unfilled);
    }
    expect(mars.text.comingSoon.heading).toBe('Titan: coming soon');
    expect(data.text.campaign).toBeUndefined(); // the Moon screens are unchanged
  });
});
