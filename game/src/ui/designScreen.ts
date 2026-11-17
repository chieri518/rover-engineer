// The design screen ("the engineer's desk", game-design.md "The engineer's desk as a parts editor"): the
// parts palette on the left (deskPalette.ts: one part per required bus slot, and the payload bay's
// instruments and systems), the live 3D rover in the middle (buildPreview.ts), and the specification
// sheet on the right with the launch-ticket button. On wide screens the 3D view is the desk's whole
// background, the palette and the sheet float over it, and the rover is framed in the clear middle.
// All numbers come from rules/ (quoteBuild); this file only lays them out.
import type { Screen } from '../flow/flow';
import { canStartMission, isPlayable, nextMission } from '../rules/campaign';
import { flatRangeM, partPower } from '../rules/energy';
import { softGroundRating } from '../rules/ground';
import { quoteBuild, type BuildQuote } from '../rules/quote';
import { bayCapacity, instrumentCosts } from '../rules/payload';
import { chosenParts } from '../rules/rover';
import type { BriefItem, DraftBuild, RequiredSlot, SoftGroundRating, Tier } from '../rules/types';
import type { BuildPreview } from './buildPreview';
import { categoryOfGroup, choosePart, mountPalette, partForGroup } from './deskPalette';
import { el, fill, money } from './dom';
import { costsText, titanSolar } from './partCard';
import { openTutorial, type TutorialHandle } from './tutorial';
import { openNotebook, type NotebookHandle } from './notebook';
import { missionVars, tutorialPages } from './tutorialText';
import { nightBudgetTile } from './marsMission';
import { missingSupportPairs } from './supportText';
import { briefIcon } from './briefIcons';

const KMH = 3.6;
/** Below this many pixels left for the columns under the notes, the columns take the screen under the header instead. */
const MIN_GRID_PX = 520;
/** #app's padding above and below the desk (style.css). */
const APP_PADDING_PX = 16;
/** From this width up the preview is the desk's background (style.css); below it, a block between the columns. */
const PREVIEW_BACKGROUND_MEDIA = '(min-width: 1000px)';

/** State colour for a value against a limit: ok, near it (from `warnShare` of it) or over it. */
function limitState(value: number, limit: number, warnShare: number): 'ok' | 'near' | 'over' {
  return value > limit ? 'over' : value >= limit * warnShare ? 'near' : 'ok';
}

/** A number with a small unit after it ("85" "kg"); the unit is left out when empty. */
function num(value: string, unit = ''): HTMLElement {
  return el('span', { class: 'num' }, value, unit ? el('span', { class: 'unit' }, unit) : null);
}

/**
 * One row of the meters grid (label | bar | value). The row's cells are hidden from screen readers, which
 * read its full sentence instead; the sentence is also the row's tooltip.
 */
function meterRow(label: string, bar: HTMLElement, value: HTMLElement, sentence: string, cls = ''): HTMLElement {
  return el('div', { class: `meter-row ${cls}`, title: sentence },
    el('span', { class: 'meter-label', 'aria-hidden': 'true' }, label),
    el('span', { class: 'meter-bar', 'aria-hidden': 'true' }, bar),
    el('span', { class: 'meter-num', 'aria-hidden': 'true' }, value),
    el('span', { class: 'visually-hidden' }, sentence),
  );
}

/**
 * A tier gauge: the tier bands along the track with the current tier's band lit, a tick and letter at each
 * tier limit, and the value's fill (red over the top tier).
 */
