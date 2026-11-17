// Screens: title, settings, landing, debrief and Campaign complete (after the last mission, with the
// campaign summary). The design, ticket and mission screens have their own files.
import { milestoneStages } from '../rules/payout';
import type { AlbumPhoto, Screen, ScreenId } from '../flow/flow';
import type { Build, BusSlot, GameData, HistoryKey, Milestone } from '../rules/types';
import type { TitanCampaignText } from '../rules/titanTypes';
import { groupMilestones, notReached, stagesEarned } from '../rules/milestoneLists';
import { instrumentsOf } from '../rules/payload';
import { completeBuild, providesCapability, selectedParts } from '../rules/rover';
import { taughtLessons, type TaughtLesson } from '../rules/relationships';
import { categoryLabel, causeText, milestoneSummary, notReachedLine, rewardText } from './milestoneText';
import { el, fill, money, panel } from './dom';
import {
  debriefBadge, debriefTabs, groupHeading, instrumentLogGroups, lessonIsNew, overviewTiles, payoutRows,
  type DebriefTab, type DebriefTabId, type LogGroup, type Tone,
} from './debriefText';
import { gameDaysElapsed } from '../rules/sun';
import { azimuthDeg, compassPoint } from '../rules/survey';
import { isPlayable, nextMission } from '../rules/campaign';
import { kmText } from './surveyText';
import { missionVars } from './tutorialText';
import { creditsScreen } from './creditsScreen';
import { filmScreen } from './filmScreen';
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
  // Mars and Titan: a landmark's distance and direction from the lander. The terrain features load here
  // (and stay cached for the mission). The orbital survey leads are not listed here; the mission shows them.
  const landmark = el('p', { hidden: true });
  void import('../world/terrainMasks')
    .then(async ({ loadTerrainMasks }) => {
      const masks = await loadTerrainMasks(data.tuning, game.world, data.sites.sites);
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
    .catch(() => {}); // no landmark line without the terrain features
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
 * "What the rover taught us": each relationship met this mission, in the order met, with what happened
 * and why, and the ways to solve it; the real mission behind it only with Mission history on
 * (rules: taughtLessons). A lesson not in the notebook at launch is marked new.
 */
function taughtItems(lessons: readonly TaughtLesson[], data: GameData, isNew: (id: string) => boolean): HTMLElement[] {
  const t = data.text.debrief;
  return lessons.map((l) => el('li', { 'data-relationship': l.id },
    el('p', { class: 'lesson-name' }, el('strong', {}, l.name), isNew(l.id) && el('span', { class: 'debrief-new' }, t.lessonNew)),
    el('p', {}, l.debrief),
    el('p', { class: 'sub' }, t.taughtAnswers),
    el('ul', { class: 'answers' }, ...l.answers.map((a) => el('li', {}, a))),
    l.fact && el('p', { class: 'sub fact' }, l.fact),
    l.source && el('p', { class: 'note' }, fill(t.taughtSource, { source: l.source })),
  ));
}

/** The instrument log: one heading per carried instrument, its lines as a list, then its summary and "Earned: ...". */
function logView(groups: readonly LogGroup[]): HTMLElement {
  return el('div', { class: 'debrief-log' },
    ...groups.map((g) => el('section', { class: 'debrief-log-group', 'data-instrument': g.instrument },
      el('h4', { class: 'debrief-group' }, g.heading),
      el('ul', {}, ...g.lines.map((l) => el('li', {}, l))),
      g.summary && el('p', { class: 'debrief-log-summary' }, g.summary),
      g.earned && el('p', { class: 'debrief-log-earned' }, g.earned),
    )),
  );
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern, automatic activation): a tablist of buttons over one panel each.
 * Left and Right move between tabs (wrapping), Home and End jump; only the selected tab takes Tab (roving
 * tabindex), then focus goes into its panel.
 */
function debriefTabsView(tabs: readonly DebriefTab[], panels: ReadonlyMap<DebriefTabId, Node[]>, label: string): HTMLElement[] {
  const buttons = tabs.map((tab) => el('button', {
    type: 'button',
    role: 'tab',
    class: 'debrief-tab',
    id: `debrief-tab-${tab.id}`,
    'aria-controls': `debrief-panel-${tab.id}`,
    onclick: () => select(tab.id),
  }, tab.label));
  const views = tabs.map((tab) => el('div', {
    role: 'tabpanel',
    class: `debrief-panel debrief-panel-${tab.id}`,
    id: `debrief-panel-${tab.id}`,
    'aria-labelledby': `debrief-tab-${tab.id}`,
    tabindex: 0, // the panel scrolls on its own: keyboard users can focus it to scroll
  }, ...(panels.get(tab.id) ?? [])));
  const select = (id: DebriefTabId, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = tab.id === id;
      buttons[i]!.setAttribute('aria-selected', String(on));
      buttons[i]!.tabIndex = on ? 0 : -1;
      views[i]!.hidden = !on;
      if (on) {
        views[i]!.scrollTop = 0;
        if (focus) buttons[i]!.focus();
      }
    });
  };
  const tablist = el('div', { class: 'debrief-tabs', role: 'tablist', 'aria-label': label, 'aria-orientation': 'horizontal' }, ...buttons);
  tablist.addEventListener('keydown', (e) => {
    const i = buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    select(tabs[(to + tabs.length) % tabs.length]!.id, true);
  });
  select(tabs[0]!.id);
  return [tablist, ...views];
}

