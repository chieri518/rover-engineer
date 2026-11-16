// The spoiler guard (Moon sites and milestones plan, "Milestones and the relationship lessons"; game-design.md,
// "No lesson is spoiled"): no new player-facing text names a lesson before it happens. Each lesson has key
// words; none may appear in the texts Phase 5 added: site notices and instrument lines, the fourth lead, the
// station and X-ray HUD lines, the legend, desk cards, the debrief lines, the tutorial's station lines and the
// new milestones' filled how-to lines.
// Documented exceptions: the dark crater's own map name ("Permanently shadowed crater") names a place, not a
// lesson, and is removed before the check; "Earth light" (the reflector's light) is not "lights".
// Mars (Mars step 6d; mars-rover-engineering-implementation-plan.md, "Spoiler guard (Revised)"): the same for
// the Mars lessons, over every Mars desk, milestone, tutorial, site and HUD text (not the lessons' own texts in
// relationships.json, which show only once a lesson is met). See the Mars block below.
import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { buildSites, type SurveyFeatures } from '../rules/survey';
import { resolveSites } from '../rules/sites';
import { instrumentMilestones } from '../rules/milestoneLists';
import { requiredInstruments } from '../rules/rover';
import type { GameData, Instrument } from '../rules/types';
import terrain from '../../public/terrain/terrain.json';
import marsTerrain from '../../public/terrain/mars/terrain.json';
import { foundNotice } from './surveyText';
import { deskCardNotes, milestoneHowTo, milestoneSummary } from './milestoneText';
import { armNotes, needsText } from './supportText';
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

/** The drive tutorial's line for one station; fails loudly if the line is missing, so the guard never checks the wrong text. */
function stationLine(instrument: Instrument, start: RegExp): string {
  const lines = tutorialPages('drive', data, { mission: 'moon', instruments: [instrument] }).flatMap((p) => p.paragraphs).filter((s) => start.test(s));
  if (lines.length !== 1) throw new Error(`expected one drive tutorial line for ${instrument}, found ${lines.length}`);
  return lines[0]!;
}

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
    // The stations' tutorial lines: pick the paragraph that names the instrument (not the first drive paragraph).
    ['tutorial.drive.seismometer', stationLine('seismometer', /^Seismometer station/)],
    ['tutorial.drive.reflector', stationLine('reflector', /^Laser retroreflector/)],
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

// --- Mars ---
// The four Mars lessons (Mars plan M15) and what keeps each unspoken. No lights is a hard block, stated
// openly on the desk and in the review, so the guard does not apply to it, except that Night weather's text
// must not suggest lights. Each rule checks the texts it is about (tags); a lesson's own mission signal is
// exempt (the organics spectrometer's slope refusal is the arm lesson happening, not a hint of it; the X-ray's until November 16).

const mars = loadGameData('mars');

type Tag = Instrument | 'rtg' | 'arm' | 'milestone' | 'site' | 'night-weather';
interface MarsText { label: string; text: string; tags: Set<Tag> }

/** The arm lesson's words: a slope or level ground. */
const SLOPE = /\bslop(e|es|ed|ing)\b|\blevel\b|\bflat\b|\bsteep/i;
/** Words that tie a sentence to the arm or a contact reading. */
const ARM_CONTEXT = /\barm\b|contact|x-ray|organics|reading|\bread\b/i;
const sentences = (t: string) => t.split(/(?<=[.!?:])\s+/);

