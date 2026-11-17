// The desk's parts palette (game-design.md, "The engineer's desk as a parts editor"): a row of category
// tabs (Frame, Wheels, Power, Battery: one part each; Payload: instruments and systems, with the mounting
// points), and a tile per part of the open category, with its rendered thumbnail (partThumbs.ts) once it
// is ready. Clicking a tile fits it; hovering or focusing it shows its card (partCard.ts). Blocked tiles
// are dimmed: a full bay and a missing arm or mast refuse the click; a part the budget cannot cover is
// marked but can still be fitted. The pure helpers at the top decide; the rest only lays them out.
import { quoteBuild } from '../rules/quote';
import {
  bayCapacity, bayParts, fitBayToChassis, fitRefusal, instrumentKeys, isFitted, pointsUsed, toggleBayPart, type FitRefusal,
} from '../rules/payload';
import { requiredSlots, slotPartId, withSlotPart } from '../rules/rover';
import type { BusSlot, DraftBuild, GameData, Part, PartsFile, RequiredSlot, SupportSlot, SystemSlot } from '../rules/types';
import type { ModelGroup } from '../rover/roverModel';
import { el, fill } from './dom';
import { cardContent, createHoverCard, type CardState } from './partCard';
import { needsText } from './supportText';

/** A palette category: one of the four required bus slots, or the payload (instruments and systems). */
export type Category = RequiredSlot | 'payload';

const REQUIRED_SLOTS: readonly RequiredSlot[] = ['chassis', 'wheels', 'power', 'battery'];
const REQUIRED: readonly string[] = REQUIRED_SLOTS;
/** The model groups that are slots (the rest are instruments). */
const SLOT_GROUPS: readonly string[] = [...REQUIRED_SLOTS, 'lights', 'heater', 'arm', 'mast'] satisfies (BusSlot | SupportSlot)[];

/** The category a part sits in on the palette. */
export function categoryOf(part: Part): Category {
  return REQUIRED.includes(part.slot) ? (part.slot as RequiredSlot) : 'payload';
}

/** The category of a model group the player clicked on the 3D rover: a required bus slot, else the payload. */
export function categoryOfGroup(group: ModelGroup): Category {
  return REQUIRED.includes(group) ? (group as RequiredSlot) : 'payload';
}

/** The part the build has in a clicked model group (its slot's part, or the bay's part giving that instrument). */
export function partForGroup(group: ModelGroup, build: DraftBuild, catalog: PartsFile): string | undefined {
  if (SLOT_GROUPS.includes(group)) return slotPartId(build, group as BusSlot | SupportSlot);
  return (build.payload ?? []).find((id) => catalog.parts.find((p) => p.id === id)?.effects.instrument === group);
}

/** The category the desk opens on: the first required category still empty (Frame on a new build), else the payload. */
export function startCategory(build: DraftBuild, catalog: PartsFile): Category {
  return requiredSlots(catalog).find((slot) => !slotPartId(build, slot)) ?? 'payload';
}

/** Is this part on the build now: the part in its required slot, or fitted in the payload? */
export function isChosen(build: DraftBuild, part: Part, catalog: PartsFile): boolean {
  return categoryOf(part) === 'payload' ? isFitted(build, part.id, catalog) : slotPartId(build, part.slot as RequiredSlot) === part.id;
}

/**
 * What clicking a tile does: a required part replaces its slot's part (a chassis with fewer mounting points
 * drops the instruments fitted last); a payload item is fitted or taken off (toggleBayPart: a refused fit
 * changes nothing). Returns the new build and the dropped instrument ids. Pure.
 */
export function choosePart(build: DraftBuild, part: Part, catalog: PartsFile): { build: DraftBuild; dropped: string[] } {
  if (categoryOf(part) === 'payload') return { build: toggleBayPart(build, part.id, catalog), dropped: [] };
  const next = withSlotPart(build, part.slot as RequiredSlot, part.id);
  return part.slot === 'chassis' ? fitBayToChassis(next, catalog) : { build: next, dropped: [] };
}

