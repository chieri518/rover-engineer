// Screens: title, settings, landing, debrief and Campaign complete (after the last mission, with the
// campaign summary). The design, ticket and mission screens have their own files.
import { milestoneStages, type EarnedMilestone } from '../rules/payout';
import type { AlbumPhoto, Screen, ScreenId } from '../flow/flow';
import type { Build, BusSlot, GameData, HistoryKey, Instrument, Milestone } from '../rules/types';
import type { TitanCampaignText } from '../rules/titanTypes';
import { earnedWith, groupMilestones, notReached, rockTypeTally, stagesEarned, type MilestoneGroupKey } from '../rules/milestoneLists';
import { instrumentsOf } from '../rules/payload';
import { isCompleteBuild, selectedParts } from '../rules/rover';
import { taughtLessons, type RelationshipEvent } from '../rules/relationships';
import type { InstrumentLog } from '../rules/instruments';
import { categoryLabel, causeText, milestoneSummary } from './milestoneText';
import { el, fill, money, panel } from './dom';
import { gameDaysElapsed } from '../rules/sun';
import { azimuthDeg, buildLeads, buildSites, compassPoint } from '../rules/survey';
import { resolveSites, type SiteFeatures } from '../rules/sites';
import { isPlayable, nextMission } from '../rules/campaign';
import { briefingLines, kmText } from './surveyText';
import { missionVars } from './tutorialText';
import { creditsScreen } from './creditsScreen';
import { filmScreen } from './filmScreen';
import { introScreen } from './introScreen';
import { renderDashboard } from './dashboard';
import { designScreen } from './designScreen';
import { missionScreen } from './missionScreen';
import { ticketScreen } from './ticketScreen';
import { sound } from '../audio';

const title: Screen = (game, root) => {
  const t = game.data.text.title;
  // Live 3D cover behind the title (loaded on demand, with three.js); a CSS star field shows until it
  // is ready and stays if WebGL is unavailable. The buttons never depend on it.
  const cover = el('div', { class: 'title-cover', 'aria-hidden': 'true' });
  let stopCover: (() => void) | null = null;
  let left = false;
  const campaign = game.campaign;
  void import('./titleCover')
    .then(({ mountTitleCover }) => {
      if (!left) stopCover = mountTitleCover(cover, game.data.tuning.rover);
    })
    .catch(() => cover.classList.add('fallback'));
  root.append(
    cover,
    el('div', { class: 'title-scrim', 'aria-hidden': 'true' }),
    el('section', { class: 'panel title-panel' },
      el('p', { class: 'title-kicker' }, t.kicker),
      el('h1', {}, t.heading),
      el('p', { class: 'title-subtitle' }, t.subtitle),
      el('div', { class: 'actions column' },
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, t.newCampaign),
        campaign && el('button', { onclick: () => game.continueCampaign() }, t.continueCampaign),
        el('button', { onclick: () => game.go('settings') }, game.data.text.settings.open),
        el('button', { id: 'open-credits', onclick: () => game.go('credits') }, game.data.text.credits.open),
      ),
    ),
  );
  return () => {
    left = true;
    stopCover?.();
  };
};

