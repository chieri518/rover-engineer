// The design screen ("the engineer's desk"): pick one part per slot and watch the specification sheet.
// All numbers come from rules/ (quoteBuild); this file only lays them out.
import type { Screen } from '../flow/flow';
import { canStartMission } from '../rules/campaign';
import { gameSpeed } from '../rules/drive';
import { flatRangeM } from '../rules/energy';
import { quoteBuild, type BuildQuote } from '../rules/quote';
import type { GameData, Part, Tier } from '../rules/types';
import { el, fill, money } from './dom';
import { tierWhyText } from './tierText';

const KMH = 3.6;

/** The one number that matters most for each part, shown on its card. */
function keyEffect(part: Part, data: GameData): string | null {
  const e = part.effects;
  switch (part.slot) {
    case 'chassis':
      return e.maxLoad !== undefined ? `Max load ${e.maxLoad} kg` : null;
    case 'wheels':
      return e.baseSpeed !== undefined
        ? `Top speed ${gameSpeed(e.baseSpeed, data.tuning.speed).toFixed(1)} m/s · grip ${(e.grip ?? 0).toFixed(2)}`
        : null;
    case 'power':
      return e.energyIncome !== undefined ? `Solar income ${e.energyIncome.toFixed(1)} energy/s` : null;
    case 'battery':
      return e.batteryCapacity !== undefined ? `Capacity ${e.batteryCapacity} energy` : null;
    case 'lights':
      return e.lightRange ? `Light range ${e.lightRange} m` : null;
    case 'heater':
      return e.heat ? `Heat output ${e.heat}` : null;
    case 'instrument':
      return null; // the description already says what the instrument does
  }
}

/** A horizontal gauge with a tick at each tier limit. */
function tierGauge(value: number, limits: { tier: Tier; limit: number }[], unit: string): HTMLElement {
  const top = limits[limits.length - 1]!.limit;
  const scale = Math.max(top * 1.12, value * 1.04);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const over = value > top;
  return el('div', { class: 'gauge', role: 'img', 'aria-label': `${value} ${unit}` },
    el('div', { class: `gauge-fill${over ? ' over' : ''}`, style: `width: ${pct(value)}` }),
    ...limits.map(({ tier, limit }) =>
      el('div', { class: `gauge-tick${value > limit ? ' passed' : ''}`, style: `left: ${pct(limit)}`, title: `${tier.name}: ${limit} ${unit}` },
        el('span', {}, tier.name[0] ?? ''),
      ),
    ),
  );
}