/** Each rule: the lesson, the texts it checks, and the words they may not hold. */
const MARS_RULES: { lesson: string; applies: (x: MarsText) => boolean; words: RegExp | ((t: string) => boolean) }[] = [
  // RTG noise: neutron texts never mention power or noise; the RTG's card never mentions neutrons or hydrogen.
  { lesson: 'RTG noise (neutron texts)', applies: (x) => x.tags.has('neutron'), words: /\bnois[ey]|\bgenerator|\bRTG\b|nuclear|radioisotope|plutonium|power source|\bsolar\b/i },
  { lesson: 'RTG noise (the RTG card)', applies: (x) => x.tags.has('rtg'), words: /neutron|hydrogen/i },
  { lesson: 'RTG noise (anywhere)', applies: () => true, words: /neutron noise|noisy (meter|reading)/i },
  // Dust on the panels: no text says dust settles on the panels or that they get cleaned (not even Spirit's
  // cleaning, kept for the notebook entry); dust storms and dust devils are events, not the lesson.
  { lesson: 'dust on the panels', applies: () => true, words: /\bclean(ing|ed|s)?\b(?! run)|less dust|dust(y)? (on|covering|coat\w*|settl\w*|build\w*|accumulat\w*)|\b(panels?|arrays?|cells?)\b[^.]*\bdust\b(?! storm| devil)|\bdust\b(?! storm| devil)[^.]*\b(panels?|arrays?)\b/i },
  // The arm on a slope: milestones, site notices and the arm, contact and laser texts never name slopes or
  // level ground; any other text only not in a sentence about the arm or a reading.
  { lesson: 'arm on a slope (milestones, sites, arm and reading instruments)', applies: (x) => ['milestone', 'site', 'arm', 'xray', 'organics', 'laser'].some((t) => x.tags.has(t as Tag)), words: SLOPE },
  { lesson: 'arm on a slope (other texts)', applies: () => true, words: (t) => sentences(t).some((s) => SLOPE.test(s) && ARM_CONTEXT.test(s)) },
  // The laser never compares itself with the arm (it is one of the arm lesson's answers).
  { lesson: 'arm on a slope (laser texts)', applies: (x) => x.tags.has('laser'), words: /\barm\b|touch|contact/i },
  // Night weather needs no lights (a rover can stay awake parked).
  { lesson: 'no lights (Night weather)', applies: (x) => x.tags.has('night-weather'), words: /\blights?\b/i },
];

/** Paths in the Mars text that are a lesson's own mission signal, not a hint of it. */
const SIGNALS = ['instrumentText.organics.slope'];
/**
 * Shared (Moon) text the Mars mission never shows: the Moon's stations, Earth, ice and shadow lines, and the
 * site notes, kind notes and site lines (Mars's own are checked as the notices the player sees, below).
 */
const MOON_ONLY = /earth|ice[A-Z]|Ice\b|drillIce|quake|seismometer|reflector|station|deploy|fastShadow|viewpoint|flare|impact|^survey\.(siteNotes|siteKindNotes|siteLines)\./i;

