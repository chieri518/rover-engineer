// The design screen ("the engineer's desk"): pick one part per bus slot, fill the payload bay, and watch
// the specification sheet.
// All numbers come from rules/ (quoteBuild); this file only lays them out.
import type { Screen } from '../flow/flow';
import { canStartMission, nextMission } from '../rules/campaign';
import { gameSpeed } from '../rules/drive';
import { flatRangeM } from '../rules/energy';
import { quoteBuild, type BuildQuote } from '../rules/quote';
import { earnsMilestones, fitPayload, instrumentCosts, instrumentKeys, togglePayload, type InstrumentCosts } from '../rules/payload';
import { chosenParts } from '../rules/rover';
import type { DraftBuild, GameData, Part, Tier } from '../rules/types';
import type { BuildPreview } from './buildPreview';
import { el, fill, money } from './dom';
import { tierWhyText } from './tierText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { openNotebook, type NotebookHandle } from './notebook';
import { missionVars, tutorialPages } from './tutorialText';

const KMH = 3.6;

/** An instrument's operating costs as text ("10 energy per use, holds the rover 3 s"), or null when it has none. */
function costsText(c: InstrumentCosts, data: GameData, withHold: boolean): string | null {
  const t = data.text.design;
  const items = [
    c.energyPerUse > 0 && fill(t.energyPerUse, { energy: c.energyPerUse }),
    c.standbyEnergy > 0 && fill(t.energyStandby, { energy: c.standbyEnergy }),
    withHold && c.useSeconds > 0 && fill(t.useHold, { seconds: c.useSeconds }),
  ].filter((x): x is string => Boolean(x));
  return items.length ? items.join(', ') : null;
}

