// The desk's part card (game-design.md, "The engineer's desk as a parts editor"): the text a part shows
// when its palette tile is hovered or focused (name, description, cost, mass, size, key effect, energy,
// "Can earn" and "Where", needs, and why it cannot be fitted now), and the one floating card that shows it
// beside the tile. The words are the old option cards' words; nothing here is a rule.
import { gameSpeed } from '../rules/drive';
import { instrumentCosts, type InstrumentCosts } from '../rules/payload';
import type { GameData, Part } from '../rules/types';
import { el, fill, money } from './dom';
import { deskCardNotes } from './milestoneText';
import { needsText } from './supportText';

/** An instrument's operating costs as text ("10 energy per use, holds the rover 3 s"), or null when it has none. */
export function costsText(c: InstrumentCosts, data: GameData, withHold: boolean): string | null {
  const t = data.text.design;
  const items = [
    c.energyPerUse > 0 && fill(t.energyPerUse, { energy: c.energyPerUse }),
    c.standbyEnergy > 0 && fill(t.energyStandby, { energy: c.standbyEnergy }),
    withHold && c.useSeconds > 0 && fill(t.useHold, { seconds: c.useSeconds }),
  ].filter((x): x is string => Boolean(x));
  return items.length ? items.join(', ') : null;
}

/** Titan: a panel's solar income at Titan (the Moon rate times the Titan solar factor), or null elsewhere. */
export function titanSolar(income: number, data: GameData): string | null {
  const factor = data.tuning.titanPower?.solarFactor;
  const t = data.text.titanCampaign;
  if (factor === undefined || !t) return null;
  return fill(t.solarIncome, { income: Number((income * factor).toPrecision(1)) });
}

/** The one number that matters most for each part, shown on its card. */
export function keyEffect(part: Part, data: GameData): string | null {
  const e = part.effects;
  switch (part.slot) {
    case 'chassis':
      return e.maxLoad !== undefined ? `Max load ${e.maxLoad} kg · ${e.mountingPoints ?? 0} mounting points` : null;
    case 'wheels':
      return e.baseSpeed !== undefined
        ? `Top speed ${gameSpeed(e.baseSpeed, data.tuning.speed).toFixed(1)} m/s · grip ${(e.grip ?? 0).toFixed(2)}`
        : null;
    case 'power':
      if (e.steadyIncome) return `Steady income ${e.steadyIncome.toFixed(1)} energy/s, day and night`;
      if (e.energyIncome === undefined) return null;
      return titanSolar(e.energyIncome, data) ?? `Solar income ${e.energyIncome.toFixed(1)} energy/s`;
    case 'battery':
      return e.batteryCapacity !== undefined ? `Capacity ${e.batteryCapacity} energy` : null;
    case 'lights':
      return e.lightRange ? `Light range ${e.lightRange} m` : null;
    case 'heater':
      return e.heat ? `Heat output ${e.heat}${e.heaterDraw ? ` · draws ${e.heaterDraw} energy/s every night` : ''}` : null;
    case 'arm':
    case 'mast':
      return null; // support hardware: the description says what it carries
    case 'instrument': {
      // The description says what the instrument does; the card adds what it costs to run.
      const c = instrumentCosts([part])[0];
      return c ? costsText(c, data, true) : null;
    }
  }
}

/** Where a tile stands now, for its card: fitted (with its mission key), or why it cannot be fitted. */
export interface CardState {
  fitted: boolean;
  /** The instrument's mission key when it is in the bay. */
  key?: number;
  /** Why the click is refused (a full bay, missing support), already worded. */
  refusal?: string;
  /** Fitting it would take the total cost over the budget (marked, still allowed). */
  overBudget: boolean;
  /** A payload item: a fitted one comes off with a second click. */
  bay: boolean;
}

