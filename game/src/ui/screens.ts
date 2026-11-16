// Screens: title, settings, landing, debrief and Campaign complete (after the last mission, with the
// campaign summary). The design, ticket and mission screens have their own files.
import { milestoneStages } from '../rules/payout';
import type { AlbumPhoto, Screen, ScreenId } from '../flow/flow';
import type { Build, HistoryKey, Slot } from '../rules/types';
import type { TitanCampaignText } from '../rules/titanTypes';
import { categoryLabel, causeText, milestoneSummary } from './milestoneText';
import { el, fill, money, panel } from './dom';
import { gameDaysElapsed } from '../rules/sun';
import { azimuthDeg, buildLeads, buildSites, compassPoint } from '../rules/survey';
import { nextMission, type MissionLogEntry } from '../rules/campaign';
import type { GameData } from '../rules/types';
import { briefingLines, kmText } from './surveyText';
import { missionVars } from './tutorialText';
import { creditsScreen } from './creditsScreen';
import { designScreen } from './designScreen';
import { missionScreen } from './missionScreen';
import { ticketScreen } from './ticketScreen';

const title: Screen = (game, root) => {
  const t = game.data.text.title;
  // Live 3D cover behind the title (loaded on demand, with three.js); a CSS star field shows until it
  // is ready and stays if WebGL is unavailable. The buttons never depend on it.
  const cover = el('div', { class: 'title-cover', 'aria-hidden': 'true' });
  let stopCover: (() => void) | null = null;
  let left = false;
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
        game.campaign && el('button', { onclick: () => game.continueCampaign() }, t.continueCampaign),
        el('button', { onclick: () => game.go('settings') }, game.data.text.settings.open),
        el('button', { id: 'open-credits', onclick: () => game.go('credits') }, game.data.text.credits.open),
      ),
    ),
    el('p', { class: 'title-caption' }, t.coverCaption),
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
  const mars = data.text.campaign; // after the Moon (Mars, Titan): which mission, what is new on this world
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
      const masks = await loadTerrainMasks(data.tuning, game.world);
      const sites = buildSites(masks.info.features, data.tuning.milestones, s.shadowedCraterName);
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
      mars && el('p', { class: 'title-kicker' }, mars.kicker),
      el('h2', {}, t.heading),
      el('p', {}, t.briefing),
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

const settings: Screen = (game, root) => {
  const t = game.data.text.settings;
  const box = el('input', {
    type: 'checkbox',
    id: 'setting-history',
    checked: game.settings.missionHistory,
    onchange: () => game.setSettings({ missionHistory: box.checked }),
  });
  root.append(
    panel(
      el('h2', {}, t.heading),
      el('div', { class: 'setting' },
        box,
        el('label', { for: 'setting-history' }, t.history),
        el('p', { class: 'muted' }, t.historyHelp),
      ),
      el('div', { class: 'actions' }, el('button', { class: 'primary', onclick: () => game.go('title') }, t.back)),
    ),
  );
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
  // The pass mark: the minimum budget of the mission after the one just played.
  const next = nextMission(game.world);
  const minimum = { minimum: money(next ? data.tuning.budget.minimumBudget[next] : 0, text) };
  const historyKey: HistoryKey = result.survived ? 'survived' : result.detail === 'rollover' ? 'rollover' : (result.cause ?? 'energy');
  const days = result.survived ? data.tuning.mission.gameDays : gameDaysElapsed(result.secondsLasted, data.tuning.mission).toFixed(1);

  // Milestones in catalog order; records already held this campaign are listed without a reward.
  const items = data.milestones.milestones.flatMap((m) => {
    const earned = result.earned.find((e) => e.id === m.id);
    if (!earned) return [];
    const paid = payout.milestones.find((p) => p.milestone.id === m.id);
    const stages = earned.stages ?? 1;
    const maxStages = milestoneStages(m);
    return [el('li', {},
      el('span', {}, el('strong', {}, maxStages > 1 ? `${m.name} ×${stages}` : m.name), ` · ${categoryLabel(m.category, text)}`),
      paid
        ? el('span', { class: 'reward' }, fill(text.milestone.reward, { money: money(paid.money, text), rp: paid.rp }))
        : el('span', { class: 'reward none' }, t.recordHeld),
      el('span', { class: 'sub' }, milestoneSummary(m, stages)),
      history && el('span', { class: 'sub fact' }, m.fact),
    )];
  });

  root.append(
    el('section', { class: 'panel debrief' },
      el('h2', {}, t.heading),
      el('p', { class: `outcome${result.survived ? '' : ' failed'}` },
        result.survived ? t.survived : fill(t.cause, { cause: causeText(result, text) })),
      el('p', { class: 'muted' }, fill(text.hud.lasted, { days, total: data.tuning.mission.gameDays })),

      el('h3', {}, t.milestonesHeading),
      items.length ? el('ul', { class: 'debrief-milestones' }, ...items) : el('p', { class: 'muted' }, t.noMilestones),

      el('h3', {}, t.payoutHeading),
      el('div', { class: 'ledger' },
        row(t.survivalPayout, money(payout.survivalPayout, text)),
        row(t.milestoneMoney, money(payout.milestoneMoney, text)),
        row(result.survived ? t.penalty : `${t.penalty} (${causeText(result, text)})`, money(-payout.penalty, text), payout.penalty > 0 ? 'bad' : ''),
        row(t.net, money(payout.money, text), 'total'),
        row(t.rpEarned, String(payout.rp)),
        row(t.balance, money(state.balance, text), 'total'),
      ),
      el('p', { class: 'note' }, text.moneyNote),

      el('h3', {}, t.albumHeading),
      game.album.length ? albumView(game.album) : el('p', { class: 'muted' }, t.noPhotos),

      text.titanCampaign && dragonflyView(text.titanCampaign, game.state.lastBuild, data),

      roverHistory && el('h3', {}, t.historyHeading),
      roverHistory && el('div', { class: 'history' },
        el('p', {}, text.history[historyKey]),
        el('p', { class: 'note' }, `Source: ${text.historySources[historyKey]}`),
      ),

      el('p', { class: failed ? 'outcome failed' : 'outcome' }, fill(failed ? t.failedRound : t.passedRound, minimum)),
      el('div', { class: 'actions' },
        failed
          ? el('button', { class: 'primary', onclick: () => game.restartRound() }, t.restart)
          : el('button', { class: 'primary', onclick: () => game.continueCampaign() }, t.continue),
      ),
    ),
  );
};

