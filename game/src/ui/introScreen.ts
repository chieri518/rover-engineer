// The Welcome to REL intro (game-design.md §3): three short pages after Start new campaign, before the
// first Moon design desk. Laid out like the tutorial dialog (Skip / Back / Next), but as its own screen.
import type { Screen } from '../flow/flow';
import { el, fill } from './dom';
import { introPages } from './tutorialText';

/** A paragraph with its **bold** spans as <strong>. */
function rich(text: string): HTMLElement {
  return el('p', {}, ...text.split('**').map((part, i) => (i % 2 === 1 ? el('strong', {}, part) : part)));
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
    body.replaceChildren(...page.paragraphs.map(rich));
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