/** The card's content for a part in a state. */
export function cardContent(part: Part, state: CardState, data: GameData): HTMLElement[] {
  const { text } = data;
  const t = text.design;
  const effect = keyEffect(part, data);
  const needs = part.effects.needs && needsText(part.effects.needs, data);
  const stateLines = [
    state.fitted && el('p', { class: 'part-card-state fitted' },
      state.bay ? t.cardFitted : t.tileFitted,
      state.key ? ` ${fill(t.bayKey, { key: state.key })}` : ''),
    // A missing arm or mast is already the needs line (shown as the reason below); other refusals get their own.
    state.refusal && state.refusal !== needs && el('p', { class: 'part-card-state blocked' }, state.refusal),
    state.overBudget && el('p', { class: 'part-card-state blocked' }, t.cardOverBudget),
  ].filter((x): x is HTMLParagraphElement => Boolean(x));
  return [
    el('p', { class: 'part-card-name' }, part.name),
    ...(part.description ? [el('p', { class: 'part-card-desc' }, part.description)] : []),
    el('p', { class: 'part-card-stats' },
      el('span', {}, money(part.cost, text)),
      el('span', {}, `${part.mass} kg`),
      el('span', {}, `size ${part.size}`),
    ),
    ...(effect ? [el('p', { class: 'part-card-effect' }, effect)] : []),
    // What the instrument can earn here, by milestone name only (M14), and on Mars where it is used.
    ...(part.effects.instrument ? deskCardNotes(part.effects.instrument, data).map((note) => el('p', { class: 'part-card-note' }, note)) : []),
    ...(needs ? [el('p', { class: state.refusal === needs ? 'part-card-state blocked' : 'part-card-note' }, needs)] : []),
    ...stateLines,
  ];
}

export interface HoverCard {
  element: HTMLElement;
  /** Show the card for this tile, beside it; the tile is described by the card (as well as its own status) while it shows. */
  show(tile: HTMLElement, content: HTMLElement[]): void;
  /** Hide the card (if `tile` is given, only when the card belongs to that tile). */
  hide(tile?: HTMLElement): void;
  /** The tile the card is showing for, if any. */
  readonly owner: HTMLElement | null;
}

const GAP = 10; // px between the tile and the card
const EDGE = 8; // px kept clear of the viewport edge

/**
 * Where to put a card of this size beside a tile without covering it, kept in the viewport: right of the
 * tile if it fits, else left, else below, else above (clamped to the viewport either way). Pure.
 */
export function placeCard(
  tile: { left: number; top: number; right: number; bottom: number },
  card: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, view.width - card.width - EDGE));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, view.height - card.height - EDGE));
  if (tile.right + GAP + card.width <= view.width - EDGE) return { left: tile.right + GAP, top: clampY(tile.top) };
  if (tile.left - GAP - card.width >= EDGE) return { left: tile.left - GAP - card.width, top: clampY(tile.top) };
  if (tile.bottom + GAP + card.height <= view.height - EDGE) return { left: clampX(tile.left), top: tile.bottom + GAP };
  return { left: clampX(tile.left), top: clampY(tile.top - GAP - card.height) };
}

/** The one floating hover card of the desk. Fixed-positioned, never takes the pointer. */
export function createHoverCard(id: string): HoverCard {
  const element = el('div', { class: 'part-card', id, role: 'tooltip', hidden: true });
  let owner: HTMLElement | null = null;
  // The card's id joins (and leaves) the tile's own aria-describedby list, which keeps the tile's status.
  const describe = (tile: HTMLElement, on: boolean) => {
    const ids = (tile.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
    if (on) ids.push(id);
    if (ids.length) tile.setAttribute('aria-describedby', ids.join(' '));
    else tile.removeAttribute('aria-describedby');
  };
  const hide = (tile?: HTMLElement) => {
    if (tile && tile !== owner) return;
    if (owner) describe(owner, false);
    owner = null;
    element.hidden = true;
  };
  return {
    element,
    get owner() {
      return owner;
    },
    show(tile, content) {
      if (owner && owner !== tile) describe(owner, false);
      owner = tile;
      element.replaceChildren(...content);
      element.hidden = false;
      describe(tile, true);
      const r = tile.getBoundingClientRect();
      const { left, top } = placeCard(r, { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
    },
    hide,
  };
}
