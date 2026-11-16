import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { missionVars, tutorialPages } from './tutorialText';
import { fill } from './dom';
import type { Instrument } from '../rules/types';

const moon = loadGameData();
const mars = loadGameData('mars');
const titan = loadGameData('titan');
const all = (pages: { title: string; paragraphs: string[] }[]) => pages.flatMap((p) => [p.title, ...p.paragraphs]).join('\n');
const unfilled = /\{\w+\}|\[placeholder|\[to fact-check/;

describe('Titan tutorial, briefing and campaign text', () => {
  it('Titan has its own design and drive pages, with every placeholder filled', () => {
    for (const instruments of [['camera'], ['drill'], []] as Instrument[][]) {
      for (const id of ['design', 'drive'] as const) {
        const text = all(tutorialPages(id, titan, { mission: 'titan', instruments, balance: 900 }));
        expect(text).not.toMatch(unfilled);
        expect(text).not.toBe(all(tutorialPages(id, mars, { mission: 'mars', instruments, balance: 900 })));
      }
    }
  });

  it('takes the day, night, sleep and rain numbers from the Titan data', () => {
    const sol = titan.tuning.sol!;
    const rain = titan.events.rainstorm!;
    const vars = missionVars(titan);
    expect(vars.dayLeftMinutes).toBe((sol.daySeconds - (sol.startSecondsIntoDay ?? 0)) / 60);
    expect(vars.nightMinutes).toBe(sol.nightSeconds / 60);
    expect(Number(vars.dayLeftMinutes) + Number(vars.nightMinutes) + Number(vars.dawnMinutes)).toBe(titan.tuning.mission.lengthSeconds / 60);
    const drive = all(tutorialPages('drive', titan, { mission: 'titan', instruments: ['camera'] }));
    expect(drive).toContain(`${titan.tuning.sleep!.nightClockRate} times faster`);
    expect(drive).toContain(`about ${rain.warningSeconds} s ahead`);
    expect(drive).toContain(`about ${rain.durationSeconds} s`);
    const design = all(tutorialPages('design', titan, { mission: 'titan', instruments: [], balance: 900 }));
    expect(design).toContain('$900k');
    expect(design).toContain(`($${titan.tuning.budget.minimumBudget.complete}k)`); // the final mark
  });

  it('the design, landing, debrief and Campaign complete text is complete', () => {
    const c = titan.text.campaign!;
    const t = titan.text.titanCampaign!;
    const vars = missionVars(titan);
    for (const line of c.newOnMars) expect(fill(line, vars)).not.toMatch(unfilled);
    const fixed = [
      c.kicker, c.sameParts, c.ticketNote, c.sources, titan.text.landing.briefing, titan.text.comingSoon.heading, titan.text.comingSoon.body,
      t.solarNote, t.factsHeading, ...t.facts, t.dragonflyHeading, ...t.dragonfly, t.lesson, t.dragonflySource,
      t.complete.kicker, t.complete.lessonsHeading, ...t.complete.lessons,
    ];
    for (const s of fixed) expect(s).not.toMatch(unfilled);
    expect(fill(t.selk, { distance: 85, direction: 'north' })).not.toMatch(unfilled);
    expect(fill(t.solarIncome, { income: 0.001 })).not.toMatch(unfilled);
    const rover = { wheels: 'Wheels', battery: 'Battery', capacity: 600, heater: 'Heater', lights: 'Lights' };
    for (const row of t.compare) expect(fill(row.rover, rover) + row.dragonfly + row.label).not.toMatch(unfilled);
    expect(titan.text.comingSoon.heading).toBe('Campaign complete');
    expect(titan.text.debrief.continue).toBe('Finish the campaign');
  });

  it('the Moon and Mars keep their own screens', () => {
    expect(moon.text.titanCampaign).toBeUndefined();
    expect(mars.text.titanCampaign).toBeUndefined();
    expect(mars.text.comingSoon.heading).toBe('Titan: coming soon');
    expect(mars.text.debrief.continue).toBe('Continue to Titan');
  });
});
