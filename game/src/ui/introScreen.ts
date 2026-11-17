// The Welcome to REL intro (game-design.md §3): the guide "REL | Rover Operations Guide", four pages
// after the intro film, before the first Moon design desk. Laid out like the tutorial dialog (Skip / Back /
// Next), but as its own screen, with subheadings, lists and tables; a long page scrolls inside the card.
import type { Screen } from '../flow/flow';
import { el, fill } from './dom';
import { introPages, type IntroBlockText } from './tutorialText';

/** Text with its **bold** spans as <strong>. */
function spans(text: string): (string | HTMLElement)[] {
  return text.split('**').map((part, i) => (i % 2 === 1 ? el('strong', {}, part) : part));
}

function block(b: IntroBlockText): HTMLElement {
  switch (b.kind) {
    case 'h':
      return el('h3', { class: 'intro-subhead' }, ...spans(b.text));
    case 'list':
      return el('ul', { class: 'intro-list' }, ...b.items.map((item) => el('li', {}, ...spans(item))));
    case 'table':
      return el('table', { class: 'intro-table' },
        el('thead', {}, el('tr', {}, ...b.head.map((c) => el('th', { scope: 'col' }, ...spans(c))))),
        el('tbody', {}, ...b.rows.map((r) => el('tr', {}, ...r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, ...spans(c)) : el('td', {}, ...spans(c))))))),
      );
    default:
      return el('p', {}, ...spans(b.text));
  }
}

export const introScreen: Screen = (game, root) => {
  const { text } = game.data;
  const t = text.intro;
  const tut = text.tutorial; // Back, Next and the page count are the tutorial's
  const pages = introPages(game.data);
  const toDesk = () => game.go('design');
  let index = 0;

  const step = el('span', { class: 'tutorial-step' });
  const title = el('h2', { id: 'intro-title' });
  const body = el('div', { class: 'tutorial-body', id: 'intro-body' });
  const back = el('button', { type: 'button', class: 'tutorial-back', onclick: () => show(index - 1) }, tut.back);
  const next = el('button', {
    type: 'button',
    class: 'primary tutorial-next',
    id: 'intro-next',
    onclick: () => (index < pages.length - 1 ? show(index + 1) : toDesk()),
  });
  const skip = el('button', { type: 'button', class: 'tutorial-skip', id: 'intro-skip', onclick: toDesk }, t.skip);

  function show(i: number): void {
    index = Math.max(0, Math.min(pages.length - 1, i));
    const page = pages[index]!;
    const last = index === pages.length - 1;
    step.textContent = fill(tut.step, { n: index + 1, total: pages.length });
    title.textContent = page.title;
    body.replaceChildren(...page.blocks.map(block));
    body.scrollTop = 0;
    back.hidden = index === 0;
    skip.hidden = last;
    next.textContent = last ? t.done : tut.next;
    next.focus();
  }

  root.append(
    el('section', { class: 'tutorial intro', id: 'intro-dialog', 'aria-labelledby': 'intro-title' },
      el('div', { class: 'tutorial-head' }, el('span', { class: 'tutorial-label' }, t.heading), step),
      title,
      body,
      el('div', { class: 'tutorial-actions' }, skip, el('span', { class: 'tutorial-spacer' }), back, next),
    ),
  );
  show(0);
};