export const designScreen: Screen = (game, root) => {
  const { data } = game;
  const text = data.text;
  const t = text.design;
  const tiers = data.tiers.tiers;
  const allowed = canStartMission(game.state, data.tuning);

  // Part cards: one radio group per slot.
  const cards = new Map<string, HTMLElement>();
  const slots = data.parts.slots.map((slot) => {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    return el('fieldset', { class: 'slot' },
      el('legend', {}, text.slots[slot]),
      el('div', { class: 'options' },
        ...options.map((part) => {
          const effect = keyEffect(part, data);
          const card = el('label', { class: 'option' },
            el('input', {
              type: 'radio',
              name: `slot-${slot}`,
              value: part.id,
              checked: part.id === game.build[slot],
              onchange: () => {
                game.build = { ...game.build, [slot]: part.id };
                update();
              },
            }),
            el('span', { class: 'option-name' }, part.name),
            el('span', { class: 'option-desc' }, part.description),
            el('span', { class: 'option-stats' },
              el('span', {}, money(part.cost, text)),
              el('span', {}, `${part.mass} kg`),
              el('span', {}, `size ${part.size}`),
            ),
            effect && el('span', { class: 'option-effect' }, effect),
          );
          cards.set(part.id, card);
          return card;
        }),
      ),
    );
  });

  // Specification sheet.
  const sheet = el('div', { class: 'sheet-body' });
  const infoPanel = el('div', { class: 'info-panel', id: 'speed-info', hidden: true, role: 'region', 'aria-label': t.speedInfoTitle });
  const infoButton = el('button', {
    class: 'info-button',
    type: 'button',
    title: t.speedInfoButton,
    'aria-label': t.speedInfoButton,
    'aria-expanded': 'false',
    'aria-controls': 'speed-info',
    onclick: () => setInfo(!infoOpen),
  }, 'i');
  const warnings = el('ul', { class: 'warnings' });
  const next = el('button', { class: 'primary', onclick: () => game.go('ticket') }, 'Continue to launch ticket');

  let infoOpen = false; // the real-speed pop-up is optional and starts closed
  function setInfo(open: boolean): void {
    infoOpen = open;
    infoPanel.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  }

  const row = (label: string, value: Node | string, cls = '') =>
    el('div', { class: `row ${cls}` }, el('span', { class: 'label' }, label), el('span', { class: 'value' }, value));

  function renderInfo(q: BuildQuote): void {
    infoPanel.replaceChildren(
      el('div', { class: 'info-head' },
        el('strong', {}, t.speedInfoTitle),
        el('button', { class: 'info-close', type: 'button', 'aria-label': 'Close', onclick: () => setInfo(false) }, '×'),
      ),
      ...t.speedInfo.map((p) => el('p', {}, fill(p, { compression: data.tuning.speed.compression }))),
      el('p', { class: 'info-build' },
        fill(t.speedInfoBuild, { game: q.drive.topSpeed.toFixed(1), real: (q.drive.realTopSpeed * KMH).toFixed(1) })),
      el('p', { class: 'note' }, t.speedInfoSources),
    );
  }

  function update(): void {
    for (const [id, card] of cards) card.classList.toggle('selected', Object.values(game.build).includes(id));
    const q = quoteBuild(game.build, data, game.state.balance);
    const d = q.drive;
    const why = q.tierWhy;

    sheet.replaceChildren(
      el('h3', {}, 'Mass and size'),
      row('Mass', `${q.mass} kg`, 'gauge-row'),
      tierGauge(q.mass, tiers.map((tier) => ({ tier, limit: tier.massLimit })), 'kg'),
      row('Size', `${q.size}`, 'gauge-row'),
      tierGauge(q.size, tiers.map((tier) => ({ tier, limit: tier.sizeLimit })), 'size units'),
      row('Chassis load', `${q.mass} / ${q.maxLoad ?? '—'} kg`, q.overloaded ? 'bad' : ''),

      el('h3', {}, 'Launch ticket'),
      row('Tier', q.tier ? `${q.tier.name}` : 'None fits', q.tier ? '' : 'bad'),
      el('p', { class: 'why' }, tierWhyText(why, text),
        why.saving > 0 ? ` ${fill(t.tierSaving, { tier: why.exceeded!.tier.name, saving: money(why.saving, text) })}` : ''),

      el('h3', {}, 'Cost'),
      row('Parts', money(q.cost, text)),
      row('Ticket', q.tier ? money(q.ticketPrice, text) : '—'),
      row('Total', money(q.totalCost, text), 'total'),
      row('Budget', money(game.state.balance, text)),
      row('Remaining', money(q.remaining, text), q.remaining < 0 ? 'bad' : 'good'),

      el('h3', {}, 'Driving'),
      el('div', { class: 'row speed' },
        el('span', { class: 'label' }, 'Max speed'),
        el('span', { class: 'value' }, `${d.topSpeed.toFixed(1)} m/s (${(d.topSpeed * KMH).toFixed(0)} km/h)`, infoButton),
      ),
      infoPanel,
      row('Grip', d.grip.toFixed(2)),
      row('Drive energy', `${(d.energyPerMeter * 1000).toFixed(0)} energy/km`),
      row('Battery', `${d.batteryCapacity} energy`),
      row('Range on battery', `${(flatRangeM(d.batteryCapacity, d.energyPerMeter) / 1000).toFixed(1)} km on flat ground`),
      row('Solar income', `${d.energyIncome.toFixed(1)} energy/s in full sun`),
    );
    renderInfo(q);

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
    el('section', { class: 'desk' },
      el('header', { class: 'desk-head' },
        el('div', {},
          el('h2', {}, t.heading),
          el('p', { class: 'muted' }, t.tutorial),
        ),
        el('div', { class: 'budget' }, el('span', { class: 'label' }, 'Budget'), el('strong', {}, money(game.state.balance, text))),
      ),
      el('div', { class: 'desk-grid' },
        el('div', { class: 'slots' }, ...slots),
        el('aside', { class: 'sheet' },
          el('h2', {}, 'Specification'),
          sheet,
          warnings,
          el('div', { class: 'actions' }, next),
          el('p', { class: 'note' }, text.moneyNote),
        ),
      ),
    ),
  );
  update();
};