/** Every string in a text subtree with its path, skipping "_" notes. */
function strings(node: unknown, path: string): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${path}.${i}`));
  if (node && typeof node === 'object') {
    return Object.entries(node).filter(([k]) => !k.startsWith('_')).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** Tags for a text path: the instruments, parts and lessons its words are about. */
function pathTags(path: string): Set<Tag> {
  const tags = new Set<Tag>();
  for (const i of ['camera', 'drill', 'xray', 'weather', 'radar', 'laser', 'organics'] as const) if (path.toLowerCase().includes(i)) tags.add(i);
  if (/neutron|hydrogen/i.test(path)) tags.add('neutron');
  if (path.startsWith('survey.')) tags.add('site');
  return tags;
}

function marsTexts(d: GameData): MarsText[] {
  const out: MarsText[] = [];
  const add = (label: string, text: string, tags: Iterable<Tag> = []) => out.push({ label, text, tags: new Set(tags) });
  const instruments = d.parts.parts.flatMap((p) => (p.slot === 'instrument' && p.effects.instrument ? [p.effects.instrument] : []));
  // The desk: every part card as Mars shows it (name, description, what an instrument can earn and where, its needs,
  // what the arm adds to the X-ray).
  for (const p of d.parts.parts) {
    const inst = p.effects.instrument;
    const lines = [p.name, p.description, ...(inst ? deskCardNotes(inst, d) : []), needsText(p.effects.needs ?? [], d) ?? '', ...armNotes(p, d)];
    const tags: Tag[] = [...(inst ? [inst] : []), ...(p.effects.neutronNoise ? ['rtg' as const] : []), ...(p.slot === 'arm' ? ['arm' as const] : [])];
    add(`desk ${p.id}`, lines.join(' '), tags);
  }
  // Every Mars milestone as the player sees it: name, summary, fact, filled how-to line.
  for (const m of d.milestones.milestones) {
    const text = [m.name, milestoneSummary(m), m.fact, milestoneHowTo(m, d) ?? ''].join(' ');
    add(`milestone ${m.id}`, text, ['milestone', ...requiredInstruments(m), ...(m.id === 'night-weather' ? ['night-weather' as const] : [])]);
  }
  // The tutorial with every Mars instrument aboard.
  for (const id of ['design', 'drive'] as const) {
    for (const page of tutorialPages(id, d, { mission: 'mars', instruments, balance: 900 })) {
      for (const [i, para] of [page.title, ...page.paragraphs].entries()) add(`tutorial ${id} ${page.title} ${i}`, para);
    }
  }
  // Desk, mission, HUD, site and instrument texts, by path (each labelled with it).
  for (const key of ['design', 'support', 'nightBudget', 'landing', 'mission', 'hud', 'warnings', 'sol', 'night', 'storm', 'survey', 'instrumentText', 'instruments'] as const) {
    for (const [path, text] of strings((d.text as unknown as Record<string, unknown>)[key], key)) {
      const lead = /^survey\.leads\.(\w+)\./.exec(path)?.[1];
      if (lead && !(d.tuning.survey?.leads ?? []).some((l) => l.id === lead)) continue; // a lead Mars does not use
      if (!SIGNALS.includes(path) && !MOON_ONLY.test(path)) add(path, text, pathTags(path));
    }
  }
  // Every Mars site notice as the player sees it, with every Mars instrument aboard.
  const f = marsTerrain.features as unknown as SurveyFeatures;
  for (const site of buildSites(f, d.tuning.milestones, d.text.survey.shadowedCraterName, resolveSites(d.sites.sites, f as never))) {
    add(`notice ${site.name}`, foundNotice(site, instruments, d).join(' '), ['site']);
  }
  return out;
}

describe('spoiler guard, Mars: no Mars text names a Mars lesson before it happens', () => {
  const texts = marsTexts(mars);

  it('collects the Mars desk, milestone, tutorial, site and HUD texts', () => {
    const labels = texts.map((x) => x.label);
    for (const id of ['desk power-rtg', 'desk arm-robotic', 'desk instrument-neutron', 'desk instrument-laser', 'milestone hydrated-ground', 'milestone remote-reading', 'milestone night-weather', 'milestone dust-devil']) {
      expect(labels, id).toContain(id);
    }
    expect(labels.some((l) => l.startsWith('tutorial drive'))).toBe(true);
    expect(labels.some((l) => l.startsWith('notice '))).toBe(true);
    expect(labels.some((l) => l.startsWith('instrumentText.organics'))).toBe(true);
    expect(texts.find((x) => x.label === 'desk instrument-xray')!.text).toContain('Can earn: Rock collection');
    expect(texts.find((x) => x.label === 'desk instrument-xray')!.text).toContain('With the robotic arm');
    expect(texts.find((x) => x.label === 'desk arm-robotic')!.text).toContain('X-ray and organics');
    expect(texts.some((x) => x.label === 'instrumentText.xray.slope')).toBe(false); // the X-ray has no slope refusal any more
    for (const key of ['support.xrayWithArm', 'support.armAdds', 'support.groundDown', 'support.groundDownReward']) expect(texts.map((x) => x.label), key).toContain(key);
    for (const x of texts) expect(x.text.length, x.label).toBeGreaterThan(0);
  });

  it.each(MARS_RULES.map((r) => [r.lesson, r] as const))('no Mars text hints at "%s"', (_lesson, rule) => {
    for (const x of texts.filter(rule.applies)) {
      const hit = typeof rule.words === 'function' ? rule.words(x.text) : rule.words.test(x.text);
      expect(hit, `${x.label}: ${x.text}`).toBe(false);
    }
  });

  it('the Mars guard catches texts that would spoil a lesson', () => {
    const fake = (text: string, tags: Tag[] = []): MarsText => ({ label: 'fake', text, tags: new Set(tags) });
    const caught = (x: MarsText) => MARS_RULES.some((r) => r.applies(x) && (typeof r.words === 'function' ? r.words(x.text) : r.words.test(x.text)));
    expect(caught(fake('The meter is steadier on solar power.', ['neutron']))).toBe(true);
    expect(caught(fake('Its heat also raises the neutron count.', ['rtg']))).toBe(true);
    expect(caught(fake('Spirit was saved when wind cleaned its solar panels.'))).toBe(true);
    expect(caught(fake('Dust settles on the arrays over the sols.'))).toBe(true);
    expect(caught(fake('Park on level ground before a reading.'))).toBe(true);
    expect(caught(fake('Read boulders on the crater rim.', ['milestone', 'xray']))).toBe(false);
    expect(caught(fake('Drive slowly on a steep slope.'))).toBe(false); // driving, not the arm
    expect(caught(fake('Reads a rock without the arm touching it.', ['laser']))).toBe(true);
    expect(caught(fake('Keep the lights on through the night.', ['night-weather']))).toBe(true);
    expect(caught(fake('Fixed solar panel. Nothing at night, less in a dust storm.'))).toBe(false);
    expect(caught(fake('Clean run'))).toBe(false);
  });
});
