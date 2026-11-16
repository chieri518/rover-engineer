// The launch ticket: which tier the rover needs and why, and the purchase.
import type { Screen } from '../flow/flow';
import { quoteBuild } from '../rules/quote';
import { reviewItems } from '../rules/relationships';
import { isCompleteBuild } from '../rules/rover';
import type { TierFit } from '../rules/tiers';
import { el, money } from './dom';
import { tierWhyText } from './tierText';
import { missingSupportWarnings } from './supportText';

export const ticketScreen: Screen = (game, root) => {
  const { data } = game;
  const text = data.text;
  const t = text.ticket;
  const q = quoteBuild(game.build, data, game.state.balance);
  // Pre-launch review: the build's relationships already in the notebook, plus hard blocks. It only
  // informs: the player can always launch.
  const r = text.review;
  const review = isCompleteBuild(game.build, data.parts) ? reviewItems(game.build, game.state.notebook, data) : [];
  const reviewSection = el('section', { class: 'review', id: 'prelaunch-review', 'aria-labelledby': 'review-heading' },
    el('h3', { id: 'review-heading' }, r.heading),
    el('p', { class: 'muted' }, review.length ? r.intro : r.empty),
    review.length > 0 && el('ul', { class: 'review-items' },
      ...review.map((item) => el('li', { class: `review-item ${item.color}`, 'data-relationship': item.id, 'data-color': item.color },
        el('span', { class: 'review-mark' }, item.color === 'red' ? r.blocked : r[item.color]),
        el('div', {},
          el('strong', {}, item.name),
          item.hardBlock && el('span', { class: 'badge' }, r.hardBlock),
          el('p', {}, item.text),
        ),
      )),
    ),
  );

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

  const warnings: string[] = [
    ...(!q.tier ? [text.design.overTopTier] : []),
    ...(q.payloadProblems.some((p) => p.kind !== 'needs') ? [text.design.bayOverCapacity] : []),
    ...missingSupportWarnings(q.payloadProblems, data),
    ...(q.canLaunch && !q.canAfford ? [text.design.overBudget] : []),
    ...(q.overloaded ? [text.design.chassisOverloaded] : []),
  ];

  const row = (label: string, value: string, cls = '') =>
    el('div', { class: `row ${cls}` }, el('span', { class: 'label' }, label), el('span', { class: 'value' }, value));

  root.append(
    el('section', { class: 'panel ticket' },
      // The top bar stays in view while the ticket scrolls.
      el('header', { class: 'ticket-head' },
        el('h2', {}, t.heading),
        el('div', { class: 'budget' }, el('span', { class: 'label' }, 'Budget'), el('strong', {}, money(game.state.balance, text))),
      ),
      el('p', {}, t.briefing),
      el('p', { class: 'muted' }, t.tierRule),
      text.campaign && el('p', { class: 'muted' }, text.campaign.ticketNote),
      text.titanCampaign && el('p', { class: 'muted world-warning' }, text.titanCampaign.solarNote),
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
      warnings.length > 0 && el('ul', { class: 'warnings' }, ...warnings.map((w) => el('li', {}, w))),
      reviewSection,
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('design') }, 'Back to design'),
        el('button', { class: 'primary', disabled: !q.canLaunch || !q.canAfford, onclick: () => game.buyTicket() },
          'Buy ticket and launch'),
      ),
    ),
  );
};
