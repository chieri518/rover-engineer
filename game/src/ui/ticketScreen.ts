// The launch ticket: which tier the rover needs and why, and the purchase.
import type { Screen } from '../flow/flow';
import { quoteBuild } from '../rules/quote';
import type { TierFit } from '../rules/tiers';
import { el, money } from './dom';
import { tierWhyText } from './tierText';

export const ticketScreen: Screen = (game, root) => {
  const { data } = game;
  const text = data.text;
  const t = text.ticket;
  const q = quoteBuild(game.build, data, game.state.balance);

  const fitText = (f: TierFit) => {
    if (f.fits) return 'Fits';
    const parts: string[] = [];
    if (f.massOver > 0) parts.push(`mass +${f.massOver} kg`);
    if (f.sizeOver > 0) parts.push(`size +${f.sizeOver}`);
    return `Over: ${parts.join(', ')}`;
  };

  const rows = q.tierWhy.fits.map((f) => {
    const chosen = q.tier?.id === f.tier.id;
    return el('tr', { class: chosen ? 'chosen' : f.fits ? '' : 'over' },
      el('th', { scope: 'row' }, f.tier.name, chosen && el('span', { class: 'badge' }, 'Selected')),
      el('td', {}, `${f.tier.massLimit} kg`),
      el('td', {}, `${f.tier.sizeLimit}`),
      el('td', {}, money(f.tier.price, text)),
      el('td', {}, fitText(f)),
    );
  });

  const row = (label: string, value: string, cls = '') =>
    el('div', { class: `row ${cls}` }, el('span', { class: 'label' }, label), el('span', { class: 'value' }, value));

  root.append(
    el('section', { class: 'panel ticket' },
      el('h2', {}, t.heading),
      el('p', {}, t.briefing),
      el('p', { class: 'muted' }, t.tierRule),
      el('div', { class: 'rover-line' },
        row('Rover mass', `${q.mass} kg`),
        row('Rover size', `${q.size}`),
      ),
      el('table', { class: 'tiers' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, 'Tier'),
          el('th', { scope: 'col' }, 'Mass limit'),
          el('th', { scope: 'col' }, 'Size limit'),
          el('th', { scope: 'col' }, 'Price'),
          el('th', { scope: 'col' }, 'This rover'),
        )),
        el('tbody', {}, ...rows),
      ),
      el('p', { class: 'why' }, tierWhyText(q.tierWhy, text)),
      el('div', { class: 'sheet-body' },
        row('Ticket', q.tier ? `${q.tier.name}, ${money(q.ticketPrice, text)}` : '—'),
        row('Parts', money(q.cost, text)),
        row('Total', money(q.totalCost, text), 'total'),
        row('Balance now', money(game.state.balance, text)),
        row('Balance after purchase', money(q.remaining, text), q.remaining < 0 ? 'bad' : ''),
      ),
      !q.canLaunch && el('ul', { class: 'warnings' }, el('li', {}, text.design.overTopTier)),
      q.canLaunch && !q.canAfford && el('ul', { class: 'warnings' }, el('li', {}, text.design.overBudget)),
      q.overloaded && el('ul', { class: 'warnings' }, el('li', {}, text.design.chassisOverloaded)),
      el('p', { class: 'note' }, text.moneyNote),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('design') }, 'Back to design'),
        el('button', { class: 'primary', disabled: !q.canLaunch || !q.canAfford, onclick: () => game.buyTicket() },
          'Buy ticket and launch'),
      ),
    ),
  );
};
