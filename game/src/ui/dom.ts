import type { TextFile } from '../rules/types';

type Child = Node | string | null | undefined | false;

/** Tiny element helper: el('button', { class: 'primary', onclick }, 'Go'). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value as EventListener);
    } else if (key === 'class') {
      node.className = String(value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

export function money(amount: number, text: TextFile): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${text.moneyPrefix}${Math.abs(amount)}${text.moneySuffix}`;
}

export function panel(...children: Child[]): HTMLElement {
  return el('section', { class: 'panel' }, ...children);
}
