// Screens: title, settings, landing, debrief and "Mars: coming soon". The design, ticket and mission
// screens have their own files.
import { milestoneStages } from '../rules/payout';
import type { AlbumPhoto, Screen, ScreenId } from '../flow/flow';
import type { GameData, HistoryKey, Instrument, TextFile } from '../rules/types';
import { taughtLessons, type RelationshipEvent } from '../rules/relationships';
import { openNotebook, type NotebookHandle } from './notebook';
import type { InstrumentLog } from '../rules/instruments';
import { categoryLabel, causeText, milestoneSummary } from './milestoneText';
import { el, fill, money, panel } from './dom';
import { gameDaysElapsed } from '../rules/sun';
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
  let notebook: NotebookHandle | null = null;
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
        campaign && el('button', {
          id: 'notebook-open-title',
          title: game.data.text.notebook.openTitle,
          onclick: () => {
            if (!notebook) notebook = openNotebook(root, game.data, { ids: campaign.notebook, onClose: () => (notebook = null) });
          },
        }, game.data.text.notebook.open),
        el('button', { onclick: () => game.go('settings') }, game.data.text.settings.open),
        el('button', { id: 'open-credits', onclick: () => game.go('credits') }, game.data.text.credits.open),
      ),
    ),
    el('p', { class: 'title-caption' }, t.coverCaption),
  );
  return () => {
    left = true;
    stopCover?.();
    notebook?.dispose();
  };
};

const landing: Screen = (game, root) => {
  const t = game.data.text.landing;
  root.append(
    panel(
      el('h2', {}, t.heading),
      el('p', {}, t.briefing),
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

/** The debrief's instrument log: one line per carried new instrument (an X-ray line per rock read), with plain wording when unused. */
function instrumentLogLines(log: InstrumentLog | null, text: TextFile): string[] {
  if (!log) return [];
  const t = text.debrief;
  const has = (i: Instrument) => log.carried.includes(i);
  const lines: string[] = [];
  // One line per carried new instrument; nothing for instruments not carried.
  if (has('neutron')) {
    lines.push(log.hydrogenPeak === null ? t.logHydrogenNone : fill(t.logHydrogen, { percent: Math.round(log.hydrogenPeak * 100) }));
  }
  if (has('xray')) {
    if (log.rocks.length === 0) lines.push(t.logNoRocks);
    for (const r of log.rocks) {
      const rock = text.rocks[r.rock];
      lines.push(fill(t.logRock, { rock: rock?.name ?? r.rock, elements: rock?.elements ?? '' }));
    }
  }
  if (has('seismometer')) {
    lines.push(!log.stationPlaced ? t.logStationNone : log.quake === 'clean' ? t.logQuakeClean : log.quake === 'noisy' ? t.logQuakeNoisy : log.quake === 'missed' ? t.logQuakeMissed : t.logQuakeNone);
  }
  if (has('reflector')) lines.push(log.reflectorPlaced ? t.logReflector : t.logReflectorNone);
  return lines;
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
  const historyKey: HistoryKey = result.survived ? 'survived' : result.detail === 'rollover' ? 'rollover' : (result.cause ?? 'energy');
  const days = result.survived ? data.tuning.mission.gameDays : gameDaysElapsed(result.secondsLasted, data.tuning.mission).toFixed(1);

  const logLines = instrumentLogLines(game.instrumentLog, text);
  const taught = taughtItems(result.relationships, data, history);

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

      logLines.length > 0 && el('h3', {}, t.logHeading),
      logLines.length > 0 && el('ul', { class: 'debrief-log' }, ...logLines.map((l) => el('li', {}, l))),
      logLines.length > 0 && el('p', { class: 'note' }, t.logNote),

      taught.length > 0 && el('h3', {}, t.taughtHeading),
      taught.length > 0 && el('p', { class: 'muted' }, t.taughtNote),
      taught.length > 0 && el('ul', { class: 'debrief-taught' }, ...taught),

      el('h3', {}, t.albumHeading),
      game.album.length ? albumView(game.album) : el('p', { class: 'muted' }, t.noPhotos),

      history && el('h3', {}, t.historyHeading),
      history && el('div', { class: 'history' },
        el('p', {}, text.history[historyKey]),
        el('p', { class: 'note' }, `Source: ${text.historySources[historyKey]}`),
      ),

      el('p', { class: failed ? 'outcome failed' : 'outcome' }, failed ? t.failedRound : t.passedRound),
      el('div', { class: 'actions' },
        failed
          ? el('button', { class: 'primary', onclick: () => game.restartRound() }, t.restart)
          : el('button', { class: 'primary', onclick: () => game.go('marsSoon') }, t.continue),
      ),
    ),
  );
};

const marsSoon: Screen = (game, root) => {
  const { data } = game;
  const t = data.text.marsSoon;
  root.append(
    panel(
      el('h2', {}, t.heading),
      el('p', {}, t.body),
      el('div', { class: 'readout' },
        el('div', { class: 'big' }, fill(t.rpBanked, { rp: game.state.rp })),
        el('div', {}, fill(t.balance, { balance: money(game.state.balance, data.text) })),
      ),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('title') }, t.backToTitle),
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, data.text.title.newCampaign),
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
  marsSoon,
};
