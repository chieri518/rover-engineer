// The design screen ("the engineer's desk"): pick one part per slot and watch the specification sheet.
// All numbers come from rules/ (quoteBuild); this file only lays them out.
import type { Screen } from '../flow/flow';
import { canStartMission, nextMission } from '../rules/campaign';
import { gameSpeed } from '../rules/drive';
import { flatRangeM } from '../rules/energy';
import { quoteBuild, type BuildQuote } from '../rules/quote';
import { chosenParts } from '../rules/rover';
import type { GameData, Part, Tier } from '../rules/types';
import type { BuildPreview } from './buildPreview';
import { el, fill, money } from './dom';
import { tierWhyText } from './tierText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { missionVars, tutorialPages } from './tutorialText';

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
      if (e.energyIncome === undefined) return null;
      return titanSolar(e.energyIncome, data) ?? `Solar income ${e.energyIncome.toFixed(1)} energy/s`;
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

/** Titan: a panel's solar income at Titan (the Moon rate times the Titan solar factor), or null elsewhere. */
function titanSolar(income: number, data: GameData): string | null {
  const factor = data.tuning.titanPower?.solarFactor;
  const t = data.text.titanCampaign;
  if (factor === undefined || !t) return null;
  return fill(t.solarIncome, { income: Number((income * factor).toPrecision(1)) });
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
  const fieldsets = new Map<string, HTMLElement>();
  const slots = data.parts.slots.map((slot) => {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    const fieldset = el('fieldset', { class: 'slot' },
      el('legend', {}, text.slots[slot], el('span', { class: 'slot-empty' }, t.slotEmpty)),
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
    fieldsets.set(slot, fieldset);
    return fieldset;
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
      ...t.speedInfo.map((p) => el('p', {}, fill(p, { ...missionVars(data), compression: data.tuning.speed.compression }))),
      el('p', { class: 'info-build' },
        fill(t.speedInfoBuild, { game: q.drive.topSpeed.toFixed(1), real: (q.drive.realTopSpeed * KMH).toFixed(1) })),
      el('p', { class: 'note' }, t.speedInfoSources),
    );
  }

  // Live 3D preview of the rover as built so far (loaded on demand, with three.js). Without WebGL the
  // viewport is hidden and the desk falls back to parts and sheet only.
  const previewHint = el('p', { class: 'preview-hint' }, t.previewEmpty);
  const viewport = el('div', { class: 'preview', role: 'img', 'aria-label': t.previewLabel }, previewHint);
  let preview: BuildPreview | null = null;
  let left = false;
  const hidePreview = () => {
    viewport.hidden = true;
    desk.classList.add('no-preview');
  };
  void import('./buildPreview')
    .then(({ mountBuildPreview }) => {
      if (left) return;
      preview = mountBuildPreview(viewport, data.tuning.rover, hidePreview);
      preview.show(chosenParts(game.build, data.parts));
    })
    .catch((err) => {
      console.warn('Build preview unavailable:', err);
      hidePreview();
    });

  function update(): void {
    const chosen = chosenParts(game.build, data.parts);
    preview?.show(chosen);
    previewHint.hidden = chosen.length > 0;
    for (const [id, card] of cards) card.classList.toggle('selected', Object.values(game.build).includes(id));
    for (const [slot, fieldset] of fieldsets) fieldset.classList.toggle('empty', !game.build[slot as keyof typeof game.build]);
    const q = quoteBuild(game.build, data, game.state.balance);
    const d = q.drive;
    const why = q.tierWhy;
    // A draft rover: driving numbers need the parts they come from.
    const has = (slot: keyof typeof game.build) => Boolean(game.build[slot]);
    const dash = '—';

    sheet.replaceChildren(
      el('h3', {}, 'Mass and size'),
      row('Mass', `${q.mass} kg`, 'gauge-row'),
      tierGauge(q.mass, tiers.map((tier) => ({ tier, limit: tier.massLimit })), 'kg'),
      row('Size', `${q.size}`, 'gauge-row'),
      tierGauge(q.size, tiers.map((tier) => ({ tier, limit: tier.sizeLimit })), 'size units'),
      row('Chassis load', `${q.mass} / ${q.maxLoad ?? '—'} kg`, q.overloaded ? 'bad' : ''),

      el('h3', {}, 'Launch ticket'),
      row('Tier', q.tier ? `${q.tier.name}` : 'None fits', q.tier ? '' : 'bad'),
      el('p', { class: 'why' }, q.complete ? tierWhyText(why, text) : t.tierSoFar,
        q.complete && why.saving > 0 ? ` ${fill(t.tierSaving, { tier: why.exceeded!.tier.name, saving: money(why.saving, text) })}` : ''),

      el('h3', {}, 'Cost'),
      row('Parts', money(q.cost, text)),
      row('Ticket', q.tier ? money(q.ticketPrice, text) : '—'),
      row('Total', money(q.totalCost, text), 'total'),
      row('Budget', money(game.state.balance, text)),
      row('Remaining', money(q.remaining, text), q.remaining < 0 ? 'bad' : 'good'),

      el('h3', {}, 'Driving'),
      el('div', { class: 'row speed' },
        el('span', { class: 'label' }, 'Max speed'),
        el('span', { class: 'value' }, has('wheels') ? `${d.topSpeed.toFixed(1)} m/s (${(d.topSpeed * KMH).toFixed(0)} km/h)` : dash, infoButton),
      ),
      infoPanel,
      row('Grip', has('wheels') ? d.grip.toFixed(2) : dash),
      row('Drive energy', has('wheels') ? `${(d.energyPerMeter * 1000).toFixed(0)} energy/km` : dash),
      row('Battery', has('battery') ? `${d.batteryCapacity} energy` : dash),
      row('Range on battery', has('wheels') && has('battery') ? `${(flatRangeM(d.batteryCapacity, d.energyPerMeter) / 1000).toFixed(1)} km on flat ground` : dash),
      row('Solar income', has('power') ? (titanSolar(d.energyIncome, data) ?? `${d.energyIncome.toFixed(1)} energy/s in full sun`) : dash),
    );
    renderInfo(q);

    warnings.replaceChildren(
      ...[
        !q.complete && fill(t.slotsEmpty, { slots: q.missing.map((s) => text.slots[s]).join(', ') }),
        !allowed && t.belowMinimum,
        !q.canLaunch && t.overTopTier,
        !q.canAfford && t.overBudget,
        q.overloaded && t.chassisOverloaded,
      ]
        .filter((w): w is string => Boolean(w))
        .map((w) => el('li', {}, w)),
    );
    next.disabled = !q.complete || !allowed || !q.canLaunch || !q.canAfford;
  }

  // Tutorial: opens by itself on the first visit; the Help button reopens it.
  let tutorial: TutorialHandle | null = null;
  const openHelp = () => {
    if (tutorial) return;
    const pages = tutorialPages('design', data, { mission: game.state.mission, instrument: null, balance: game.state.balance });
    tutorial = openTutorial(root, 'design', pages, text.tutorial, () => {
      tutorial = null;
      game.markTutorialSeen('design');
    });
  };
  const help = el('button', {
    type: 'button',
    class: 'help-button',
    id: 'tutorial-help-design',
    title: text.tutorial.helpDesign,
    onclick: openHelp,
  }, text.tutorial.help);

  // After the Moon (Mars, Titan): which mission this is, the balance carried over, the next pass mark
  // (on Titan the final mark), and that parts and tickets are the Moon's for now. Titan adds a plain
  // warning that solar panels give almost no power there.
  const mars = text.campaign;
  const nextStep = nextMission(game.state.mission);
  const transition = mars && el('p', { class: 'world-transition' },
    fill(mars.carryOver, { balance: money(game.state.balance, text) }), ' ',
    nextStep ? fill(mars.passMark, { minimum: money(data.tuning.budget.minimumBudget[nextStep], text) }) : '', ' ',
    mars.sameParts,
  );

  const desk = el('section', { class: 'desk' },
    el('header', { class: 'desk-head' },
      el('div', {},
        mars && el('p', { class: 'title-kicker' }, mars.kicker),
        el('h2', {}, t.heading),
        el('p', { class: 'muted' }, t.tutorial),
        transition,
        text.titanCampaign && el('p', { class: 'world-transition world-warning' }, text.titanCampaign.solarNote),
      ),
      el('div', { class: 'desk-head-side' },
        help,
        el('div', { class: 'budget' }, el('span', { class: 'label' }, 'Budget'), el('strong', {}, money(game.state.balance, text))),
      ),
    ),
    el('div', { class: 'desk-grid' },
      el('div', { class: 'slots' }, ...slots),
      viewport,
      el('aside', { class: 'sheet' },
        el('h2', {}, 'Specification'),
        sheet,
        warnings,
        el('div', { class: 'actions' }, next),
        el('p', { class: 'note' }, text.moneyNote),
      ),
    ),
  );
  root.append(desk);
  update();
  if (!game.tutorialSeen.design) openHelp();
  return () => {
    left = true;
    preview?.dispose();
    preview = null;
    tutorial?.dispose();
  };
};