function tierGauge(value: number, limits: { tier: Tier; limit: number }[], current: Tier | null): HTMLElement {
  const top = limits[limits.length - 1]!.limit;
  const scale = Math.max(top * 1.12, value * 1.04);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return el('div', { class: 'gauge' },
    ...limits.map(({ tier, limit }, i) => {
      const from = i ? limits[i - 1]!.limit : 0;
      return el('div', { class: `gauge-band${tier.id === current?.id ? ' current' : ''}`, style: `left: ${pct(from)}; width: calc(${pct(limit)} - ${pct(from)})` });
    }),
    el('div', { class: `gauge-fill${value > top ? ' over' : ''}`, style: `width: ${pct(value)}` }),
    ...limits.map(({ tier, limit }) =>
      el('div', { class: `gauge-tick${value > limit ? ' passed' : ''}${tier.id === current?.id ? ' current' : ''}`, style: `left: ${pct(limit)}` },
        el('span', {}, tier.name[0] ?? ''),
      ),
    ),
  );
}

export const designScreen: Screen = (game, root) => {
  const { data } = game;
  const text = data.text;
  const t = text.design;
  const st = t.spec;
  const tiers = data.tiers.tiers;
  const allowed = canStartMission(game.state, data.tuning);

  // A build carried from another world (the Moon's, continued to Mars) has lost the parts this world does
  // not offer (src/flow/flow.ts carryToWorld); the notice names them until a rover is bought here.
  const notOffered = game.notOffered;

  const partById = (id: string) => data.parts.parts.find((p) => p.id === id);
  // Before a chassis is chosen the bay may take as many items as the roomiest chassis (rules/payload
  // bayCapacity); choosing a smaller chassis then drops the instruments added last.
  let bayNotice = ''; // why instruments were just dropped from the bay
  const setBuild = (build: DraftBuild, notice = '') => {
    game.build = build;
    bayNotice = notice;
    update();
  };

  // The parts palette (deskPalette.ts): a click fits the part (a required part replaces its slot's part; a
  // payload item toggles), a chassis with fewer mounting points drops the instruments fitted last.
  const palette = mountPalette({
    data,
    balance: game.state.balance,
    getBuild: () => game.build,
    onChoose: (part) => {
      const { build, dropped } = choosePart(game.build, part, data.parts);
      if (!dropped.length) return setBuild(build);
      const names = dropped.map((id) => partById(id)?.name ?? id).join(text.ticket.and);
      const points = bayCapacity(build, data.parts).points;
      setBuild(build, fill(t.bayDropped, { chassis: part.name, points, parts: names }));
    },
  });

  // Specification sheet.
  const sheet = el('div', { class: 'sheet-body' });
  const remaining = el('span', { class: 'spec-remaining' }); // the money left, in the title row (update())
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
  const warnings = el('ul', { class: 'spec-warnings' });
  const next = el('button', { class: 'primary', onclick: () => game.go('ticket') }, st.continue);

  let infoOpen = false; // the real-speed pop-up is optional and starts closed
  function setInfo(open: boolean): void {
    infoOpen = open;
    infoPanel.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  }

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

  /**
   * A stat tile: a short label, a large value with a small unit (or a dash until the parts it needs are
   * chosen) and an optional small line under it. Its full sentence is the tooltip and what screen readers read.
   * `extra` (the speed's ⓘ) sits by the label; `value` may be a ready element (the soft-ground word and meter).
   */
  function stat(label: string, value: string | HTMLElement | null, unit: string, sentence: string, opts: { extra?: Node | null; sub?: string | null; cls?: string } = {}): HTMLElement {
    const full = value === null ? fill(st.pending, { label }) : sentence;
    return el('div', { class: `stat ${opts.cls ?? ''}`, title: full },
      el('div', { class: 'stat-head' }, el('span', { class: 'stat-label', 'aria-hidden': 'true' }, label), opts.extra ?? null),
      el('div', { class: 'stat-value', 'aria-hidden': 'true' }, value === null ? '—' : typeof value === 'string' ? num(value, unit) : value),
      value !== null && opts.sub ? el('div', { class: 'stat-sub', 'aria-hidden': 'true' }, opts.sub) : null,
      el('span', { class: 'visually-hidden' }, full),
    );
  }

  /** The soft-ground rating as a short word and a three-segment meter (three lit for Good, one for Poor). */
  function softGroundValue(rating: SoftGroundRating): HTMLElement {
    const lit = rating === 'good' ? 3 : rating === 'fair' ? 2 : 1;
    return el('span', { class: `soft-rating ${rating}` },
      el('span', { class: 'soft-word' }, st.softGroundLevels[rating]),
      el('span', { class: 'soft-meter' }, ...[0, 1, 2].map((i) => el('span', { class: `soft-seg${i < lit ? ' lit' : ''}` }))));
  }

  /** The bay's instrument energy: a short chip per instrument that uses any ("X-ray 3/use", "Neutron 0.1/s"), the full wording in its tooltip. */
  function instrumentEnergy(): HTMLElement {
    const instruments = (game.build.payload ?? []).flatMap((id) => partById(id) ?? []);
    const chips = instruments.flatMap((part) => {
      const c = instrumentCosts([part])[0];
      const costs = c && costsText(c, data, false);
      if (!c || !costs) return [];
      const full = fill(t.instrumentEnergyItem, { name: part.name, costs });
      const name = (c.instrument && st.instrumentNames[c.instrument]) || part.name;
      const value = c.energyPerUse > 0 ? num(String(c.energyPerUse), st.perUse) : num(String(c.standbyEnergy), st.perSecond);
      return [el('li', { class: 'chip', title: full },
        el('span', { 'aria-hidden': 'true' }, name, ' ', value),
        el('span', { class: 'visually-hidden' }, full))];
    });
    return el('div', { class: 'spec-instr' },
      el('span', { class: 'stat-label' }, st.instruments),
      chips.length ? el('ul', { class: 'chips' }, ...chips) : el('span', { class: 'muted' }, t.instrumentEnergyNone),
    );
  }

  // Live 3D preview of the rover as built so far (loaded on demand, with three.js). Without WebGL the
  // viewport is hidden and the desk falls back to parts and sheet only.
  // Clicking a part on the rover opens its category in the palette and flashes its tile.
  const previewHint = el('p', { class: 'preview-hint' }, t.previewEmpty);
  const viewport = el('div', { class: 'preview', role: 'img', 'aria-label': t.previewLabel }, previewHint,
    el('p', { class: 'preview-pick-hint', 'aria-hidden': 'true' }, t.pickHint));
  let preview: BuildPreview | null = null;
  let left = false;
  const hidePreview = () => {
    viewport.hidden = true;
    desk.classList.add('no-preview');
  };
  // The palette's thumbnails (partThumbs.ts, with three.js) render after the live preview has mounted,
  // one part at a time; leaving the desk stops the batch.
  const thumbs = new AbortController();
  const renderThumbs = () => {
    if (left) return;
    void import('./partThumbs')
      .then(({ renderPartThumbs }) =>
        renderPartThumbs(palette.parts, data.tuning.rover, { signal: thumbs.signal, onThumb: (id, url) => palette.setThumb(id, url) }))
      .catch((err) => console.warn('Part thumbnails unavailable:', err));
  };
  void import('./buildPreview')
    .then(({ mountBuildPreview }) => {
      if (left) return;
      preview = mountBuildPreview(viewport, data.tuning.rover, hidePreview);
      preview.show(chosenParts(game.build, data.parts));
      preview.onPick((group) => palette.open(categoryOfGroup(group), partForGroup(group, game.build, data.parts)));
      frameRover();
    })
    .catch((err) => {
      console.warn('Build preview unavailable:', err);
      hidePreview();
    })
    .finally(renderThumbs);

  function update(): void {
    const chosen = chosenParts(game.build, data.parts);
    preview?.show(chosen);
    previewHint.hidden = chosen.length > 0;
    palette.update(bayNotice);
    const q = quoteBuild(game.build, data, game.state.balance);
    const d = q.drive;
    // A draft rover: driving numbers need the parts they come from.
    const has = (slot: keyof typeof game.build) => Boolean(game.build[slot]);
    const bayOver = q.payloadProblems.some((p) => p.kind === 'over-capacity');
    const chosenPower = partPower(chosen);
    const night = nightBudgetTile(data, chosen); // Mars only (null on the Moon and Titan)
    const cash = (n: number) => money(n, text);
    const dash = '—';

    // Cost: the budget bar (parts and ticket against the budget) and the one large number, what remains.
    const budget = game.state.balance;
    const over = q.remaining < 0;
    const costScale = Math.max(budget, q.totalCost, 1);
    const share = (n: number) => `${(Math.max(0, n) / costScale) * 100}%`;
    const costSentence = `${fill(st.costSentence, { budget: cash(budget), parts: cash(q.cost), ticket: cash(q.ticketPrice), total: cash(q.totalCost) })} ${
      over ? fill(st.overSentence, { amount: cash(-q.remaining) }) : fill(st.remainingSentence, { amount: cash(q.remaining) })}`;
    // The remaining money sits in the panel's title row, the one large number.
    remaining.className = `spec-remaining ${over ? 'bad' : 'good'}`;
    remaining.title = costSentence;
    remaining.replaceChildren(
      el('span', { class: 'spec-remaining-label' }, over ? st.overBudgetLabel : st.remaining),
      el('strong', {}, over ? cash(-q.remaining) : cash(q.remaining)),
    );
    const cost = el('section', { class: 'spec-section spec-cost' },
      el('h3', { class: 'visually-hidden' }, st.cost),
      el('div', { class: `cost-bar${over ? ' over' : ''}`, role: 'img', 'aria-label': costSentence, title: costSentence },
        el('span', { class: 'cost-seg parts', style: `width: ${share(q.cost)}` }),
        el('span', { class: 'cost-seg ticket', style: `width: ${share(q.ticketPrice)}` }),
        over && el('span', { class: 'cost-over', style: `left: ${share(budget)}; right: 0` }),
        over && el('span', { class: 'cost-mark', style: `left: ${share(budget)}` }),
      ),
      el('div', { class: 'cost-legend', 'aria-hidden': 'true' },
        el('span', { class: 'key parts' }, `${st.parts} `, el('b', {}, cash(q.cost))),
        el('span', { class: 'key ticket' }, `${st.ticket} `, el('b', {}, q.tier ? cash(q.ticketPrice) : dash)),
        el('span', { class: 'key budget' }, `${st.budget} `, el('b', {}, cash(budget))),
      ),
    );

    // Mass and size: the tier gauges, the ticket tier as a chip in the heading, the chassis load and the bay.
    const gaugeRow = (label: string, value: number, unit: string, unitLong: string, limits: { tier: Tier; limit: number }[]) =>
      meterRow(label, tierGauge(value, limits, q.tier), num(String(value), unit),
        fill(st.gaugeSentence, { label, value, unit: unitLong, limits: limits.map((l) => fill(st.gaugeLimit, { tier: l.tier.name, limit: l.limit })).join(', ') }),
        value > limits[limits.length - 1]!.limit ? 'bad' : ''); // red only on the gauge past the top tier
    const tierSentence = q.tier ? fill(st.tierSentence, { tier: q.tier.name, price: cash(q.ticketPrice) }) : st.tierNoneSentence;
    const load = q.maxLoad === null ? null : limitState(q.mass, q.maxLoad, data.tuning.mass.loadWarningShare);
    const loadBar = el('div', { class: `load-bar ${load ?? ''}` },
      el('span', { class: 'load-fill', style: `width: ${q.maxLoad ? Math.min(100, (q.mass / q.maxLoad) * 100) : 0}%` }));
    const points = q.mountingPoints ?? 0;
    const pips = el('div', { class: 'pips' },
      ...Array.from({ length: q.mountingPoints === null ? 0 : Math.max(points, q.pointsUsed) }, (_, i) =>
        el('span', { class: `pip${i < q.pointsUsed ? ' filled' : ''}${i >= points ? ' over' : ''}` })));
    const massSize = el('section', { class: 'spec-section' },
      el('div', { class: 'spec-head' },
        el('h3', {}, st.massSize),
        el('span', { class: `tier-chip${q.tier ? '' : ' bad'}`, title: tierSentence },
          el('span', { 'aria-hidden': 'true' }, q.tier ? fill(st.tierChip, { tier: q.tier.name, price: cash(q.ticketPrice) }) : st.tierNone),
          el('span', { class: 'visually-hidden' }, tierSentence)),
      ),
      el('div', { class: 'spec-meters' },
        gaugeRow(st.mass, q.mass, st.massUnit, st.massUnit, tiers.map((tier) => ({ tier, limit: tier.massLimit }))),
        gaugeRow(st.size, q.size, '', st.sizeUnitLong, tiers.map((tier) => ({ tier, limit: tier.sizeLimit }))),
        meterRow(st.load, loadBar,
          q.maxLoad === null ? num(dash) : num(String(q.mass), `/ ${q.maxLoad} ${st.massUnit}`),
          q.maxLoad === null ? st.loadNone : fill(load === 'over' ? st.loadOverSentence : st.loadSentence, { mass: q.mass, max: q.maxLoad }),
          load === 'over' ? 'bad' : load === 'near' ? 'near' : ''),
        meterRow(st.bay, pips,
          q.mountingPoints === null ? num(dash) : num(String(q.pointsUsed), `/ ${points}`),
          q.mountingPoints === null ? t.bayNoChassis : fill(st.baySentence, { used: q.pointsUsed, points }),
          bayOver ? 'bad' : ''),
      ),
    );

    // Driving and energy: four stat tiles (speed, soft ground, battery, charging), the Mars night tile and the
    // instruments' energy.
    const wheels = has('wheels');
    const soft = softGroundRating(d.massKg, d.grip, data.tuning);
    const softSentence = fill(st.softGroundSentence, {
      rating: st.softGroundLevels[soft.rating], mass: d.massKg, grip: d.grip.toFixed(2), sinkage: soft.sinkageCm.toFixed(1),
    });
    const range = wheels ? (flatRangeM(d.batteryCapacity, d.energyPerMeter) / 1000).toFixed(1) : null;
    const batterySentence = [
      fill(st.batterySentence, { capacity: d.batteryCapacity }),
      range !== null && fill(st.batteryRangeSentence, { range, perKm: (d.energyPerMeter * 1000).toFixed(0) }),
    ].filter(Boolean).join(' ');
    const titanIncome = titanSolar(d.energyIncome, data);
    const steady = chosenPower.steadyIncome;
    const charging = !has('power') ? stat(st.charging, null, '', '')
      : steady > 0
        ? stat(st.charging, `+${steady.toFixed(1)}`, st.perSecond, fill(st.steadySentence, { income: steady.toFixed(1) }), { sub: st.chargingSteady })
        : titanIncome !== null
          ? stat(st.charging, st.solarAlmostNone, st.perSecond, titanIncome, { sub: st.chargingSolar, cls: 'warn' }) // Titan: the rate is in the tooltip
          : stat(st.charging, `+${d.energyIncome.toFixed(1)}`, st.perSecond, fill(st.solarSentence, { income: d.energyIncome.toFixed(1) }), { sub: st.chargingSolar });
    // The night tile: the battery's net rate at night, asleep and awake with lights, coloured by state, with the
    // night's net change underneath (with the battery share for an amber or red value).
    const nightTile = night && el('div', { class: 'stat wide night', title: `${night.label}: ${night.sentence}` },
      el('div', { class: 'stat-head', 'aria-hidden': 'true' }, el('span', { class: 'stat-label' }, night.label)),
      el('div', { class: 'night-items', 'aria-hidden': 'true' },
        ...(night.items.length
          ? night.items.map((x) => el('div', { class: `night-item ${x.key} ${x.state ?? 'none'}` },
            el('span', { class: 'night-label' }, el('span', { class: 'night-icon' }), x.label),
            el('span', { class: 'night-value' }, x.unit ? num(x.value, x.unit) : x.value),
            x.sub ? el('span', { class: 'stat-sub night-sub' }, x.sub) : null))
          : [el('div', { class: 'stat-value' }, dash)])),
      el('span', { class: 'visually-hidden' }, `${night.label}: ${night.sentence}`),
    );
    const driving = el('section', { class: 'spec-section' },
      el('div', { class: 'spec-head' }, el('h3', {}, st.drivingEnergy)),
      el('div', { class: 'stat-grid' },
        stat(st.speed, wheels ? (d.topSpeed * KMH).toFixed(0) : null, st.speedUnit,
          fill(st.speedSentence, { game: d.topSpeed.toFixed(1), kmh: (d.topSpeed * KMH).toFixed(0) }), { extra: infoButton }),
        stat(st.softGround, wheels ? softGroundValue(soft.rating) : null, '', softSentence),
        stat(st.battery, has('battery') ? String(d.batteryCapacity) : null, '', batterySentence,
          { sub: range !== null ? fill(st.batteryRange, { range }) : null }),
        charging,
        nightTile,
      ),
      infoPanel,
      instrumentEnergy(),
    );

    sheet.replaceChildren(cost, massSize, driving);
    renderInfo(q);

    // Warnings: one short line each by the launch button, the full sentence in its tooltip and for screen readers.
    const slots = q.missing.map((slot) => t.categories[slot as RequiredSlot] ?? text.slots[slot] ?? slot).join(', ');
    const list: { short: string; full: string }[] = [
      !q.complete && { short: fill(st.warnSlotsEmpty, { slots }), full: fill(t.slotsEmpty, { slots: q.missing.map((x) => text.slots[x] ?? x).join(', ') }) },
      !allowed && { short: st.warnBelowMinimum, full: t.belowMinimum },
      !q.tier && { short: st.warnOverTopTier, full: t.overTopTier },
      bayOver && { short: st.warnBayOverCapacity, full: t.bayOverCapacity },
      ...missingSupportPairs(q.payloadProblems, data),
      !q.canAfford && { short: fill(st.warnOverBudget, { amount: cash(-q.remaining) }), full: t.overBudget },
      q.overloaded && { short: st.warnOverloaded, full: t.chassisOverloaded },
    ].filter((w): w is { short: string; full: string } => Boolean(w));
    warnings.hidden = list.length === 0;
    warnings.replaceChildren(...list.map((w) => el('li', { title: w.full },
      el('span', { class: 'warn-mark', 'aria-hidden': 'true' }, '!'),
      el('span', { class: 'warn-text', 'aria-hidden': 'true' }, w.short),
      el('span', { class: 'visually-hidden' }, w.full))));
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

  // The top bar's key numbers (game-design.md, "the header reads at a glance"): the budget, and beside it in
  // the same style the pass mark for the next world, or on the last mission (Titan, which passes on survival)
  // the goal. The full sentences are each metric's tooltip and screen-reader text; after the Moon the budget's
  // also says where the balance came from.
  const h = t.header;
  const vars = missionVars(data);
  const campaign = text.campaign;
  const nextStep = nextMission(game.state.mission);
  const metric = (cls: string, label: string, value: string, sub: string, sentence: string): HTMLElement =>
    el('div', { class: `metric ${cls}`, title: sentence },
      el('span', { class: 'metric-label', 'aria-hidden': 'true' }, label),
      el('span', { class: 'metric-value', 'aria-hidden': 'true' }, el('strong', {}, value), sub ? el('span', { class: 'metric-sub' }, sub) : null),
      el('span', { class: 'visually-hidden' }, `${label} ${value}${sub ? ` ${sub}` : ''}. ${sentence}`));
  const balance = money(game.state.balance, text);
  const budgetMetric = metric('budget-metric', st.budgetLabel, balance, '',
    [h.budgetSentence, campaign ? fill(campaign.carryOver, { balance }) : ''].filter(Boolean).join(' '));
  let goalMetric: HTMLElement | null = null;
  if (nextStep && isPlayable(nextStep)) {
    const world = text.dashboard.worldShort[nextStep];
    const minimum = money(data.tuning.budget.minimumBudget[nextStep], text);
    goalMetric = metric('pass-metric', h.passMarkLabel, minimum, fill(h.passMarkFor, { world }),
      fill(campaign?.passMark ?? h.passMarkSentence, { minimum, world }));
  } else if (nextStep) {
    goalMetric = metric('goal-metric', h.goalLabel, fill(h.goalValue, vars), '', fill(campaign?.passMark ?? '', vars));
  }

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

  const head = el('header', { class: 'desk-head' },
    el('div', {},
      el('p', { class: 'title-kicker' }, text.story.kicker),
      el('h2', {}, t.heading),
    ),
    el('div', { class: 'desk-head-side' },
      help,
      notebookButton,
      el('div', { class: 'desk-metrics' }, budgetMetric, goalMetric),
    ),
  );
  // Palette | rover | specification. The sheet scrolls inside itself so the launch button stays in view.
  const sheetPanel = el('aside', { class: 'sheet', 'aria-label': t.sheetHeading },
    el('div', { class: 'sheet-scroll' },
      el('div', { class: 'spec-title' }, el('h2', {}, t.sheetHeading), remaining),
      sheet,
    ),
    el('div', { class: 'actions sheet-actions' }, warnings, next),
  );
  const grid = el('div', { class: 'desk-grid' }, palette.element, viewport, sheetPanel);

  // The notes: compact, so the desk fits one screen. The story shows two lines until "More" (the full text is
  // always in the page, so screen readers read all of it), with the not-offered notice as a small chip beside
  // "More". The mission brief sits right: Watch out and Science here, an icon and a few words per item, one
  // more sentence in each item's tooltip and screen-reader text.
  const notesToggle = el('button', {
    type: 'button',
    class: 'notes-toggle',
    'aria-expanded': 'false',
    'aria-controls': 'desk-notes',
    hidden: true,
    onclick: () => {
      const open = notes.classList.toggle('collapsed') === false;
      notesToggle.setAttribute('aria-expanded', String(open));
      notesToggle.textContent = open ? t.notesLess : t.notesMore;
    },
  }, t.notesMore);
  const b = t.brief;
  const briefGroup = (cls: string, heading: string, items: BriefItem[]) => el('section', { class: `brief-group ${cls}` },
    el('h3', { class: 'brief-heading' }, heading),
    el('ul', { class: 'brief-items' }, ...items.map((item) => {
      const tip = item.tip ? fill(item.tip, vars) : '';
      return el('li', { class: 'brief-item', title: tip || undefined },
        briefIcon(item.icon), el('span', {}, item.text), tip ? el('span', { class: 'visually-hidden' }, `. ${tip}`) : null);
    })));
  const notes = el('div', { class: 'desk-notes collapsed', id: 'desk-notes' },
    el('div', { class: 'desk-notes-main' },
      el('p', { class: 'story-site clamp' }, text.story.site), // why REL is going to this site
      el('div', { class: 'notes-row' },
        notesToggle,
        notOffered.length > 0 && el('p', { class: 'not-offered', role: 'status' },
          fill(t.notOffered, { parts: notOffered.map((p) => p.name).join(text.ticket.and) })),
      ),
    ),
    el('section', { class: 'desk-brief', 'aria-label': b.label },
      briefGroup('watch', b.watchHeading, b.watch),
      briefGroup('science', b.scienceHeading, b.science),
    ),
  );
  const desk = el('section', { class: 'desk' },
    // The top bar stays in view while the desk scrolls: title, help, notebook, budget and pass mark. The story and the brief sit below it.
    head,
    notes,
    grid,
    palette.card, // fixed beside its tile, over everything
  );
  root.append(desk);
  // Fit the desk to one screen: the columns take the height left under the header and the notes. On a short
  // screen (under MIN_GRID_PX left) the columns take the screen under the sticky header instead, and the
  // page scrolls past the notes. "More" shows only when a note is cut short.
  const fit = () => {
    const clamped = [...notes.querySelectorAll<HTMLElement>('.clamp')].some((p) => p.scrollHeight > p.clientHeight + 1);
    notesToggle.hidden = !clamped && notes.classList.contains('collapsed');
    const top = head.offsetHeight + 12;
    desk.style.setProperty('--desk-top', `${top}px`);
    // From the desk's own top (not the page's: #app centers a short desk), with #app's padding above and below.
    const gridTop = grid.getBoundingClientRect().top - desk.getBoundingClientRect().top;
    const left = window.innerHeight - 2 * APP_PADDING_PX - gridTop;
    const height = left >= MIN_GRID_PX ? left : Math.max(MIN_GRID_PX - 80, window.innerHeight - top - APP_PADDING_PX);
    desk.style.setProperty('--desk-col-h', `${Math.floor(height)}px`);
    queueFrame();
  };
  // On wide screens the preview fills the window behind the desk: frame the rover in the part the cards leave
  // clear (between the palette and the sheet, under the notes, to the window's bottom), and put the bay's glow
  // and the pick hint there too (style.css reads --clear-*). Below the breakpoint the preview is its own block
  // and frames the rover in all of it.
  const backgroundMedia = typeof window.matchMedia === 'function' ? window.matchMedia(PREVIEW_BACKGROUND_MEDIA) : null;
  function frameRover(): void {
    if (!preview || viewport.hidden) return;
    if (!backgroundMedia?.matches) {
      preview.setFrameArea(null);
      return;
    }
    const box = viewport.getBoundingClientRect();
    const from = palette.element.getBoundingClientRect().right;
    const to = sheetPanel.getBoundingClientRect().left;
    const top = Math.max(grid.getBoundingClientRect().top, head.getBoundingClientRect().bottom); // the notes scroll away on a short screen
    const area = { x: Math.round(from - box.left), y: Math.round(top - box.top), width: Math.round(to - from), height: Math.round(box.bottom - top) };
    viewport.style.setProperty('--clear-x', `${area.x}px`);
    viewport.style.setProperty('--clear-y', `${area.y}px`);
    viewport.style.setProperty('--clear-w', `${Math.max(0, area.width)}px`);
    viewport.style.setProperty('--clear-h', `${Math.max(0, area.height)}px`);
    preview.setFrameArea(area);
  }
  let frameQueued = 0;
  function queueFrame(): void {
    if (!frameQueued) frameQueued = requestAnimationFrame(() => {
      frameQueued = 0;
      if (!left) frameRover();
    });
  }
  const deskSize = new ResizeObserver(fit);
  deskSize.observe(head);
  deskSize.observe(notes);
  // The cards' widths (and the sheet's height) move the clear area; framing changes no layout, so no fit().
  const panelSize = new ResizeObserver(queueFrame);
  panelSize.observe(palette.element);
  panelSize.observe(sheetPanel);
  window.addEventListener('resize', fit);
  window.addEventListener('scroll', queueFrame, { passive: true });
  backgroundMedia?.addEventListener?.('change', queueFrame);
  update();
  fit(); // at once, not a frame later (the observers then follow font loads and the More toggle)
  if (!game.tutorialSeen.design) openHelp();
  return () => {
    left = true;
    thumbs.abort();
    deskSize.disconnect();
    panelSize.disconnect();
    if (frameQueued) cancelAnimationFrame(frameQueued);
    window.removeEventListener('resize', fit);
    window.removeEventListener('scroll', queueFrame);
    backgroundMedia?.removeEventListener?.('change', queueFrame);
    palette.dispose();
    preview?.dispose();
    preview = null;
    tutorial?.dispose();
    notebook?.dispose();
  };
};