const landing: Screen = (game, root) => {
  const { data } = game;
  const t = data.text.landing;
  const s = data.text.survey;
  const mars = data.text.campaign; // after the Moon (Mars, Titan): what is new on this world
  const titan = data.text.titanCampaign; // Titan only: a few facts, the distance to Selk
  const vars = missionVars(data);
  // Orbital survey leads: a rough bearing and distance from the lander to each area of interest. The
  // terrain features load here (and stay cached for the mission).
  const leadsHeading = el('h3', {}, s.heading);
  const leadsIntro = el('p', {}, s.intro);
  const leads = el('ul', { class: 'survey-leads' }, el('li', { class: 'muted' }, s.loading));
  const landmark = el('p', { hidden: true });
  void import('../world/terrainMasks')
    .then(async ({ loadTerrainMasks }) => {
      const masks = await loadTerrainMasks(data.tuning, game.world, data.sites.sites);
      const placed = resolveSites(data.sites.sites, masks.info.features as SiteFeatures); // the Moon's sites.json sites (none on Mars)
      const sites = buildSites(masks.info.features, data.tuning.milestones, s.shadowedCraterName, placed);
      const lines = briefingLines(buildLeads(sites, data.tuning.survey), masks.info.landing.local, data);
      leads.replaceChildren(...lines.map((l) => el('li', {}, l)));
      if (lines.length === 0) for (const n of [leadsHeading, leadsIntro, leads]) n.remove(); // no leads for this world yet
      // Mars: how far Perseverance's 2021 landing site is from the lander.
      const percy = (masks.info.features as { perseveranceLanding?: { local: { x: number; z: number } } }).perseveranceLanding;
      if (mars && percy) {
        const from = masks.info.landing.local;
        const km = Math.hypot(percy.local.x - from.x, percy.local.z - from.z) / 1000;
        landmark.textContent = fill(mars.perseverance, {
          distance: kmText(km),
          direction: s.compass[compassPoint(azimuthDeg(from, percy.local))] ?? '',
        });
        landmark.hidden = false;
      }
      // Titan: how far Selk crater's center is from the lander (a landmark beyond the haze).
      const selk = (masks.info.features as { selk?: { centerLocal: { x: number; z: number } } }).selk;
      if (titan && selk) {
        const from = masks.info.landing.local;
        const km = Math.hypot(selk.centerLocal.x - from.x, selk.centerLocal.z - from.z) / 1000;
        landmark.textContent = fill(titan.selk, {
          distance: Math.round(km),
          direction: s.compass[compassPoint(azimuthDeg(from, selk.centerLocal))] ?? '',
        });
        landmark.hidden = false;
      }
    })
    .catch(() => leads.remove());
  root.append(
    panel(
      el('p', { class: 'title-kicker' }, data.text.story.kicker),
      el('h2', {}, t.heading),
      el('p', {}, t.briefing),
      el('p', {}, fill(data.text.mission.briefing, vars)),
      titan && el('h3', {}, titan.factsHeading),
      titan && el('ul', { class: 'new-on-world' }, ...titan.facts.map((line) => el('li', {}, line))),
      landmark,
      mars && el('h3', {}, mars.newHeading),
      mars && el('ul', { class: 'new-on-world' }, ...mars.newOnMars.map((line) => el('li', {}, fill(line, vars)))),
      leadsHeading,
      leadsIntro,
      leads,
      mars && el('p', { class: 'note' }, mars.sources),
      el('div', { class: 'actions' }, el('button', { class: 'primary', onclick: () => game.go('mission') }, 'Begin mission')),
    ),
  );
};

/** A volume slider (0..100 %) for a 0..1 setting; `onCommit` runs when the player lets go. */
function volumeSlider(id: string, label: string, value: number, onInput: (v: number) => void, onCommit?: () => void): HTMLElement {
  const shown = el('output', { for: id, class: 'volume-value' }, `${Math.round(value * 100)}%`);
  const input = el('input', {
    type: 'range', id, min: 0, max: 100, step: 1, value: Math.round(value * 100),
    oninput: () => {
      shown.textContent = `${input.value}%`;
      onInput(Number(input.value) / 100);
    },
    onchange: () => onCommit?.(),
  });
  return el('div', { class: 'setting volume' }, el('label', { for: id }, label), input, shown);
}

const settings: Screen = (game, root) => {
  const t = game.data.text.settings;
  const box = el('input', {
    type: 'checkbox',
    id: 'setting-history',
    checked: game.settings.missionHistory,
    onchange: () => game.setSettings({ missionHistory: box.checked }),
  });
  const mute = el('input', {
    type: 'checkbox',
    id: 'setting-muted',
    checked: game.settings.muted,
    onchange: () => game.setSettings({ muted: mute.checked }),
  });
  const stop = game.listen({ settings: (st) => void (mute.checked = st.muted) }); // the M key mutes too
  root.append(
    panel(
      el('h2', {}, t.heading),
      el('div', { class: 'setting' },
        box,
        el('label', { for: 'setting-history' }, t.history),
        el('p', { class: 'muted' }, t.historyHelp),
      ),
      volumeSlider('setting-music', t.music, game.settings.musicVolume, (v) => game.setSettings({ musicVolume: v })),
      // Letting go of the effects slider plays a cue at the new level.
      volumeSlider('setting-effects', t.effects, game.settings.effectsVolume, (v) => game.setSettings({ effectsVolume: v }), () => sound.cue('discover')),
      el('div', { class: 'setting' },
        mute,
        el('label', { for: 'setting-muted' }, t.muted),
        el('p', { class: 'muted' }, t.soundHelp),
      ),
      el('div', { class: 'actions' }, el('button', { class: 'primary', onclick: () => game.go('title') }, t.back)),
    ),
  );
  return stop;
};

