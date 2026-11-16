// The engineering notebook (rover-engineering-design.md, section 10): the relationships discovered so
// far on the current world, each with what happens and why, the ways to solve it, and the real mission
// behind it.
// Undiscovered lessons show only as a count, never by name. A modal overlay, opened from the title
// screen, the desk, and the mission (which pauses while it is open): the rest of the screen is inert,
// focus stays inside, and Escape (or the notebook key) closes it. Keys the overlay does not handle
// are kept from the screen's own listeners but keep their default action: Space activates the focused
// button and the arrow keys scroll the dialog.
import type { GameData } from '../rules/types';
import { notebookView } from '../rules/relationships';
import { el, fill } from './dom';

export interface NotebookHandle {
  readonly root: HTMLElement;
  /** Close as the player would (runs onClose). */
  close(): void;
  /** Remove without running onClose, for a screen that is being torn down. */
  dispose(): void;
}

export interface NotebookOptions {
  ids: readonly string[]; // the relationship ids discovered, in the order discovered
  newIds?: readonly string[]; // discovered this mission, not yet in the campaign notebook: marked "New"
  closeKey?: string; // a KeyboardEvent.code that also closes it (the mission's notebook key)
  onClose?: () => void;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open the notebook over `host` (the screen root). Overlay: div.notebook-overlay; dialog: section.notebook#notebook-dialog. */
export function openNotebook(host: HTMLElement, data: GameData, opts: NotebookOptions): NotebookHandle {
  const t = data.text.notebook;
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const { entries, total } = notebookView(opts.ids, data.relationships, data.world); // the current world's lessons only
  const fresh = new Set(opts.newIds ?? []);
  let closed = false;

  const closeButton = el('button', { type: 'button', class: 'primary notebook-close', onclick: () => close() }, t.close);
  const headClose = el('button', { type: 'button', class: 'notebook-close-top', onclick: () => close() }, t.close);
  const dialog = el('section', {
    class: 'notebook',
    tabindex: '-1',
    id: 'notebook-dialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'notebook-title',
  },
    el('div', { class: 'notebook-head' },
      el('h2', { id: 'notebook-title' }, t.heading),
      total > 0 && el('span', { class: 'notebook-count' }, fill(t.count, { found: entries.length, total })), // none yet: no count
      headClose,
    ),
    el('p', { class: 'muted' }, entries.length ? t.intro : t.empty),
    entries.length > 0 && el('ul', { class: 'notebook-entries' },
      ...entries.map(({ id, entry, lesson }) => el('li', { 'data-relationship': id },
        el('h3', {}, entry.name, fresh.has(id) && el('span', { class: 'badge' }, t.newBadge)),
        el('p', {}, lesson.debrief),
        el('p', { class: 'sub' }, t.answers),
        el('ul', { class: 'answers' }, ...lesson.answers.map((a) => el('li', {}, a))),
        entry.fact && el('p', { class: 'fact' }, entry.fact),
        entry.source && el('p', { class: 'note' }, fill(t.source, { source: entry.source })),
      )),
    ),
    el('div', { class: 'notebook-actions' }, el('span', { class: 'note' }, t.closeHint), closeButton),
  );
  const root = el('div', { class: 'notebook-overlay' }, dialog);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (opts.closeKey && e.code === opts.closeKey && !e.repeat)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    } else {
      // The screen's own keys (driving, instruments) do nothing while the notebook is open. Only the
      // propagation stops: the browser's default (Space on a button, arrows scrolling) still runs.
      e.stopImmediatePropagation();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => e.stopImmediatePropagation();
  // Capture phase, so the screen's own key handlers never see these keys while the notebook is open.
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);

  const others = [...host.children].filter((n): n is HTMLElement => n instanceof HTMLElement && !n.inert);
  for (const n of others) n.inert = true;
  host.append(root);
  dialog.focus({ preventScroll: true }); // opens at the top, not at the Close button below the entries
  dialog.scrollTop = 0;

  function teardown(): boolean {
    if (closed) return false;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    for (const n of others) n.inert = false;
    root.remove();
    return true;
  }

  function close(): void {
    if (!teardown()) return;
    if (returnFocus?.isConnected) returnFocus.focus();
    opts.onClose?.();
  }

  return { root, close, dispose: () => void teardown() };
}
