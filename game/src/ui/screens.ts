// Placeholder screens. Real UI comes in Phases 3 to 6.
import type { Screen, ScreenId } from '../flow/flow';
import { canStartMission } from '../rules/campaign';
import { quoteBuild } from '../rules/quote';
import { el, money, panel } from './dom';
import { missionScreen } from './missionScreen';

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

const design: Screen = (game, root) => {
  const { data } = game;
  const t = data.text.design;
  const readout = el('div', { class: 'readout' });
  const warnings = el('ul', { class: 'warnings' });
  const next = el('button', { class: 'primary', onclick: () => game.go('ticket') }, 'Continue to launch ticket');
  const allowed = canStartMission(game.state, data.tuning);

  const slots = data.parts.slots.map((slot) => {
    const select = el('select', {
      onchange: (e: Event) => {
        game.build = { ...game.build, [slot]: (e.target as HTMLSelectElement).value };
        update();
      },
    });
    for (const part of data.parts.parts.filter((p) => p.slot === slot)) {
      select.append(
        el('option', { value: part.id, selected: part.id === game.build[slot] },
          `${part.name} — ${money(part.cost, data.text)}, ${part.mass} kg, size ${part.size}`),
      );
    }
    return el('label', { class: 'slot' }, el('span', {}, slot), select);
  });

  function update(): void {
    const q = quoteBuild(game.build, data, game.state.balance);
    readout.replaceChildren(
      el('div', {}, `Parts: ${money(q.cost, data.text)}`),
      el('div', {}, `Mass: ${q.mass} kg`),
      el('div', {}, `Size: ${q.size}`),
      el('div', {}, `Ticket: ${q.tier ? `${q.tier.name}, ${money(q.ticketPrice, data.text)}` : 'none'}`),
      el('div', {}, `Total: ${money(q.totalCost, data.text)}`),
      el('div', {}, `Budget: ${money(game.state.balance, data.text)}`),
    );
    warnings.replaceChildren(
      ...[
        !allowed && t.belowMinimum,
        !q.canLaunch && t.overTopTier,
        !q.canAfford && t.overBudget,
        q.overloaded && t.chassisOverloaded,
      ]
        .filter((w): w is string => Boolean(w))
        .map((w) => el('li', {}, w)),
    );
    next.disabled = !allowed || !q.canLaunch || !q.canAfford;
  }

  root.append(
    panel(
      el('h2', {}, t.heading),
      el('p', { class: 'muted' }, t.tutorial),
      el('div', { class: 'slots' }, ...slots),
      readout,
      warnings,
      el('p', { class: 'note' }, data.text.moneyNote),
      el('div', { class: 'actions' }, next),
    ),
  );
  update();
};

const ticket: Screen = (game, root) => {
  const { data } = game;
  const q = quoteBuild(game.build, data, game.state.balance);
  root.append(
    panel(
      el('h2', {}, data.text.ticket.heading),
      el('p', {}, data.text.ticket.briefing),
      el('div', { class: 'readout' },
        el('div', {}, `Tier: ${q.tier?.name ?? 'none'} (mass ${q.mass}/${q.tier?.massLimit} kg, size ${q.size}/${q.tier?.sizeLimit})`),
        el('div', {}, `Ticket: ${money(q.ticketPrice, data.text)}`),
        el('div', {}, `Parts: ${money(q.cost, data.text)}`),
        el('div', {}, `Total: ${money(q.totalCost, data.text)}`),
        el('div', {}, `Balance after purchase: ${money(game.state.balance - q.totalCost, data.text)}`),
      ),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('design') }, 'Back to design'),
        el('button', { class: 'primary', disabled: !q.canLaunch || !q.canAfford, onclick: () => game.buyTicket() },
          'Buy ticket and launch'),
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
  design,
  ticket,
  landing,
  mission: missionScreen,
  debrief,
  marsSoon,
};
