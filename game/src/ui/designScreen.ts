// The design screen ("the engineer's desk", game-design.md "The engineer's desk as a parts editor"): the
// parts palette on the left (deskPalette.ts: one part per required bus slot, and the payload bay's
// instruments and systems), the live 3D rover in the middle (buildPreview.ts), and the specification
// sheet on the right with the launch-ticket button.
// All numbers come from rules/ (quoteBuild); this file only lays them out.
import type { Screen } from '../flow/flow';
import { canStartMission, isPlayable, nextMission } from '../rules/campaign';
import { flatRangeM } from '../rules/energy';
import { quoteBuild, type BuildQuote } from '../rules/quote';
import { bayCapacity, instrumentCosts } from '../rules/payload';
import { chosenParts } from '../rules/rover';
import type { DraftBuild, Tier } from '../rules/types';
import type { BuildPreview } from './buildPreview';
import { categoryOfGroup, choosePart, mountPalette, partForGroup } from './deskPalette';
import { el, fill, money } from './dom';
import { costsText, titanSolar } from './partCard';
import { tierWhyText } from './tierText';
import { openTutorial, type TutorialHandle } from './tutorial';
import { openNotebook, type NotebookHandle } from './notebook';
import { missionVars, tutorialPages } from './tutorialText';
import { nightBudgetLine } from './marsMission';
import { missingSupportWarnings } from './supportText';