function row(label: string, value: string, cls = ''): HTMLElement {
  return el('div', { class: `row ${cls}` }, el('span', { class: 'label' }, label), el('span', { class: 'value' }, value));
}

/** Click a photo to see it full size; click again to close. */
function albumView(photos: AlbumPhoto[]): HTMLElement {
  return el('div', { class: 'album' },
    ...photos.map((p) => el('figure', {},
      el('img', {
        src: p.src,
        alt: p.caption,
        onclick: () => {
          const view = el('figure', { class: 'album-view', onclick: () => view.remove() },
            el('div', {}, el('img', { src: p.src, alt: p.caption }), el('figcaption', {}, p.caption)));
          document.body.append(view);
        },
      }),
      el('figcaption', {}, p.caption),
    )),
  );
}

/**
 * The debrief's instrument log: one line per carried new instrument (an X-ray line per rock read), with
 * plain wording when unused. The X-ray adds the rock types read out of all the suites' types (when the
 * world has a rock-collection milestone and a rock was read), and each instrument's last line names the
 * milestones earned that need it ("Earned: ...").
 */
function instrumentLogLines(log: InstrumentLog | null, data: GameData, earned: readonly EarnedMilestone[]): string[] {
  if (!log) return [];
  const { text } = data;
  const t = text.debrief;
  const has = (i: Instrument) => log.carried.includes(i);
  const lines: string[] = [];
  // One group of lines per carried new instrument; nothing for instruments not carried.
  const add = (inst: Instrument, own: string[]) => {
    const names = earnedWith(inst, data.milestones.milestones, earned).map((m) => m.name);
    if (names.length > 0 && own.length > 0) own[own.length - 1] += ` ${fill(t.logEarned, { names: names.join(t.logEarnedJoin) })}`;
    lines.push(...own);
  };
  if (has('neutron')) {
    add('neutron', [log.hydrogenPeak === null ? t.logHydrogenNone : fill(t.logHydrogen, { percent: Math.round(log.hydrogenPeak * 100) })]);
  }
  if (has('xray')) {
    const own = log.rocks.length === 0 ? [t.logNoRocks] : log.rocks.map((r) => {
      const rock = text.rocks[r.rock];
      return fill(t.logRock, { rock: rock?.name ?? r.rock, elements: rock?.elements ?? '' });
    });
    const tally = rockTypeTally(log.rocks, data.tuning.instruments.xray);
    const collection = data.milestones.milestones.some((m) => m.trigger.type === 'reading' && m.trigger.rocks);
    if (collection && tally.count > 0 && tally.total > 0) own.push(fill(t.logRockTypes, tally));
    add('xray', own);
  }
  if (has('seismometer')) {
    add('seismometer', [!log.stationPlaced ? t.logStationNone : log.quake === 'clean' ? t.logQuakeClean : log.quake === 'noisy' ? t.logQuakeNoisy : log.quake === 'missed' ? t.logQuakeMissed : t.logQuakeNone]);
  }
  if (has('reflector')) add('reflector', [log.reflectorPlaced ? t.logReflector : t.logReflectorNone]);
  return lines;
}

/** A debrief group's heading: "The rover", the instrument's part name, or "Instruments together". */
function groupHeading(key: MilestoneGroupKey, data: GameData): string {
  const t = data.text.debrief;
  if (key.kind === 'rover') return t.groupRover;
  if (key.kind === 'combo') return t.groupCombo;
  return data.parts.parts.find((p) => p.slot === 'instrument' && p.effects.instrument === key.instrument)?.name ?? key.instrument;
}

/**
 * "What the rover taught us": each relationship met this mission, in the order met, with what happened
 * and why, and the ways to solve it; the real mission behind it only with Mission history on
 * (rules: taughtLessons).
 */
function taughtItems(met: readonly RelationshipEvent[] | undefined, data: GameData, history: boolean): HTMLElement[] {
  const t = data.text.debrief;
  return taughtLessons(met, data.relationships, history).map((l) => el('li', { 'data-relationship': l.id },
    el('strong', {}, l.name),
    el('p', {}, l.debrief),
    el('p', { class: 'sub' }, t.taughtAnswers),
    el('ul', { class: 'answers' }, ...l.answers.map((a) => el('li', {}, a))),
    l.fact && el('p', { class: 'sub fact' }, l.fact),
    l.source && el('p', { class: 'note' }, fill(t.taughtSource, { source: l.source })),
  ));
}