/** The build with this part on it, whether or not the bay would take it now (to price it). Pure. */
export function buildWithPart(build: DraftBuild, part: Part, catalog: PartsFile): DraftBuild {
  if (categoryOf(part) !== 'payload') return choosePart(build, part, catalog).build;
  if (isFitted(build, part.id, catalog)) return build;
  if (part.slot === 'instrument') return { ...build, payload: [...(build.payload ?? []), part.id] };
  return withSlotPart(build, part.slot as SystemSlot, part.id);
}

/**
 * Would fitting this part take the build's total cost (parts and ticket) over the budget? Only a part
 * that raises the total is marked: one already on the build, or a cheaper swap, never is (an over-budget
 * player needs exactly those).
 */
export function overBudget(build: DraftBuild, part: Part, data: GameData, balance: number): boolean {
  if (isChosen(build, part, data.parts)) return false;
  const now = quoteBuild(build, data, balance).totalCost;
  const after = quoteBuild(buildWithPart(build, part, data.parts), data, balance).totalCost;
  return after > balance && after > now;
}

/**
 * What a click on a tile does. A touch tap on a tile whose card is not showing opens its card first (touch
 * has no hover), and a second tap fits it; a mouse click or a key press fits at once.
 */
export function tapAction(pointerType: string, cardShowsThisTile: boolean): 'card' | 'fit' {
  return pointerType === 'touch' && !cardShowsThisTile ? 'card' : 'fit';
}

// --- The palette ---

export interface PaletteOptions {
  data: GameData;
  balance: number;
  getBuild(): DraftBuild;
  /** A tile was clicked (and not refused). */
  onChoose(part: Part): void;
}

export interface Palette {
  element: HTMLElement;
  /**
   * The hover card. It is fixed-positioned, so it goes outside the palette (whose blurred, see-through
   * background would otherwise be its containing block and clip it): the caller appends it beside the palette.
   */
  card: HTMLElement;
  /** Every part on the palette, in palette order (for the thumbnails). */
  parts: Part[];
  /** Redraw every tile's and tab's state from the build; `notice` is the bay's last notice (instruments dropped). */
  update(notice: string): void;
  /** Open a category; with `partId`, focus or flash that part's tile. */
  open(category: Category, partId?: string): void;
  /** A part's thumbnail is ready. */
  setThumb(partId: string, url: string): void;
  dispose(): void;
}

interface Tile {
  part: Part;
  button: HTMLButtonElement;
  thumb: HTMLElement;
  key: HTMLElement;
  badge: HTMLElement;
  /** The tile's state in words for screen readers (fitted, key, blocked, over budget): always in its description. */
  status: HTMLElement;
  state: CardState;
}

