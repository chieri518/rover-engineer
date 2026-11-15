// Mission HUD: energy, damage and cold meters, sunlight on the panel, the power-down toggle,
// standing warnings, short event notices, a flare warning bar, and the end-of-mission panel.
// No clock: time reads only from the Sun and shadows.
import type { TextFile } from '../rules/types';
import { el } from './dom';

export interface HudMeters {
  energy: number;
  capacity: number;
  damage: number; // 0..1
  freeze: number; // 0..1
  sunlight: number; // 0..1
  poweredDown: boolean;
}

const NOTICE_SECONDS = 4;

function meter(label: string, cls: string) {
  const fillEl = el('div', { class: 'meter-fill' });
  const value = el('span', { class: 'meter-value' });
  const root = el('div', { class: `meter ${cls}` },
    el('div', { class: 'meter-head' }, el('span', {}, label), value),
    el('div', { class: 'meter-track' }, fillEl),
  );
  return {
    root,
    set(share: number, text: string, alert: boolean) {
      fillEl.style.width = `${Math.max(0, Math.min(1, share)) * 100}%`;
      value.textContent = text;
      root.classList.toggle('alert', alert);
    },
  };
}

export class Hud {
  readonly root: HTMLElement;
  private readonly energy;
  private readonly damage;
  private readonly cold;
  private readonly sun = el('div', { class: 'sun-state' });
  private readonly power: HTMLButtonElement;
  private readonly warnings = el('ul', { class: 'hud-warnings', 'aria-live': 'polite' });
  private readonly notices = el('div', { class: 'hud-notices', 'aria-live': 'assertive' });
  private readonly flare = el('div', { class: 'flare-warning', hidden: true });
  private readonly flareText = el('div', {});
  private readonly flareBar = el('div', { class: 'flare-bar-fill' });
  private readonly flash = el('div', { class: 'flare-flash' });
  private lastWarnings = '';

  constructor(
    private readonly text: TextFile,
    onTogglePower: () => void,
    extra: HTMLElement,
  ) {
    const h = text.hud;
    this.energy = meter(h.energy, 'energy');
    this.damage = meter(h.damage, 'damage');
    this.cold = meter(h.cold, 'cold');
    this.power = el('button', { class: 'power-toggle', type: 'button', onclick: () => onTogglePower() }, h.powerDown);
    this.flare.append(this.flareText, el('div', { class: 'flare-bar' }, this.flareBar));
    this.root = el('div', { class: 'hud-layer' },
      el('div', { class: 'hud' },
        this.energy.root,
        this.damage.root,
        this.cold.root,
        this.sun,
        this.power,
        extra,
      ),
      el('div', { class: 'hud-center' }, this.flare, this.warnings, this.notices),
      this.flash,
    );
  }

  update(m: HudMeters): void {
    const h = this.text.hud;
    this.energy.set(m.energy / m.capacity, `${Math.round(m.energy)} / ${m.capacity}`, m.energy / m.capacity < 0.2);
    this.damage.set(m.damage, `${Math.round(m.damage * 100)}%`, m.damage >= 0.6);
    this.cold.set(m.freeze, `${Math.round(m.freeze * 100)}%`, m.freeze >= 0.5);
    this.sun.textContent = m.sunlight > 0.5 ? h.sunlit : h.shadow;
    this.sun.classList.toggle('shadow', m.sunlight <= 0.5);
    this.power.textContent = m.poweredDown ? h.powerUp : h.powerDown;
    this.power.classList.toggle('active', m.poweredDown);
  }

  /** Standing warnings, already worded. Rebuilt only when they change. */
  setWarnings(lines: string[]): void {
    const key = lines.join('\n');
    if (key === this.lastWarnings) return;
    this.lastWarnings = key;
    this.warnings.replaceChildren(...lines.map((l) => el('li', {}, l)));
  }

  /** A short notice that fades after a few seconds. */
  notify(message: string, tone: 'warn' | 'good' = 'warn'): void {
    const n = el('div', { class: `hud-notice ${tone}` }, message);
    this.notices.append(n);
    while (this.notices.childElementCount > 3) this.notices.firstElementChild?.remove();
    window.setTimeout(() => n.remove(), NOTICE_SECONDS * 1000);
  }

  /** The flare warning: share of the warning time left (1 → 0), or null to hide it. */
  setFlareWarning(message: string | null, remaining: number): void {
    this.flare.hidden = message === null;
    if (message === null) return;
    this.flareText.textContent = message;
    this.flareBar.style.width = `${Math.max(0, Math.min(1, remaining)) * 100}%`;
  }

  flashScreen(): void {
    this.flash.classList.remove('on');
    void this.flash.offsetWidth; // restart the animation
    this.flash.classList.add('on');
  }

  /** The end-of-mission panel. */
  showEnd(lines: string[], onContinue: () => void): HTMLButtonElement {
    const h = this.text.hud;
    const button = el('button', { class: 'primary', type: 'button', onclick: () => onContinue() }, h.toDebrief);
    this.root.append(
      el('div', { class: 'mission-end', role: 'dialog', 'aria-label': h.endedHeading },
        el('h2', {}, h.endedHeading),
        ...lines.map((l) => el('p', {}, l)),
        el('div', { class: 'actions' }, button),
      ),
    );
    this.setWarnings([]);
    this.setFlareWarning(null, 0);
    this.power.disabled = true;
    button.focus();
    return button;
  }
}