const KMH = 3.6;
/** Below this many pixels left for the columns under the notes, the columns take the screen under the header instead. */
const MIN_GRID_PX = 520;
/** #app's padding above and below the desk (style.css). */
const APP_PADDING_PX = 16;

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
    const instruments = (game.build.payload ?? []).flatMap((id) => partById(id) ?? []);
    const items = instruments.flatMap((part) => {
      const c = instrumentCosts([part])[0];
      const costs = c && costsText(c, data, false);
      return costs ? [fill(t.instrumentEnergyItem, { name: part.name, costs })] : [];
    });
    return items.length ? items.join('; ') : t.instrumentEnergyNone;
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
    const why = q.tierWhy;
    // A draft rover: driving numbers need the parts they come from.
    const has = (slot: keyof typeof game.build) => Boolean(game.build[slot]);
    const bayOver = q.payloadProblems.some((p) => p.kind === 'over-capacity');
    const dash = '—';
    const nightLine = nightBudgetLine(data, chosen); // Mars only (null on the Moon)

    sheet.replaceChildren(
      el('h3', {}, 'Cost'),
      row('Budget', money(game.state.balance, text)),
      row('Parts', money(q.cost, text)),
      row('Ticket', q.tier ? money(q.ticketPrice, text) : '—'),
      row('Total', money(q.totalCost, text), 'total'),
      row('Remaining', money(q.remaining, text), q.remaining < 0 ? 'bad' : 'good'),

      el('h3', {}, 'Mass and size'),
      row('Mass', `${q.mass} kg`, 'gauge-row'),
      tierGauge(q.mass, tiers.map((tier) => ({ tier, limit: tier.massLimit })), 'kg'),
      row('Size', `${q.size}`, 'gauge-row'),
      tierGauge(q.size, tiers.map((tier) => ({ tier, limit: tier.sizeLimit })), 'size units'),
      row('Chassis load', `${q.mass} / ${q.maxLoad ?? '—'} kg`, q.overloaded ? 'bad' : ''),
      row('Payload bay', `${q.pointsUsed} / ${q.mountingPoints ?? '—'} mounting points`, bayOver ? 'bad' : ''),

      el('h3', {}, 'Launch ticket'),
      row('Tier', q.tier ? `${q.tier.name}` : 'None fits', q.tier ? '' : 'bad'),
      el('p', { class: 'why' }, q.complete ? tierWhyText(why, text) : t.tierSoFar,
        q.complete && why.saving > 0 ? ` ${fill(t.tierSaving, { tier: why.exceeded!.tier.name, saving: money(why.saving, text) })}` : ''),

      el('h3', {}, 'Driving'),
      el('div', { class: 'row speed' },
        el('span', { class: 'label' }, 'Max speed'),
        el('span', { class: 'value' }, has('wheels') ? `${d.topSpeed.toFixed(1)} m/s (${(d.topSpeed * KMH).toFixed(0)} km/h)` : dash, infoButton),
      ),
      infoPanel,
      row('Grip', has('wheels') ? d.grip.toFixed(2) : dash),
      row('Drive energy', has('wheels') ? `${(d.energyPerMeter * 1000).toFixed(0)} energy/km` : dash),
      row('Range on battery', has('wheels') && has('battery') ? `${(flatRangeM(d.batteryCapacity, d.energyPerMeter) / 1000).toFixed(1)} km on flat ground` : dash),

      el('h3', {}, t.sheetEnergy),
      row('Battery', has('battery') ? `${d.batteryCapacity} energy` : dash),
      row('Solar income', has('power') ? (titanSolar(d.energyIncome, data) ?? `${d.energyIncome.toFixed(1)} energy/s in full sun`) : dash),
      row(t.instrumentEnergy, instrumentEnergyText()),
      ...(nightLine ? [row(nightLine.label, nightLine.value)] : []),
    );
    renderInfo(q);

    warnings.replaceChildren(
      ...[
        !q.complete && fill(t.slotsEmpty, { slots: q.missing.map((s) => text.slots[s] ?? s).join(', ') }),
        !allowed && t.belowMinimum,
        !q.tier && t.overTopTier,
        bayOver && t.bayOverCapacity,
        ...missingSupportWarnings(q.payloadProblems, data),
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

  // After the Moon (Mars, Titan): the balance carried over, the next pass mark (on Titan the survival
  // goal: it passes if the rover is still running at the end), and what the parts and tickets are for now
  // (Mars has its own; Titan's are the Moon's). Titan adds a plain warning that solar panels give almost no
  // power there.
  const mars = text.campaign;
  const nextStep = nextMission(game.state.mission);
  const transition = mars && el('p', { class: 'world-transition' }, el('span', { class: 'clamp' }, // the span clamps; the box keeps its padding
    fill(mars.carryOver, { balance: money(game.state.balance, text) }), ' ',
    nextStep && isPlayable(nextStep) ? fill(mars.passMark, { minimum: money(data.tuning.budget.minimumBudget[nextStep], text) })
      : nextStep ? fill(mars.passMark, missionVars(data)) : '', ' ',
    mars.sameParts,
  ));

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
      el('div', { class: 'budget' }, el('span', { class: 'label' }, 'Budget'), el('strong', {}, money(game.state.balance, text))),
    ),
  );
  // Palette | rover | specification. The sheet scrolls inside itself so the launch button stays in view.
  const grid = el('div', { class: 'desk-grid' },
    palette.element,
    viewport,
    el('aside', { class: 'sheet', 'aria-label': t.sheetHeading },
      el('div', { class: 'sheet-scroll' },
        el('h2', {}, t.sheetHeading),
        sheet,
        warnings,
      ),
      el('div', { class: 'actions sheet-actions' }, next),
    ),
  );

  // The notes: compact, so the desk fits one screen. The story and the carry-over show two lines each until
  // "More" (the full text is always in the page, so screen readers read all of it); the not-offered notice
  // and Titan's solar note always show in full.
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
  const notes = el('div', { class: 'desk-notes collapsed', id: 'desk-notes' },
    el('div', { class: 'desk-notes-main' },
      el('p', { class: 'story-site clamp' }, text.story.site), // why REL is going to this site
      el('p', { class: 'muted' }, t.tutorial),
    ),
    el('div', { class: 'desk-notes-side' },
      transition,
      notOffered.length > 0 && el('p', { class: 'world-transition not-offered', role: 'status' },
        fill(t.notOffered, { parts: notOffered.map((p) => p.name).join(text.ticket.and) })),
      text.titanCampaign && el('p', { class: 'world-transition world-warning' }, text.titanCampaign.solarNote),
    ),
    notesToggle,
  );
  const desk = el('section', { class: 'desk' },
    // The top bar stays in view while the desk scrolls: title, help, notebook and balance. The longer notes sit below it.
    head,
    notes,
    grid,
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
  };
  const deskSize = new ResizeObserver(fit);
  deskSize.observe(head);
  deskSize.observe(notes);
  window.addEventListener('resize', fit);
  update();
  fit(); // at once, not a frame later (the observers then follow font loads and the More toggle)
  if (!game.tutorialSeen.design) openHelp();
  return () => {
    left = true;
    thumbs.abort();
    deskSize.disconnect();
    window.removeEventListener('resize', fit);
    palette.dispose();
    preview?.dispose();
    preview = null;
    tutorial?.dispose();
    notebook?.dispose();
  };
};
