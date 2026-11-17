// The tutorial dialog: a few short pages with Back / Next / Skip tutorial / Done. Modal: the rest of the
// screen is inert while it is open, focus stays inside, Escape closes it and Enter goes to the next page.
import type { TextFile } from '../rules/types';
import type { TutorialId } from '../save/tutorialSeen';
import { el, fill } from './dom';
import type { TutorialBlockText, TutorialInstrumentText, TutorialKeyText, TutorialPageText } from './tutorialText';

/** Text with its **bold** spans as <strong>. */
function spans(text: string): (string | HTMLElement)[] {
  return text.split('**').map((part, i) => (i % 2 === 1 ? el('strong', {}, part) : part));
}

/** One block of a page: a paragraph, a subheading, a list or a table. */
function block(b: TutorialBlockText): HTMLElement {
  switch (b.kind) {
    case 'h':
      return el('h3', { class: 'tutorial-subhead' }, ...spans(b.text));
    case 'list':
      return el('ul', { class: 'tutorial-list' }, ...b.items.map((item) => el('li', {}, ...spans(item))));
    case 'table':
      return el('table', { class: 'tutorial-table' },
        el('thead', {}, el('tr', {}, ...b.head.map((c) => el('th', { scope: 'col' }, ...spans(c))))),
        el('tbody', {}, ...b.rows.map((r) => el('tr', {}, ...r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, ...spans(c)) : el('td', {}, ...spans(c))))))),
      );
    default:
      return el('p', {}, ...spans(b.text));
  }
}

export interface TutorialHandle {
  readonly root: HTMLElement;
  /** Close as the player would (runs onClose). */
  close(): void;
  /** Remove without running onClose, for a screen that is being torn down. */
  dispose(): void;
}

/** A page's content: the Controls key caps (drive help), the blocks (paragraphs, subheadings, lists, tables), then the instrument rows (drive help). */
function pageContent(page: TutorialPageText): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (page.controls && page.controls.keys.length > 0) {
    out.push(el('section', { class: 'tutorial-controls', 'aria-label': page.controls.heading },
      el('h3', { class: 'tutorial-controls-head' }, page.controls.heading),
      el('ul', { class: 'tutorial-keys' }, ...page.controls.keys.map(keyItem)),
    ));
  }
  out.push(...page.blocks.map(block));
  if (page.instruments?.length) out.push(el('ol', { class: 'tutorial-instruments' }, ...page.instruments.map(instrumentRow)));
  return out;
}

const cap = (c: string, extra = '') => el('kbd', { class: `tutorial-cap${extra}` }, c);

function keyItem(k: TutorialKeyText): HTMLElement {
  const caps = el('span', { class: 'tutorial-caps' });
  k.caps.forEach((group, i) => {
    if (i > 0) caps.append(el('span', { class: 'tutorial-caps-join' }, k.join));
    caps.append(...group.map((c) => cap(c)));
  });
  // A long run of caps (W A S D or the arrows) takes the whole row.
  return el('li', { class: k.caps.flat().length > 4 ? 'tutorial-keys-wide' : undefined }, caps, el('span', { class: 'tutorial-key-label' }, k.label));
}

function instrumentRow(r: TutorialInstrumentText): HTMLElement {
  return el('li', { class: 'tutorial-instrument' },
    cap(String(r.key), ' tutorial-cap-big'),
    el('div', { class: 'tutorial-instrument-text' },
      el('strong', {}, r.name),
      r.steps.length > 0 && el('ul', { class: 'tutorial-steps' }, ...r.steps.map((s) => el('li', {}, s))),
      r.counts && el('p', { class: 'tutorial-counts' }, r.counts),
    ),
  );
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Open the tutorial over `host` (the screen root). `onClose` runs once, however it is closed.
 * Overlay: div.tutorial-overlay.tutorial-<id>; dialog: section.tutorial#tutorial-dialog.
 */
export function openTutorial(
  host: HTMLElement,
  id: TutorialId,
  pages: TutorialPageText[],
  text: TextFile['tutorial'],
  onClose: () => void,
): TutorialHandle {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let index = 0;
  let closed = false;

  const step = el('span', { class: 'tutorial-step' });
  const title = el('h2', { id: 'tutorial-title' });
  const body = el('div', { class: 'tutorial-body', id: 'tutorial-body' });
  const back = el('button', { type: 'button', class: 'tutorial-back', onclick: () => show(index - 1) }, text.back);
  const next = el('button', {
    type: 'button',
    class: 'primary tutorial-next',
    onclick: () => (index < pages.length - 1 ? show(index + 1) : close()),
  });
  const skip = el('button', { type: 'button', class: 'tutorial-skip', onclick: () => close() }, text.skip);
  // A guide with subheadings, lists or tables (the Moon's Rover Operations Guide) gets a wider card whose body scrolls.
  const rich = pages.some((p) => p.blocks.some((b) => b.kind !== 'p'));
  const label = id === 'design' && text.designLabel ? text.designLabel : `${text.label} · ${id === 'design' ? text.designHeading : text.driveHeading}`;
  const dialog = el('section', {
    class: rich ? 'tutorial tutorial-rich' : 'tutorial',
    id: 'tutorial-dialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'tutorial-title',
    'aria-describedby': 'tutorial-body',
    'data-tutorial': id,
  },
    el('div', { class: 'tutorial-head' },
      el('span', { class: 'tutorial-label' }, label),
      step,
    ),
    title,
    body,
    el('div', { class: 'tutorial-actions' }, skip, el('span', { class: 'tutorial-spacer' }), back, next),
  );
  const root = el('div', { class: `tutorial-overlay tutorial-${id}` }, dialog);

  function show(i: number): void {
    index = Math.max(0, Math.min(pages.length - 1, i));
    const page = pages[index]!;
    const last = index === pages.length - 1;
    step.textContent = fill(text.step, { n: index + 1, total: pages.length });
    title.textContent = page.title;
    body.replaceChildren(...pageContent(page));
    body.scrollTop = 0;
    dialog.scrollTop = 0;
    if (last) body.append(el('p', { class: 'note' }, text.reopen));
    back.hidden = index === 0;
    skip.hidden = last;
    next.textContent = last ? text.done : text.next;
    next.focus({ preventScroll: true });
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    } else if (e.key === 'Enter') {
      // Enter activates the focused dialog button; anywhere else it means Next / Done.
      const target = e.target instanceof HTMLElement && dialog.contains(e.target) && e.target.matches('button, a') ? e.target : next;
      e.preventDefault();
      e.stopImmediatePropagation();
      target.click();
    } else if (e.key === 'Tab') {
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => !n.hidden);
      if (items.length === 0) return;
      const first = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        lastItem.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === lastItem || !dialog.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  };
  // Capture phase, so the screen's own key handlers never see Escape or Enter while the dialog is open.
  window.addEventListener('keydown', onKey, true);

  // Everything else on the screen is inert while the dialog is open.
  const others = [...host.children].filter((n): n is HTMLElement => n instanceof HTMLElement && !n.inert);
  for (const n of others) n.inert = true;
  host.append(root);

  function teardown(): boolean {
    if (closed) return false;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    for (const n of others) n.inert = false;
    root.remove();
    return true;
  }

  function close(): void {
    if (!teardown()) return;
    if (returnFocus?.isConnected) returnFocus.focus();
    onClose();
  }

  show(0);
  return { root, close, dispose: () => void teardown() };
}
