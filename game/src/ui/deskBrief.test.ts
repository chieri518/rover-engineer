// The desk's header (game-design.md, "the header reads at a glance"): each world's mission brief and the
// header metrics' wording are complete. The spoiler guard (spoilerGuard.test.ts) checks the same strings for lessons.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { BRIEF_ICONS } from './briefIcons';
import { fill } from './dom';
import { missionVars } from './tutorialText';

const worlds = [loadGameData(), loadGameData('mars'), loadGameData('titan')];
const unfilled = /\{\w+\}/;

describe("the desk's mission brief", () => {
  it.each(worlds.map((d) => [d.world, d] as const))('%s has its own brief: 3 to 5 items per group, known icons, every placeholder filled', (_world, d) => {
    const { brief } = d.text.design;
    const vars = missionVars(d);
    for (const group of [brief.watch, brief.science]) {
      expect(group.length).toBeGreaterThanOrEqual(3);
      expect(group.length).toBeLessThanOrEqual(5);
      for (const item of group) {
        expect(Object.keys(BRIEF_ICONS), item.text).toContain(item.icon);
        expect(item.text.length).toBeGreaterThan(0);
        expect(item.text.length, item.text).toBeLessThanOrEqual(32); // a few words
        expect(item.text).not.toMatch(unfilled);
        if (item.tip) expect(fill(item.tip, vars), item.tip).not.toMatch(unfilled);
      }
    }
  });

  it('each world writes its own brief', () => {
    const texts = worlds.map((d) => JSON.stringify(d.text.design.brief.watch));
    expect(new Set(texts).size).toBe(worlds.length);
  });

  it('the header metrics fill: the pass mark on the Moon and Mars, the goal on Titan', () => {
    const [moon, mars, titan] = worlds;
    const h = moon!.text.design.header;
    expect(fill(h.passMarkFor, { world: moon!.text.dashboard.worldShort.mars })).toBe('to reach Mars');
    expect(fill(h.passMarkSentence, { minimum: '$780k', world: 'Mars' })).not.toMatch(unfilled);
    expect(fill(mars!.text.campaign!.passMark, { minimum: '$800k' })).not.toMatch(unfilled);
    expect(fill(titan!.text.design.header.goalValue, missionVars(titan!))).toBe(`Survive ${titan!.tuning.mission.lengthSeconds / 60} min`);
    expect(fill(titan!.text.campaign!.passMark, missionVars(titan!))).not.toMatch(unfilled);
  });
});