const debrief: Screen = (game, root) => {
  const { data } = game;
  const { text } = data;
  const t = text.debrief;
  const outcome = game.outcome;
  const result = game.lastResult;
  if (!outcome || !result) return void game.go('title');
  const { payout, failed, state } = outcome;
  const history = game.settings.missionHistory;
  // Titan replaces the per-outcome rover history with the Dragonfly comparison (always shown).
  const roverHistory = history && !text.titanCampaign;
  // The pass mark: the minimum budget of the mission after the one just played. The last mission
  // (Titan) passes on survival instead: a lost rover shows when and how, and offers a retry or the end.
  const next = nextMission(game.world);
  const last = !next || !isPlayable(next);
  const minimum = { ...missionVars(data), minimum: next && isPlayable(next) ? money(data.tuning.budget.minimumBudget[next], text) : '' };
  const lostAt = last && !result.survived && t.lostAt
    ? fill(t.lostAt, { time: clockText(result.secondsLasted), total: clockText(data.tuning.mission.lengthSeconds), cause: causeText(result, text) })
    : null;
  const historyKey: HistoryKey = result.survived ? 'survived' : result.detail === 'rollover' ? 'rollover' : (result.cause ?? 'energy');
  const days = result.survived ? data.tuning.mission.gameDays : gameDaysElapsed(result.secondsLasted, data.tuning.mission).toFixed(1);

  const logLines = instrumentLogLines(game.instrumentLog, data, result.earned);
  const taught = taughtItems(result.relationships, data, history);

  // The rover as launched (the mission flies game.build) and the records held before this mission.
  const launchParts = isCompleteBuild(game.build, data.parts) ? selectedParts(game.build, data.parts) : [];
  const bay = launchParts.length ? instrumentsOf(launchParts) : (game.instrumentLog?.carried ?? []);
  const recordsHeldAtLaunch = state.records.filter((id) => !payout.newRecords.includes(id));

  // Milestones grouped by instrument (rules: groupMilestones), catalog order within a group; a staged
  // milestone is one line with its count; records already held this campaign are listed without a reward.
  const item = (m: Milestone) => {
    const paid = payout.milestones.find((p) => p.milestone.id === m.id);
    const maxStages = milestoneStages(m);
    const stages = Math.min(stagesEarned(result.earned, m.id), maxStages);
    return el('li', {},
      el('span', {}, el('strong', {}, maxStages > 1 ? fill(t.stagedCount, { name: m.name, stages, max: maxStages }) : m.name), ` · ${categoryLabel(m.category, text)}`),
      paid
        ? el('span', { class: 'reward' }, fill(text.milestone.reward, { money: money(paid.money, text), rp: paid.rp }))
        : el('span', { class: 'reward none' }, t.recordHeld),
      el('span', { class: 'sub' }, milestoneSummary(m, stages)),
      history && el('span', { class: 'sub fact' }, m.fact),
    );
  };
  const earnedList = data.milestones.milestones.filter((m) => stagesEarned(result.earned, m.id) > 0);
  const groups = groupMilestones(earnedList, bay).flatMap((g) => [
    el('h4', { class: 'debrief-group' }, groupHeading(g.key, data)),
    el('ul', { class: 'debrief-milestones' }, ...g.milestones.map(item)),
  ]);
  // "Not reached": names only (game-design.md M11).
  const missed = notReached(data.milestones.milestones, launchParts, result.earned, recordsHeldAtLaunch, bay);

  root.append(
    el('section', { class: 'panel debrief' },
      el('h2', {}, t.heading),
      el('p', { class: `outcome${result.survived ? '' : ' failed'}` },
        lostAt ?? (result.survived ? (last && t.survivedTitan ? fill(t.survivedTitan, minimum) : t.survived) : fill(t.cause, { cause: causeText(result, text) }))),
      el('p', { class: 'muted' }, fill(text.hud.lasted, { days, total: data.tuning.mission.gameDays })),

      el('h3', {}, t.milestonesHeading),
      groups.length ? el('div', { class: 'debrief-groups' }, ...groups) : el('p', { class: 'muted' }, t.noMilestones),

      missed.length > 0 && el('h3', {}, t.notReachedHeading),
      missed.length > 0 && el('p', { class: 'muted' }, t.notReachedNote),
      missed.length > 0 && el('ul', { class: 'debrief-not-reached' }, ...missed.map((m) => el('li', {}, m.name))),

      el('h3', {}, t.payoutHeading),
      el('div', { class: 'ledger' },
        row(t.survivalPayout, money(payout.survivalPayout, text)),
        row(t.milestoneMoney, money(payout.milestoneMoney, text)),
        row(result.survived ? t.penalty : `${t.penalty} (${causeText(result, text)})`, money(-payout.penalty, text), payout.penalty > 0 ? 'bad' : ''),
        row(t.net, money(payout.money, text), 'total'),
        row(t.rpEarned, String(payout.rp)),
        row(t.balance, money(state.balance, text), 'total'),
      ),

      logLines.length > 0 && el('h3', {}, t.logHeading),
      logLines.length > 0 && el('ul', { class: 'debrief-log' }, ...logLines.map((l) => el('li', {}, l))),
      logLines.length > 0 && el('p', { class: 'note' }, t.logNote),

      taught.length > 0 && el('h3', {}, t.taughtHeading),
      taught.length > 0 && el('p', { class: 'muted' }, t.taughtNote),
      taught.length > 0 && el('ul', { class: 'debrief-taught' }, ...taught),

      el('h3', {}, t.albumHeading),
      game.album.length ? albumView(game.album) : el('p', { class: 'muted' }, t.noPhotos),

      text.titanCampaign && dragonflyView(text.titanCampaign, game.state.lastBuild, data),

      roverHistory && el('h3', {}, t.historyHeading),
      roverHistory && el('div', { class: 'history' },
        el('p', {}, text.history[historyKey]),
        el('p', { class: 'note' }, `Source: ${text.historySources[historyKey]}`),
      ),

      el('p', { class: failed ? 'outcome failed' : 'outcome' }, fill(failed ? t.failedRound : t.passedRound, minimum)),
      (failed ? t.storyFailed : t.storyPassed) && el('p', { class: 'story-beat' }, failed ? t.storyFailed : t.storyPassed),
      el('div', { class: 'actions' },
        failed
          ? el('button', { class: 'primary', onclick: () => game.restartRound() }, t.restart)
          : el('button', { class: 'primary', onclick: () => game.continueCampaign() }, t.continue),
        failed && last && t.endCampaign && el('button', { onclick: () => game.endCampaign() }, t.endCampaign),
      ),
    ),
  );
};