/**
 * Titan: the real mission flies. Dragonfly compared with the rover just flown, and the lesson that the
 * right vehicle depends on the world. Shown whatever the mission history setting: it is the Titan lesson.
 */
function dragonflyView(t: TitanCampaignText, build: Build | null, data: GameData): HTMLElement {
  const part = (slot: Slot) => data.parts.parts.find((p) => p.id === build?.[slot]);
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

/** The outcome of a logged mission, in that mission's own words ("Froze during the night" on Mars). */
function outcomeText(entry: MissionLogEntry, data: GameData): string {
  const { text } = data;
  if (entry.outcome === 'survived') return text.comingSoon.completed;
  return entry.outcome === 'rollover' ? text.debrief.rollover : text.causes[entry.outcome];
}

/**
 * Campaign complete (the 'complete' end marker, after a passed Titan round): banked RP, the final
 * balance, records held, one row per mission and a total, and what each world asked of the rover.
 */
const complete: Screen = (game, root) => {
  const { data } = game;
  const { text } = data;
  const t = text.comingSoon;
  const end = text.titanCampaign?.complete;
  const { state } = game;
  const log = state.log ?? [];
  const cell = (tag: 'th' | 'td', value: string, attrs: Record<string, string> = {}) => el(tag, attrs, value);
  const total = log.reduce((sum, e) => ({ money: sum.money + e.money, rp: sum.rp + e.rp, milestones: sum.milestones + e.milestones }),
    { money: 0, rp: 0, milestones: 0 });
  root.append(
    panel(
      end && el('p', { class: 'title-kicker' }, end.kicker),
      el('h2', {}, t.heading),
      el('p', {}, t.body),
      el('div', { class: 'readout' },
        el('div', { class: 'big' }, fill(t.rpBanked, { rp: state.rp })),
        el('div', {}, fill(t.balance, { balance: money(state.balance, text) })),
        el('div', {}, fill(t.records, { n: state.records.length })),
      ),
      end && el('p', { class: 'muted' },
        fill(end.startEnd, { start: money(data.tuning.budget.startingBudget, text), balance: money(state.balance, text) })),
      el('h3', {}, t.summaryHeading),
      log.length
        ? el('table', { class: 'tiers campaign-log' },
          el('thead', {}, el('tr', {},
            ...[t.colMission, t.colOutcome, t.colNet, t.colRp, t.colMilestones].map((h) => cell('th', h, { scope: 'col' })))),
          el('tbody', {}, ...log.map((e) => {
            const own = game.dataOf(e.mission);
            return el('tr', {},
              cell('th', own.text.worlds[e.mission], { scope: 'row' }),
              cell('td', outcomeText(e, own)),
              cell('td', money(e.money, text)),
              cell('td', String(e.rp)),
              cell('td', String(e.milestones)),
            );
          })),
          end && log.length > 1 && el('tfoot', {}, el('tr', { class: 'total' },
            cell('th', end.totalRow, { scope: 'row' }),
            cell('td', ''),
            cell('td', money(total.money, text)),
            cell('td', String(total.rp)),
            cell('td', String(total.milestones)),
          )))
        : el('p', { class: 'muted' }, t.noLog),
      end && el('h3', {}, end.lessonsHeading),
      end && el('ul', { class: 'new-on-world' }, ...end.lessons.map((line) => el('li', {}, line))),
      el('p', { class: 'note' }, text.moneyNote),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('title') }, t.backToTitle),
        el('button', { onclick: () => game.go('credits') }, text.credits.open),
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, text.title.newCampaign),
      ),
    ),
  );
};

export const screens: Record<ScreenId, Screen> = {
  title,
  settings,
  credits: creditsScreen,
  design: designScreen,
  ticket: ticketScreen,
  landing,
  mission: missionScreen,
  debrief,
  complete,
};