/** The one number that matters most for each part, shown on its card. */
function keyEffect(part: Part, data: GameData): string | null {
  const e = part.effects;
  switch (part.slot) {
    case 'chassis':
      return e.maxLoad !== undefined ? `Max load ${e.maxLoad} kg · ${e.mountingPoints ?? 0} mounting points` : null;
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
    case 'instrument': {
      // The description says what the instrument does; the card adds what it costs to run.
      const c = instrumentCosts([part])[0];
      return c ? costsText(c, data, true) : null;
    }
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

  const partById = (id: string) => data.parts.parts.find((p) => p.id === id);
  const chassisPoints = (build: DraftBuild): number | null => {
    const chassis = build.chassis ? partById(build.chassis) : undefined;
    return chassis ? chassis.effects.mountingPoints ?? 0 : null;
  };
  // Before a chassis is chosen the bay may take as many instruments as the roomiest chassis; choosing
  // a smaller chassis then drops the ones added last.
  const maxPoints = Math.max(0, ...data.parts.parts.map((p) => p.effects.mountingPoints ?? 0));
  let bayNotice = ''; // why instruments were just dropped from the bay
  const setBuild = (build: DraftBuild, notice = '') => {
    game.build = build;
    bayNotice = notice;
    update();
  };

  const cards = new Map<string, HTMLElement>();
  const fieldsets = new Map<string, HTMLElement>();
  const card = (part: Part, input: HTMLInputElement, ...extra: (Node | null)[]) => {
    const effect = keyEffect(part, data);
    const node = el('label', { class: 'option' },
      input,
      el('span', { class: 'option-name' }, part.name),
      el('span', { class: 'option-desc' }, part.description),
      el('span', { class: 'option-stats' },
        el('span', {}, money(part.cost, text)),
        el('span', {}, `${part.mass} kg`),
        el('span', {}, `size ${part.size}`),
      ),
      effect && el('span', { class: 'option-effect' }, effect),
      part.effects.instrument && !earnsMilestones(part.effects.instrument, data.milestones)
        ? el('span', { class: 'option-note' }, t.instrumentNoMilestones) : null,
      ...extra,
    );
    cards.set(part.id, node);
    return node;
  };

  // Part cards: one radio group per bus slot.
  const slots = data.parts.slots.map((slot) => {
    const options = data.parts.parts.filter((p) => p.slot === slot);
    const fieldset = el('fieldset', { class: 'slot' },
      el('legend', {}, text.slots[slot], el('span', { class: 'slot-empty' }, t.slotEmpty)),
      el('div', { class: 'options' },
        ...options.map((part) => card(part, el('input', {
          type: 'radio',
          name: `slot-${slot}`,
          value: part.id,
          checked: part.id === game.build[slot],
          onchange: () => {
            const build: DraftBuild = { ...game.build, [slot]: part.id };
            // A chassis with fewer mounting points drops the instruments added last.
            const points = chassisPoints(build);
            if (slot !== 'chassis' || !build.payload || points === null) return setBuild(build);
            const { kept, dropped } = fitPayload(build.payload, points);
            if (!dropped.length) return setBuild(build);
            const names = dropped.map((id) => partById(id)?.name ?? id).join(text.ticket.and);
            setBuild({ ...build, payload: kept }, fill(t.bayDropped, { chassis: part.name, points, parts: names }));
          },
        }))),
      ),
    );
    fieldsets.set(slot, fieldset);
    return fieldset;
  });

  // The payload bay: instrument cards with checkboxes, in the order they were added (the mission keys).
  const instrumentParts = data.parts.parts.filter((p) => p.slot === 'instrument');
  const bayInputs = new Map<string, HTMLInputElement>();
  const bayKeys = new Map<string, HTMLElement>();
  const bayCounter = el('span', { class: 'bay-counter' });
  const baySockets = el('span', { class: 'bay-sockets', 'aria-hidden': 'true' });
  const bayStatus = el('p', { class: 'bay-notice', role: 'status' });
  const noneButton = el('button', {
    type: 'button',
    class: 'bay-none',
    onclick: () => setBuild({ ...game.build, payload: [] }),
  }, t.bayNone);
  const bay = el('fieldset', { class: 'slot bay' },
    el('legend', {}, text.slots.instrument, el('span', { class: 'slot-empty' }, t.slotEmpty)),
    el('div', { class: 'bay-body' },
      el('p', { class: 'bay-head' }, baySockets, bayCounter),
      el('div', { class: 'options' },
        ...instrumentParts.map((part) => {
          const input = el('input', {
            type: 'checkbox',
            name: 'payload',
            value: part.id,
            onchange: () => {
              const payload = togglePayload(game.build.payload, part.id, chassisPoints(game.build) ?? maxPoints);
              // Taking out the last instrument leaves a confirmed empty bay: the player has decided on the bay.
              setBuild({ ...game.build, payload });
            },
          });
          bayInputs.set(part.id, input);
          const key = el('span', { class: 'option-key' });
          bayKeys.set(part.id, key);
          return card(part, input, key);
        }),
      ),
      el('div', { class: 'bay-foot' }, noneButton, el('span', { class: 'muted' }, t.bayHint)),
      bayStatus,
    ),
  );
  fieldsets.set('instrument', bay);
  slots.push(bay);

  function updateBay(): void {
    const payload = game.build.payload;
    const used = payload?.length ?? 0;
    const points = chassisPoints(game.build);
    const full = used >= (points ?? maxPoints);
    // The same mission keys as in the mission (rules/payload instrumentKeys), from the bay's parts in bay order.
    const bayParts = (payload ?? []).flatMap((id) => partById(id) ?? []);
    const keys = instrumentKeys(bayParts);
    bayCounter.textContent = points === null ? t.bayNoChassis : fill(t.bayPoints, { used, points });
    baySockets.replaceChildren(...Array.from({ length: points ?? 0 }, (_, i) => el('span', { class: `socket${i < used ? ' filled' : ''}` })));
    for (const [id, input] of bayInputs) {
      const at = payload?.indexOf(id) ?? -1;
      input.checked = at >= 0;
      input.disabled = at < 0 && full;
      const node = cards.get(id)!;
      node.classList.toggle('disabled', input.disabled);
      node.title = input.disabled ? t.bayFull : '';
      const inst = partById(id)?.effects.instrument;
      const key = at >= 0 && inst ? keys.get(inst) : undefined;
      bayKeys.get(id)!.textContent = key ? fill(t.bayKey, { key }) : '';
    }
    const confirmedEmpty = payload !== undefined && payload.length === 0;
    noneButton.textContent = confirmedEmpty ? t.bayNoneChosen : t.bayNone;
    noneButton.classList.toggle('active', confirmedEmpty);
    noneButton.setAttribute('aria-pressed', String(confirmedEmpty));
    bayStatus.textContent = bayNotice;
    bayStatus.hidden = !bayNotice;
  }

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

  /** The bay's instrument energy for the spec sheet: per use and standby, per instrument that has any. */
  function instrumentEnergyText(): string {
    const payload = game.build.payload;
    if (payload === undefined) return '—';
    const bayParts = payload.flatMap((id) => partById(id) ?? []);
    const items = bayParts.flatMap((part) => {
      const c = instrumentCosts([part])[0];
      const costs = c && costsText(c, data, false);
      return costs ? [fill(t.instrumentEnergyItem, { name: part.name, costs })] : [];
    });
    return items.length ? items.join('; ') : t.instrumentEnergyNone;
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
    const selected = new Set([...data.parts.slots.map((s) => game.build[s]), ...(game.build.payload ?? [])]);
    for (const [id, node] of cards) node.classList.toggle('selected', selected.has(id));
    for (const [slot, fieldset] of fieldsets) {
      fieldset.classList.toggle('empty', slot === 'instrument' ? game.build.payload === undefined : !game.build[slot as keyof typeof game.build]);
    }
    updateBay();
    const q = quoteBuild(game.build, data, game.state.balance);
    const d = q.drive;
    const why = q.tierWhy;
    // A draft rover: driving numbers need the parts they come from.
    const has = (slot: keyof typeof game.build) => Boolean(game.build[slot]);
    const bayOver = q.payloadProblems.some((p) => p.kind === 'over-capacity');
    const dash = '—';

    sheet.replaceChildren(
      el('h3', {}, 'Mass and size'),
      row('Mass', `${q.mass} kg`, 'gauge-row'),
      tierGauge(q.mass, tiers.map((tier) => ({ tier, limit: tier.massLimit })), 'kg'),
      row('Size', `${q.size}`, 'gauge-row'),
      tierGauge(q.size, tiers.map((tier) => ({ tier, limit: tier.sizeLimit })), 'size units'),
      row('Chassis load', `${q.mass} / ${q.maxLoad ?? '—'} kg`, q.overloaded ? 'bad' : ''),
      row('Payload bay', q.mountingPoints === null ? `${q.instruments} / — instruments` : `${q.instruments} / ${q.mountingPoints} instruments`,
        q.mountingPoints !== null && q.instruments > q.mountingPoints ? 'bad' : ''),

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
      row(t.instrumentEnergy, instrumentEnergyText()),
      row('Solar income', has('power') ? (titanSolar(d.energyIncome, data) ?? `${d.energyIncome.toFixed(1)} energy/s in full sun`) : dash),
    );
    renderInfo(q);

    warnings.replaceChildren(
      ...[
        !q.complete && fill(t.slotsEmpty, { slots: q.missing.map((s) => text.slots[s]).join(', ') }),
        !allowed && t.belowMinimum,
        !q.tier && t.overTopTier,
        bayOver && t.bayOverCapacity,
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
    if (tutorial || notebook) return;
    const pages = tutorialPages('design', data, { mission: game.state.mission, instruments: [], balance: game.state.balance });
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

  // Engineering notebook: what REL has learned in the field, for planning the next rover.
  let notebook: NotebookHandle | null = null;
  const notebookButton = el('button', {
    type: 'button',
    class: 'help-button',
    id: 'notebook-open-desk',
    title: text.notebook.openTitle,
    onclick: () => {
      if (!notebook && !tutorial) notebook = openNotebook(root, data, { ids: game.state.notebook, onClose: () => (notebook = null) });
    },
  }, text.notebook.open);

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
        notebookButton,
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
    notebook?.dispose();
  };
};
