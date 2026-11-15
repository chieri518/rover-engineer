// Screens. Title, landing, debrief and "Mars: coming soon" are still placeholders (Phases 5 and 6).
import type { Screen, ScreenId } from '../flow/flow';
import { el, money, panel } from './dom';
import { designScreen } from './designScreen';
import { missionScreen } from './missionScreen';
import { ticketScreen } from './ticketScreen';

const title: Screen = (game, root) => {
  const t = game.data.text.title;
  root.append(
    panel(
      el('h1', {}, t.heading),
      el('p', { class: 'muted' }, t.subtitle),
      el('div', { class: 'actions' },
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, t.newCampaign),
        game.campaign && el('button', { onclick: () => game.continueCampaign() }, t.continueCampaign),
      ),
    ),
  );
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

const debrief: Screen = (game, root) => {
  const { data } = game;
  const t = data.text.debrief;
  const outcome = game.outcome;
  if (!outcome) return void game.go('title');
  const { payout, failed, state } = outcome;
  const lastResult = game.lastResult;
  const cause = lastResult?.cause;
  root.append(
    panel(
      el('h2', {}, t.heading),
      el('p', {}, lastResult?.survived ? t.survived : `Cause: ${cause ? data.text.causes[cause] : 'unknown'}`),
      el('ul', { class: 'milestones' },
        ...payout.milestones.map((p) =>
          el('li', {},
            `${p.milestone.name}${p.stages > 1 ? ` ×${p.stages}` : ''}: ${money(p.money, data.text)}, ${p.rp} RP`,
            el('div', { class: 'fact' }, p.milestone.fact),
          ),
        ),
      ),
      el('div', { class: 'readout' },
        el('div', {}, `Survival payout: ${money(payout.survivalPayout, data.text)}`),
        el('div', {}, `Milestones: ${money(payout.milestoneMoney, data.text)}`),
        el('div', {}, `Penalty: ${money(-payout.penalty, data.text)}`),
        el('div', {}, `Net: ${money(payout.money, data.text)}`),
        el('div', {}, `RP earned: ${payout.rp}`),
        el('div', {}, `Balance: ${money(state.balance, data.text)}`),
      ),
      el('p', { class: 'fact' }, data.text.history[lastResult?.survived ? 'survived' : (cause ?? 'energy')]),
      el('p', {}, failed ? t.failedRound : t.passedRound),
      el('div', { class: 'actions' },
        failed
          ? el('button', { class: 'primary', onclick: () => game.restartRound() }, 'Restart round')
          : el('button', { class: 'primary', onclick: () => game.go('marsSoon') }, 'Continue'),
      ),
    ),
  );
};

const marsSoon: Screen = (game, root) => {
  const { data } = game;
  root.append(
    panel(
      el('h2', {}, data.text.marsSoon.heading),
      el('p', {}, data.text.marsSoon.body),
      el('div', { class: 'readout' },
        el('div', { class: 'big' }, `Research points banked: ${game.state.rp}`),
        el('div', {}, `Balance: ${money(game.state.balance, data.text)}`),
      ),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('title') }, 'Back to title'),
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, data.text.title.newCampaign),
      ),
    ),
  );
};

export const screens: Record<ScreenId, Screen> = {
  title,
  design: designScreen,
  ticket: ticketScreen,
  landing,
  mission: missionScreen,
  debrief,
  marsSoon,
};
