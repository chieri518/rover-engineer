// Mission HUD: energy, damage and cold meters, sunlight on the panel, the power-down toggle,
// standing warnings, short event notices, a flare warning bar, and the end-of-mission panel. Instrument
// readouts: the neutron spectrometer's hydrogen meter, the Earth-in-view light for the laser
// retroreflector, and the seismometer station's moonquake trace.
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
const LONG_NOTICE_SECONDS = 9; // a relationship's notice: longer text, read once per mission
const MILESTONE_SECONDS = 6;
const MILESTONE_FACT_SECONDS = 10; // longer when the history fact is shown, so it can be read

/** A milestone pop-up, already worded. */
export interface MilestoneCard {
  label: string; // "Milestone reached · Capability"
  title: string;
  body: string;
  reward: string | null; // null when nothing is paid (a record already held)
  note?: string;
  fact?: string; // only when the Mission history setting is on
}

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
  // Relationship notices (first-time lessons) have their own slot, apart from the 3-notice limit, and
  // queue: each stays for its full time, one at a time.
  private readonly lessons = el('div', { class: 'hud-lessons', 'aria-live': 'assertive' });
  private readonly lessonQueue: { message: string; tone: 'warn' | 'good' }[] = [];
  private lessonShowing = false;
  private lessonTimer: number | null = null;
  private lessonLeftMs = 0;
  private lessonNode: HTMLElement | null = null;
  private paused = false;
  private readonly flare = el('div', { class: 'flare-warning', hidden: true });
  private readonly flareText = el('div', {});
  private readonly flareBar = el('div', { class: 'flare-bar-fill' });
  private readonly flash = el('div', { class: 'flare-flash' });
  private readonly hint = el('div', { class: 'hud-hint', hidden: true });
  private readonly cards = el('div', { class: 'milestone-cards', 'aria-live': 'polite' });
  private readonly hydrogen;
  private readonly earthLight = el('div', { class: 'earth-light', hidden: true });
  private readonly trace = el('div', { class: 'quake-trace', hidden: true });
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
    this.hydrogen = meter(text.instruments.hydrogenMeter, 'hydrogen');
    this.hydrogen.root.hidden = true;
    this.power = el('button', { class: 'power-toggle', type: 'button', onclick: () => onTogglePower() }, h.powerDown);
    this.flare.append(this.flareText, el('div', { class: 'flare-bar' }, this.flareBar));
    this.root = el('div', { class: 'hud-layer' },
      el('div', { class: 'hud' },
        this.energy.root,
        this.damage.root,
        this.cold.root,
        this.hydrogen.root,
        this.sun,
        this.earthLight,
        this.trace,
        this.power,
        extra,
      ),
      el('div', { class: 'hud-center' }, this.flare, this.warnings, this.lessons, this.notices, this.hint),
      this.cards,
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

  /** The neutron spectrometer's hydrogen meter (0..1), or null to hide it (switched off or powered down). */
  setHydrogen(reading: number | null): void {
    this.hydrogen.root.hidden = reading === null;
    if (reading !== null) this.hydrogen.set(reading, `${Math.round(reading * 100)}%`, false);
  }

  /** The Earth-in-view light (laser retroreflector aboard), or null to hide it. */
  setEarthLight(inView: boolean | null): void {
    this.earthLight.hidden = inView === null;
    if (inView === null) return;
    const t = this.text.instruments;
    this.earthLight.classList.toggle('on', inView);
    const label = inView ? t.earthInView : t.earthHidden;
    if (this.earthLight.textContent !== label) this.earthLight.textContent = label;
  }

  /** The seismometer station's moonquake trace: a burst, clean or buried in the rover's own noise. */
  showQuakeTrace(quality: 'clean' | 'noisy'): void {
    const n = 120;
    const pts: string[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 100;
      const burst = i > 30 ? Math.exp(-(i - 30) / 22) * Math.sin(i * 1.3) * 13 : 0;
      const noise = quality === 'noisy' ? rand() * 9 : rand() * 0.8;
      pts.push(`${x.toFixed(1)},${(17 - burst - noise).toFixed(1)}`);
    }
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 100 34');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(svgNs, 'polyline');
    line.setAttribute('points', pts.join(' '));
    svg.append(line);
    this.trace.replaceChildren(el('span', {}, this.text.instruments.quakeTrace), svg);
    this.trace.classList.toggle('noisy', quality === 'noisy');
    this.trace.hidden = false;
  }

  /** Standing warnings, already worded. Rebuilt only when they change. */
  setWarnings(lines: string[]): void {
    const key = lines.join('\n');
    if (key === this.lastWarnings) return;
    this.lastWarnings = key;
    this.warnings.replaceChildren(...lines.map((l) => el('li', {}, l)));
  }

  /** A short notice that fades after a few seconds. At most three show; a fourth pushes out the oldest. */
  notify(message: string, tone: 'warn' | 'good' = 'warn'): void {
    const n = el('div', { class: `hud-notice ${tone}` }, message);
    this.notices.append(n);
    while (this.notices.childElementCount > 3) this.notices.firstElementChild?.remove();
    window.setTimeout(() => n.remove(), NOTICE_SECONDS * 1000);
  }

  /**
   * A relationship's first-time notice: longer text, in its own slot, never pushed out by other
   * notices. Lessons that arrive together queue and show one after another, each for its full time.
   */
  lesson(message: string, tone: 'warn' | 'good' = 'warn'): void {
    this.lessonQueue.push({ message, tone });
    if (!this.lessonShowing) this.nextLesson();
  }

  private nextLesson(): void {
    const next = this.lessonQueue.shift();
    this.lessonShowing = next !== undefined;
    if (!next) {
      this.lessonNode = null;
      return;
    }
    const n = el('div', { class: `hud-notice long ${next.tone}`, 'data-lesson': '' }, next.message);
    this.lessons.replaceChildren(n);
    this.lessonNode = n;
    this.lessonLeftMs = LONG_NOTICE_SECONDS * 1000;
    if (!this.paused) this.startLessonTimer();
  }

  private startLessonTimer(): void {
    this.lessonTimer = window.setTimeout(() => {
      this.lessonTimer = null;
      this.lessonNode?.remove();
      this.nextLesson();
    }, this.lessonLeftMs);
    this.lessonStartedAt = performance.now();
  }
  private lessonStartedAt = 0;

  /** Pause or resume the lesson timers (the mission is paused by the tutorial or the notebook): the time left is kept. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      if (this.lessonTimer !== null) {
        window.clearTimeout(this.lessonTimer);
        this.lessonTimer = null;
        this.lessonLeftMs = Math.max(0, this.lessonLeftMs - (performance.now() - this.lessonStartedAt));
      }
    } else if (this.lessonShowing && this.lessonTimer === null) {
      this.startLessonTimer();
    }
  }

  /** A standing hint (e.g. "Viewpoint: press C"), or null to hide it. */
  setHint(message: string | null): void {
    this.hint.hidden = message === null;
    if (message !== null && this.hint.textContent !== message) this.hint.textContent = message;
  }

  /** A milestone pop-up in the corner; it fades after a few seconds. */
  milestone(card: MilestoneCard): void {
    const node = el('div', { class: 'milestone-card', role: 'status' },
      el('div', { class: 'milestone-label' }, card.label),
      el('div', { class: 'milestone-title' }, card.title),
      el('p', {}, card.body),
      card.reward && el('div', { class: 'milestone-reward' }, card.reward),
      card.note && el('p', { class: 'muted' }, card.note),
      card.fact && el('p', { class: 'fact' }, card.fact),
    );
    this.cards.append(node);
    while (this.cards.childElementCount > 3) this.cards.firstElementChild?.remove();
    window.setTimeout(() => node.remove(), (card.fact ? MILESTONE_FACT_SECONDS : MILESTONE_SECONDS) * 1000);
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
  showEnd(lines: string[], onContinue: () => void, onNotebook?: () => void): HTMLButtonElement {
    const h = this.text.hud;
    const button = el('button', { class: 'primary', type: 'button', onclick: () => onContinue() }, h.toDebrief);
    this.root.append(
      el('div', { class: 'mission-end', role: 'dialog', 'aria-label': h.endedHeading },
        el('h2', {}, h.endedHeading),
        ...lines.map((l) => el('p', {}, l)),
        el('div', { class: 'actions' }, onNotebook && el('button', { type: 'button', id: 'notebook-open-end', onclick: () => onNotebook() }, this.text.notebook.open), button),
      ),
    );
    this.setWarnings([]);
    this.setHint(null);
    this.setFlareWarning(null, 0);
    this.power.disabled = true;
    button.focus();
    return button;
  }
}