/**
 * The debrief (game-design.md, "Debrief tabs"): the heading with the round badge, then tabs. Overview first:
 * the outcome, the round result, the payout (rows, then the tiles), the mission history (or Titan's Dragonfly) and the
 * story beat. Then Milestones, Lessons, Instrument log and Photos (the last three only when not empty).
 * The Continue or Restart buttons sit under the tabs, on every tab.
 */
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

  const logGroups = instrumentLogGroups(game.instrumentLog, data, result.earned);
  const lessons = taughtLessons(result.relationships, data.relationships, history);
  const isNew = (id: string) => lessonIsNew(id, game.notebookAtLaunch);

  // The rover as launched (the mission flies game.build) and the records held before this mission.
  const launched = completeBuild(game.build, data.parts);
  const launchParts = launched ? selectedParts(launched, data.parts) : [];
  const bay = launchParts.length ? instrumentsOf(launchParts) : (game.instrumentLog?.carried ?? []);
  const recordsHeldAtLaunch = state.records.filter((id) => !payout.newRecords.includes(id));

  // Milestones grouped by instrument (rules: groupMilestones), catalog order within a group; a staged
  // milestone is one line with its count; records already held this campaign are listed without a reward.
  // The history fact (Mission history on) shows expanded under the summary.
  const item = (m: Milestone) => {
    const paid = payout.milestones.find((p) => p.milestone.id === m.id);
    const maxStages = milestoneStages(m);
    const stages = Math.min(stagesEarned(result.earned, m.id), maxStages);
    return el('li', { 'data-milestone': m.id },
      el('span', { class: 'name' },
        el('strong', {}, maxStages > 1 ? fill(t.stagedCount, { name: m.name, stages, max: maxStages }) : m.name),
        el('span', { class: 'category' }, ` · ${categoryLabel(m.category, text)}`)),
      paid
        ? el('span', { class: 'reward' }, rewardText(paid, data))
        : el('span', { class: 'reward none' }, t.recordHeld),
      el('span', { class: 'sub' }, milestoneSummary(m, stages)),
      history && m.fact && el('span', { class: 'sub fact' }, m.fact),
    );
  };
  const earnedList = data.milestones.milestones.filter((m) => stagesEarned(result.earned, m.id) > 0);
  const groups = groupMilestones(earnedList, bay).flatMap((g) => [
    el('h4', { class: 'debrief-group' }, groupHeading(g.key, data)),
    el('ul', { class: 'debrief-milestones' }, ...g.milestones.map(item)),
  ]);
  // "Not reached": names only (game-design.md M11), each with the support part the rover lacked for it, if any (Mars M18).
  const missed = notReached(data.milestones.milestones, launchParts, result.earned, recordsHeldAtLaunch, bay);

  const tiles = overviewTiles({
    payout, balance: state.balance, failed, last, milestones: earnedList.length, notReached: missed.length,
  }, data);
  const badge = debriefBadge(failed, t);
  const tone = (base: string, v: Tone) => (v ? `${base} ${v}` : base);
  const story = failed ? t.storyFailed : t.storyPassed;

  const overview: Node[] = [
    el('p', { class: `outcome${result.survived ? '' : ' failed'}` },
      lostAt ?? (result.survived ? (last && t.survivedTitan ? fill(t.survivedTitan, minimum) : t.survived) : fill(t.cause, { cause: causeText(result, text) }))),
    el('p', { class: 'muted lasted' }, fill(text.hud.lasted, { days, total: data.tuning.mission.gameDays })),
    el('p', { class: failed ? 'outcome round failed' : 'outcome round' }, fill(failed ? t.failedRound : t.passedRound, minimum)),
    el('h3', {}, t.payoutHeading),
    el('div', { class: 'ledger debrief-ledger' },
      ...payoutRows(payout, result, data).map((r) => row(r.label, r.value, r.tone === 'bad' ? 'bad' : ''))),
    el('div', { class: 'debrief-tiles' },
      ...tiles.map((s) => el('div', { class: 'debrief-tile', 'data-tile': s.id },
        el('span', { class: 'debrief-tile-label' }, s.label),
        el('span', { class: tone('debrief-tile-value', s.tone) }, s.value),
        s.sub && el('span', { class: 'debrief-tile-sub' }, s.sub),
      ))),
    roverHistory && el('aside', { class: 'history' },
      el('p', { class: 'history-label' }, t.historyHeading),
      el('p', {}, text.history[historyKey]),
      el('p', { class: 'note' }, `Source: ${text.historySources[historyKey]}`),
    ),
    text.titanCampaign && dragonflyView(text.titanCampaign, game.state.lastBuild, data),
    story && el('p', { class: 'story-beat' }, story),
  ].filter((n): n is HTMLElement => !!n);

  const panels = new Map<DebriefTabId, Node[]>([
    ['overview', overview],
    ['milestones', [
      el('h3', {}, t.milestonesHeading),
      groups.length ? el('div', { class: 'debrief-groups' }, ...groups) : el('p', { class: 'muted' }, t.noMilestones),
      ...(missed.length > 0 ? [
        el('h3', {}, t.notReachedHeading),
        el('p', { class: 'muted' }, t.notReachedNote),
        el('ul', { class: 'debrief-not-reached' }, ...missed.map((m) => el('li', {}, notReachedLine(m, launchParts, data)))),
      ] : []),
    ]],
    ['lessons', [
      el('h3', {}, t.taughtHeading),
      el('p', { class: 'muted' }, t.taughtNote),
      el('ul', { class: 'debrief-taught' }, ...taughtItems(lessons, data, isNew)),
    ]],
    ['log', [
      el('h3', {}, t.logHeading),
      el('p', { class: 'note' }, t.logNote),
      logView(logGroups),
    ]],
    ['photos', [el('h3', {}, t.albumHeading), game.album.length ? albumView(game.album) : el('p', { class: 'muted' }, t.noPhotos)]],
  ]);
  const tabs = debriefTabs({
    milestones: earnedList.length,
    lessons: lessons.length,
    newLessons: lessons.filter((l) => isNew(l.id)).length,
    logGroups: logGroups.length,
    photos: game.album.length,
    camera: bay.includes('camera'),
  }, t);

  root.append(
    el('section', { class: 'panel debrief' },
      el('div', { class: 'debrief-head' },
        el('h2', {}, t.heading),
        el('span', { class: tone('debrief-badge', badge.tone) }, badge.text)),
      ...debriefTabsView(tabs, panels, t.tabsLabel),
      el('div', { class: 'actions debrief-actions' },
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
  const fitted = (slot: BusSlot) => {
    const p = part(slot);
    return p && providesCapability(p) ? p : undefined;
  };
  const vars = {
    wheels: part('wheels')?.name ?? '',
    battery: part('battery')?.name ?? '',
    capacity: part('battery')?.effects.batteryCapacity ?? 0,
    // A system left off (or an old save's "None" part) reads as not fitted.
    heater: fitted('heater')?.name ?? t.noHeater,
    lights: fitted('lights')?.name ?? t.noLights,
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
  design: designScreen,
  ticket: ticketScreen,
  landing,
  mission: missionScreen,
  debrief,
  complete,
};