/**
 * Titan: the real mission flies. Dragonfly compared with the rover just flown, and the lesson that the
 * right vehicle depends on the world. Shown whatever the mission history setting: it is the Titan lesson.
 */
function dragonflyView(t: TitanCampaignText, build: Build | null, data: GameData): HTMLElement {
  const part = (slot: BusSlot) => data.parts.parts.find((p) => p.id === build?.[slot]);
  const vars = {
    wheels: part('wheels')?.name ?? '',
    battery: part('battery')?.name ?? '',
    capacity: part('battery')?.effects.batteryCapacity ?? 0,
    heater: part('heater')?.name ?? '',
    lights: part('lights')?.name ?? '',
  };
  return el('section', { class: 'dragonfly' },
    el('h3', {}, t.dragonflyHeading),
    ...t.dragonfly.map((p) => el('p', {}, p)),
    el('table', { class: 'tiers dragonfly-compare' },
      el('thead', {}, el('tr', {},
        el('td', {}),
        el('th', { scope: 'col' }, t.colRover),
        el('th', { scope: 'col' }, t.colDragonfly))),
      el('tbody', {}, ...t.compare.map((r) => el('tr', {},
        el('th', { scope: 'row' }, r.label),
        el('td', {}, fill(r.rover, vars)),
        el('td', {}, r.dragonfly))))),
    el('p', { class: 'outcome' }, t.lesson),
    el('p', { class: 'note' }, t.dragonflySource),
  );
}

/** Mission time as m:ss (Titan: when the rover was lost, out of the mission length). */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Campaign complete (the 'complete' end marker): the campaign dashboard (dashboard.ts). */
const complete: Screen = (game, root) => renderDashboard(game, root);

export const screens: Record<ScreenId, Screen> = {
  title,
  settings,
  credits: creditsScreen,
  film: filmScreen,
  intro: introScreen,
  design: designScreen,
  ticket: ticketScreen,
  landing,
  mission: missionScreen,
  debrief,
  complete,
};