/** The palette: category tabs and their tile panels. */
export function mountPalette(opts: PaletteOptions): Palette {
  const { data } = opts;
  const t = data.text.design;
  const catalog = data.parts;
  const categories: Category[] = [...requiredSlots(catalog), 'payload'];
  const card = createHoverCard('desk-part-card');
  const tiles = new Map<string, Tile>();
  const byCategory = new Map<Category, Tile[]>();
  const active = new Map<Category, string>(); // the tile of each category that takes Tab (roving tabindex)
  let current: Category = startCategory(opts.getBuild(), catalog);

  const showCard = (tile: Tile) => card.show(tile.button, cardContent(tile.part, tile.state, data));
  /** The tile with keyboard focus (focus-visible: not one focused by a mouse click or a tap), if any. */
  const keyboardTile = (): Tile | undefined => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || !focused.matches('.part-tile:focus-visible')) return undefined;
    return tiles.get(focused.dataset.part ?? '');
  };
  let pointerType = ''; // the pointer of the press that leads to the next click ('' for a key press)

  const makeTile = (part: Part): Tile => {
    const thumb = el('span', { class: 'tile-thumb', 'aria-hidden': 'true' });
    const key = el('span', { class: 'tile-key', 'aria-hidden': 'true' });
    const badge = el('span', { class: 'tile-badge', 'aria-hidden': 'true' });
    const statusId = `desk-tile-status-${part.id}`;
    const status = el('span', { class: 'visually-hidden', id: statusId });
    const button = el('button', {
      type: 'button',
      class: 'part-tile',
      'aria-label': part.name,
      'aria-pressed': 'false',
      'aria-describedby': statusId,
      tabindex: '-1',
      'data-part': part.id,
    },
    thumb,
    el('span', { class: 'tile-name' }, part.name),
    el('span', { class: 'tile-check', 'aria-hidden': 'true' }, '✓'),
    key,
    badge,
    status,
    );
    const tile: Tile = { part, button, thumb, key, badge, status, state: { fitted: false, overBudget: false, bay: categoryOf(part) === 'payload' } };
    button.addEventListener('pointerdown', (e) => {
      pointerType = e.pointerType;
    });
    button.addEventListener('click', (e) => {
      // A key press (detail 0) fits; a touch tap first shows the card (tapAction).
      if (e.detail > 0 && tapAction(pointerType, card.owner === button) === 'card') {
        showCard(tile);
        return;
      }
      if (button.getAttribute('aria-disabled') === 'true') return;
      opts.onChoose(part);
    });
    // Hover is the mouse's (touch fires no pointerenter of type mouse); focus shows the card only from the keyboard.
    button.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') showCard(tile);
    });
    button.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      const kb = keyboardTile();
      if (kb) showCard(kb); // back to the tile the keyboard is on
      else card.hide(button);
    });
    button.addEventListener('focus', () => {
      setActive(categoryOf(part), part.id);
      if (button.matches(':focus-visible')) showCard(tile);
    });
    button.addEventListener('blur', () => card.hide(button));
    tiles.set(part.id, tile);
    const list = byCategory.get(categoryOf(part)) ?? [];
    list.push(tile);
    byCategory.set(categoryOf(part), list);
    return tile;
  };

  const grid = (parts: Part[], labelledBy?: string) =>
    el('div', { class: 'tile-grid', role: 'group', 'aria-labelledby': labelledBy }, ...parts.map((p) => makeTile(p).button));

  // The payload panel's head: the mounting points as sockets and in words.
  const sockets = el('span', { class: 'bay-sockets', 'aria-hidden': 'true' });
  const counter = el('span', { class: 'bay-counter' });
  const notice = el('p', { class: 'bay-notice', role: 'status' });

  const bay = bayParts(catalog);
  const instruments = bay.filter((p) => p.slot === 'instrument');
  const systems = bay.filter((p) => p.slot !== 'instrument');
  const panels = new Map<Category, HTMLElement>();
  const tabs = new Map<Category, { button: HTMLButtonElement; value: HTMLElement }>();
  for (const cat of categories) {
    const panel = el('div', { class: 'palette-panel', role: 'tabpanel', id: `desk-panel-${cat}`, 'aria-labelledby': `desk-tab-${cat}` });
    if (cat === 'payload') {
      panel.append(
        el('p', { class: 'bay-head' }, sockets, counter),
        el('h3', { class: 'palette-group', id: 'desk-group-instruments' }, t.groupInstruments),
        grid(instruments, 'desk-group-instruments'),
        ...(systems.length ? [el('h3', { class: 'palette-group', id: 'desk-group-systems' }, t.groupSystems), grid(systems, 'desk-group-systems')] : []),
        el('p', { class: 'bay-hint muted' }, t.bayHint),
      );
    } else {
      panel.append(grid(catalog.parts.filter((p) => p.slot === cat)));
    }
    panels.set(cat, panel);
    const value = el('span', { class: 'tab-value' });
    const button = el('button', {
      type: 'button',
      role: 'tab',
      class: 'palette-tab',
      id: `desk-tab-${cat}`,
      'aria-controls': `desk-panel-${cat}`,
      onclick: () => open(cat),
    }, el('span', { class: 'tab-name' }, t.categories[cat]), value);
    tabs.set(cat, { button, value });
  }

  const tablist = el('div', { class: 'palette-tabs', role: 'tablist', 'aria-label': t.paletteLabel, 'aria-orientation': 'horizontal' },
    ...categories.map((c) => tabs.get(c)!.button));
  const element = el('div', { class: 'palette' }, tablist, ...categories.map((c) => panels.get(c)!), notice);

  // Keyboard: left and right move between tabs (and open them); in a panel, arrows move between tiles (up and
  // down by row), Home and End jump; Enter and Space fit (the button's own). Escape (anywhere) hides the card.
  tablist.addEventListener('keydown', (e) => {
    const i = categories.indexOf(current);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: categories.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const cat = categories[(to + categories.length) % categories.length]!;
    open(cat);
    tabs.get(cat)!.button.focus();
  });
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') card.hide();
  };
  document.addEventListener('keydown', onEscape);
  // The card is fixed beside its tile: scrolling (the palette or the page) would leave it behind, so it goes,
  // unless the keyboard is on a tile still wholly in view (focusing a tile can scroll the palette): then it follows.
  const hideCard = () => {
    const kb = keyboardTile();
    const r = kb?.button.getBoundingClientRect();
    const view = element.getBoundingClientRect(); // the palette clips its tiles when it scrolls on its own
    const top = Math.max(0, view.top);
    const bottom = Math.min(window.innerHeight, view.bottom);
    if (kb && r && r.top >= top - 1 && r.bottom <= bottom + 1) showCard(kb);
    else card.hide();
  };
  element.addEventListener('scroll', hideCard, { passive: true });
  window.addEventListener('scroll', hideCard, { passive: true });
  // A tap anywhere but on a tile closes a card opened by a tap.
  const onPointerDown = (e: PointerEvent) => {
    if (!(e.target instanceof Element && e.target.closest('.part-tile'))) {
      pointerType = e.pointerType;
      card.hide();
    }
  };
  document.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('keydown', (e) => {
    pointerType = '';
    const from = (e.target as HTMLElement).closest('.part-tile');
    if (!from) return;
    const list = byCategory.get(current) ?? [];
    const i = list.findIndex((x) => x.button === from);
    if (i < 0) return;
    let to: Tile | undefined;
    if (e.key === 'ArrowRight') to = list[i + 1];
    else if (e.key === 'ArrowLeft') to = list[i - 1];
    else if (e.key === 'Home') to = list[0];
    else if (e.key === 'End') to = list[list.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') to = rowNeighbour(list, i, e.key === 'ArrowDown' ? 1 : -1);
    else return;
    e.preventDefault();
    to?.button.focus();
  });

  /** The tile in the next (or previous) row nearest across, or the next in order when the tiles do not lay out (no layout). */
  function rowNeighbour(list: Tile[], i: number, dir: 1 | -1): Tile | undefined {
    const r = list[i]!.button.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const rows = list
      .map((x) => ({ x, r: x.button.getBoundingClientRect() }))
      .filter(({ r: o }) => (dir > 0 ? o.top >= r.bottom - 1 : o.bottom <= r.top + 1));
    if (rows.length === 0) return undefined;
    const rowTop = dir > 0 ? Math.min(...rows.map((o) => o.r.top)) : Math.max(...rows.map((o) => o.r.top));
    return rows
      .filter((o) => Math.abs(o.r.top - rowTop) < 2)
      .sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0]?.x;
  }

  /** Remember the tile the player last focused (or picked on the rover) in a category, and give it the Tab stop. */
  function setActive(cat: Category, id: string): void {
    active.set(cat, id);
    applyTabStop(cat, id);
  }

  function applyTabStop(cat: Category, id: string): void {
    for (const tile of byCategory.get(cat) ?? []) tile.button.tabIndex = tile.part.id === id ? 0 : -1;
  }

  /** The tile that takes Tab in a category: the last focused, else the first chosen, else the first. */
  function defaultActive(cat: Category): string | undefined {
    const list = byCategory.get(cat) ?? [];
    const kept = active.get(cat);
    if (kept && list.some((x) => x.part.id === kept)) return kept;
    return (list.find((x) => x.state.fitted) ?? list[0])?.part.id;
  }

  let flashTimer = 0;
  let flashed: HTMLElement | null = null;

  function open(cat: Category, partId?: string): void {
    current = cat;
    card.hide();
    for (const c of categories) {
      const selected = c === cat;
      panels.get(c)!.hidden = !selected;
      const tab = tabs.get(c)!.button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (partId && tiles.has(partId)) setActive(cat, partId);
    else {
      const id = defaultActive(cat);
      if (id) applyTabStop(cat, id);
    }
    const tile = partId ? tiles.get(partId) : undefined;
    if (tile) {
      // Into view: inside the palette on wide screens, and on the page when the palette stacks above the rover.
      tile.button.scrollIntoView({ block: 'nearest' });
      card.hide(); // the scroll may have moved things
      flashed?.classList.remove('flash');
      window.clearTimeout(flashTimer);
      void tile.button.offsetWidth; // restart the flash
      tile.button.classList.add('flash');
      flashed = tile.button;
      flashTimer = window.setTimeout(() => tile.button.classList.remove('flash'), 900);
    }
  }

  function refusalText(r: FitRefusal): string {
    return r.kind === 'full' ? t.bayFull : needsText(r.support, data) ?? '';
  }

  function update(bayNotice: string): void {
    const build = opts.getBuild();
    // The same mission keys as in the mission (rules/payload instrumentKeys), from the bay's instruments in bay order.
    const keys = instrumentKeys((build.payload ?? []).flatMap((id) => catalog.parts.find((p) => p.id === id) ?? []));
    for (const tile of tiles.values()) {
      const { part, button } = tile;
      const fitted = isChosen(build, part, catalog);
      // A full bay, or an instrument whose support part is not fitted, refuses the tile (a fitted item can always come out).
      const refusal = tile.state.bay && !fitted ? fitRefusal(build, part.id, catalog) : null;
      const over = overBudget(build, part, data, opts.balance);
      const key = fitted && part.effects.instrument ? keys.get(part.effects.instrument) : undefined;
      tile.state = { fitted, key, refusal: refusal ? refusalText(refusal) : undefined, overBudget: over, bay: tile.state.bay };
      button.setAttribute('aria-pressed', String(fitted));
      button.classList.toggle('fitted', fitted);
      button.classList.toggle('blocked', refusal !== null);
      button.classList.toggle('over-budget', over);
      if (refusal) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
      tile.key.textContent = key ? fill(t.bayKey, { key }) : '';
      tile.badge.textContent = refusal ? (refusal.kind === 'full' ? t.badgeFull : t.badgeNeeds) : over ? t.badgeOverBudget : '';
      tile.status.textContent = [fitted && t.tileFitted, tile.key.textContent, tile.badge.textContent].filter(Boolean).join('. ');
    }
    // The tabs: a check on each required category with a part (an amber dot while empty; the part's name is
    // in the tooltip and the accessible name), and the payload's points.
    for (const slot of requiredSlots(catalog)) {
      const id = slotPartId(build, slot);
      const name = id ? catalog.parts.find((p) => p.id === id)?.name : undefined;
      const { button, value } = tabs.get(slot)!;
      const label = `${t.categories[slot]}: ${name ?? t.slotEmpty}`;
      button.classList.toggle('empty', !name);
      value.replaceChildren(el('span', { class: name ? 'tab-check' : 'tab-dot', 'aria-hidden': 'true' }, name ? '✓' : '●'));
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    const used = pointsUsed(build, catalog);
    const capacity = bayCapacity(build, catalog);
    const payloadTab = tabs.get('payload')!;
    payloadTab.value.textContent = capacity.chassis ? fill(t.tabPoints, { used, points: capacity.points }) : '';
    const payloadLabel = capacity.chassis ? `${t.categories.payload}: ${fill(t.bayPoints, { used, points: capacity.points })}` : t.categories.payload;
    payloadTab.button.setAttribute('aria-label', payloadLabel);
    payloadTab.button.title = payloadLabel;
    counter.textContent = capacity.chassis ? fill(t.bayPoints, { used, points: capacity.points }) : t.bayNoChassis;
    sockets.replaceChildren(...Array.from({ length: capacity.chassis ? capacity.points : 0 }, (_, i) => el('span', { class: `socket${i < used ? ' filled' : ''}` })));
    notice.textContent = bayNotice;
    notice.hidden = !bayNotice;
    // Keep Tab on a tile of the open category, and the card in step with its tile.
    const id = defaultActive(current);
    if (id) applyTabStop(current, id);
    const owner = card.owner && [...tiles.values()].find((x) => x.button === card.owner);
    if (owner) showCard(owner);
  }

  open(current);

  return {
    element,
    card: card.element,
    parts: [...categories.flatMap((c) => (byCategory.get(c) ?? []).map((x) => x.part))],
    update,
    open,
    setThumb(partId, url) {
      const tile = tiles.get(partId);
      if (!tile) return;
      tile.thumb.replaceChildren(el('img', { src: url, alt: '', draggable: 'false' }));
    },
    dispose() {
      window.clearTimeout(flashTimer);
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', hideCard);
      card.hide();
    },
  };
}
