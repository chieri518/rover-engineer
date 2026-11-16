// The spoiler guard (Moon sites and milestones plan, "Milestones and the relationship lessons"; game-design.md,
// "No lesson is spoiled"): no new player-facing text names a lesson before it happens. Each lesson has key
// words; none may appear in the texts Phase 5 added: site notices and instrument lines, the fourth lead, the
// station and X-ray HUD lines, the legend, desk cards, the debrief lines, the tutorial's station lines and the
// new milestones' filled how-to lines.
// Documented exceptions: the dark crater's own map name ("Permanently shadowed crater") names a place, not a
// lesson, and is removed before the check; "Earth light" (the reflector's light) is not "lights".
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { buildSites, type SurveyFeatures } from '../rules/survey';
import { resolveSites } from '../rules/sites';
import { instrumentMilestones } from '../rules/milestoneLists';
import type { Instrument } from '../rules/types';
import terrain from '../../public/terrain/terrain.json';
import { foundNotice } from './surveyText';
import { milestoneHowTo } from './milestoneText';
import { tutorialPages } from './tutorialText';

const data = loadGameData();
const { text } = data;

/** Each lesson's key words (seismometer: quiet ground; cold: heater; X-ray: shadow; no lights: lights). */
const KEY_WORDS: [lesson: string, word: RegExp][] = [
  ['seismometer needs quiet ground', /\bquiet/i],
  ['seismometer needs quiet ground', /drive away|drive off|far from/i],
  ['instruments need the heater in the cold', /\bheater/i],
  ['instruments need the heater in the cold', /temperature/i],
  ['a colder X-ray detector reads faster', /shadow|shade\b/i],
  ['no lights, no permanent shadow', /\blights?\b/i],
  ['neutron finds, drill confirms', /drill where|confirm (it|the ice)/i],
];

const ALL: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];
const NEW_MILESTONES = [
  'cold-trap-survey', 'hidden-hydrogen', 'ice-deposit-located', 'rock-collection', 'rare-rock', 'boulder-track',
  'documented-sample', 'fresh-ejecta-sample', 'moonquake-record', 'clean-seismogram', 'laser-ranging-site', 'science-station',
];

/** Every player-facing text Phase 5 added, labelled. */
function newTexts(): [string, string][] {
  const s = text.survey;
  const out: [string, string][] = [
    ['survey.leads.youngCrater', `${s.leads.youngCrater!.name} ${s.leads.youngCrater!.source}`],
    ['survey.siteLineDocumented', s.siteLineDocumented],
    ...Object.entries(s.siteNotes).map(([k, v]): [string, string] => [`survey.siteNotes.${k}`, v]),
    ...Object.entries(s.siteKindNotes).map(([k, v]): [string, string] => [`survey.siteKindNotes.${k}`, v!]),
    ...Object.entries(s.siteLines).flatMap(([k, lines]) => Object.entries(lines!).map(([i, v]): [string, string] => [`survey.siteLines.${k}.${i}`, v!])),
    ...(['legendYoungCrater', 'legendColdTrap', 'legendRolledBoulder', 'legendHydrogen', 'legendDone'] as const).map((k): [string, string] => [`hud.${k}`, text.hud[k]]),
    ...(['earthInViewTooClose', 'stationTooCloseHint', 'stationConfirm', 'stationPlacedTooClose', 'xrayNewType'] as const)
      .map((k): [string, string] => [`instruments.${k}`, text.instruments[k]]),
    ...(['instrumentMilestones'] as const).map((k): [string, string] => [`design.${k}`, text.design[k]]),
    ...(['logNote', 'logRockTypes', 'logEarned', 'stagedCount', 'groupRover', 'groupCombo', 'notReachedHeading', 'notReachedNote'] as const)
      .map((k): [string, string] => [`debrief.${k}`, text.debrief[k]]),
    ['tutorial.drive.seismometer', tutorialPages('drive', data, { mission: 'moon', instruments: ['seismometer'] }).flatMap((p) => p.paragraphs)[0]!],
    ['tutorial.drive.reflector', tutorialPages('drive', data, { mission: 'moon', instruments: ['reflector'] }).flatMap((p) => p.paragraphs)[0]!],
  ];
  // The desk cards: the milestone names each instrument lists.
  for (const i of ALL) out.push([`desk card ${i}`, instrumentMilestones(i, data.milestones.milestones).map((m) => m.name).join(', ')]);
  // The new milestones' filled how-to lines (rules/data.test.ts checks their names and summaries too).
  for (const id of NEW_MILESTONES) {
    const m = data.milestones.milestones.find((x) => x.id === id)!;
    out.push([`howTo ${id}`, milestoneHowTo(m, data) ?? '']);
  }
  // Every site notice as the player sees it, with every instrument aboard.
  const sites = buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, text.survey.shadowedCraterName, resolveSites(data.sites.sites, terrain.features as never));
  for (const site of sites) out.push([`notice ${site.name}`, foundNotice(site, ALL, data).join(' ')]);
  return out;
}

describe('spoiler guard: new player-facing texts name no lesson', () => {
  const crater = text.survey.shadowedCraterName;
  const texts = newTexts();

  it('collects the new texts', () => {
    expect(texts.length).toBeGreaterThan(40);
    for (const [label, t] of texts) expect(t.length, label).toBeGreaterThan(0);
  });

  it.each(KEY_WORDS)('no new text hints at "%s" (%s)', (_lesson, word) => {
    for (const [label, t] of texts) {
      const checked = t.replaceAll(new RegExp(crater, 'gi'), '').replaceAll(/Earth light/g, '');
      expect(checked, label).not.toMatch(word);
    }
  });

  it('the guard catches a text that would spoil a lesson', () => {
    expect('Drive away from the station so the record stays quiet.').toMatch(KEY_WORDS[0]![1]);
    expect('Bring lights to enter.').toMatch(KEY_WORDS[5]![1]);
    expect('Readings finish faster in the shadow.').toMatch(KEY_WORDS[4]![1]);
  });
});
