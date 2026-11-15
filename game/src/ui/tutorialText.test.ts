import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { missionVars, tutorialPages } from './tutorialText';
import { fill } from './dom';

const data = loadGameData();

describe('tutorial text', () => {
  it('fills every placeholder on both tutorials', () => {
    for (const id of ['design', 'drive'] as const) {
      const pages = tutorialPages(id, data, { mission: 'moon', instrument: 'camera' });
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) for (const s of [p.title, ...p.paragraphs]) expect(s).not.toMatch(/\{\w+\}/);
    }
  });

  it('takes numbers from the game data and shows only the equipped instrument', () => {
    const drive = (instrument: 'camera' | 'drill') =>
      tutorialPages('drive', data, { mission: 'moon', instrument }).flatMap((p) => p.paragraphs).join('\n');
    expect(drive('camera')).toContain(`${data.tuning.ground.maxSlopeDegrees}°`);
    expect(drive('camera')).toContain(`at least ${data.tuning.milestones.earthPhotoMinDistanceM} m from the lander`);
    expect(drive('camera')).not.toContain(data.text.tutorial.drive.at(-1)!.instrument!.drill!);
    expect(drive('drill')).toContain(`at least ${data.tuning.milestones.sampleSpacingM} m from the lander and from each other`);
    const design = tutorialPages('design', data, { mission: 'moon', instrument: null }).flatMap((p) => p.paragraphs).join('\n');
    for (const tier of data.tiers.tiers) expect(design).toContain(`${tier.massLimit} kg`);
  });
});

describe('Mars tutorial and briefing text', () => {
  const mars = loadGameData('mars');
  const all = (pages: { title: string; paragraphs: string[] }[]) => pages.flatMap((p) => [p.title, ...p.paragraphs]).join('\n');
  const unfilled = /\{\w+\}|\[placeholder\]/;

  it('Mars has its own design and drive pages, with every placeholder filled', () => {
    for (const instrument of ['camera', 'drill', null] as const) {
      for (const id of ['design', 'drive'] as const) {
        const text = all(tutorialPages(id, mars, { mission: 'mars', instrument, balance: 900 }));
        expect(text).not.toMatch(unfilled);
        expect(text).not.toBe(all(tutorialPages(id, data, { mission: 'moon', instrument })));
      }
    }
  });

  it('takes the night, storm and pass-mark numbers from the Mars data', () => {
    const sol = mars.tuning.sol!;
    const storm = mars.events.duststorm!;
    const drive = all(tutorialPages('drive', mars, { mission: 'mars', instrument: 'camera' }));
    expect(drive).toContain(`${sol.sols} sols`);
    expect(drive).toContain(`${sol.daySeconds} s of daylight followed by ${sol.nightSeconds} s of night`);
    expect(drive).toContain(`about ${Math.round(storm.solarFactor * 100)}%`);
    expect(drive).toContain(mars.text.night!.sunset);
    const design = all(tutorialPages('design', mars, { mission: 'mars', instrument: null, balance: 900 }));
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
