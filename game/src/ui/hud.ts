// Mission HUD: energy, damage and cold meters, sunlight on the panel, the power-down toggle,
// standing warnings, short event notices, a flare warning bar, and the end-of-mission panel. Instrument
// readouts: the neutron spectrometer's hydrogen meter, the Earth-in-view light for the laser
// retroreflector, and the seismometer station's moonquake trace. Mars (step 4a): the weather mast's air
// readout, the radar's subsurface strip under the meters, the laser's target reticle, and a progress bar
// for a long hold (the organics spectrometer).
// No clock: time reads only from the Sun and shadows. On Mars a sol line ("Sol 3 of 10") and the night
// state (asleep, lights on) sit under the sunlight line. Mars step 6c: the power line replaces the
// sunlight line (truthful for an RTG, with the panels' dust factor), and the weather mast's recording
// state sits under its air readout. Titan words the panel line itself (almost no solar power), reuses the
// sol line for day or night, and shows a banner while the rover sleeps.
import type { TextFile } from '../rules/types';
import type { RadarColumn } from '../rules/instruments';
import { el } from './dom';

/** How the radar strip draws each layer kind (presentation only): band count, dip across the strip, colors. */
const RADAR_LOOK: Record<string, { bands: number; dip: number; jumble?: boolean; colors: [string, string] }> = {
  floor: { bands: 3, dip: 0.12, colors: ['#6b4a36', '#8a6448'] },
  seitah: { bands: 4, dip: 0.35, colors: ['#4d5a3c', '#6f7a52'] },
  delta: { bands: 7, dip: 0.04, colors: ['#8c6c4c', '#b08a62'] },
  ejecta: { bands: 3, dip: 0, jumble: true, colors: ['#5e4a40', '#7d6656'] },
};
const RADAR_COLUMN_PX = 2;
const RADAR_HEIGHT_PX = 34;

export interface HudMeters {
  energy: number;
  capacity: number;
  damage: number; // 0..1
  freeze: number; // 0..1
  sunlight: number; // 0..1
  poweredDown: boolean;
  panelText?: string; // replaces the sunlight line's words (Titan: almost no solar power)
}

/** The sound toggle's icon: a speaker with waves, or crossed out when muted. */
function speakerIcon(muted: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = (d: string) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  };
  path('M4 9h4l5-4v14l-5-4H4z');
  if (muted) path('M16 9l6 6M22 9l-6 6');
  else path('M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12');
  return svg;
}

const NOTICE_SECONDS = 4;
const SITE_NOTICE_SECONDS = 8; // a located site with its instrument lines: up to four sentences
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
  private readonly sol = el('div', { class: 'sol-state', hidden: true });
  private readonly solText = el('span', {});
  private readonly nightText = el('span', { class: 'night-state' });
  private readonly power: HTMLButtonElement;
  private readonly mute: HTMLButtonElement;
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
  private readonly banner = el('div', { class: 'hud-banner', hidden: true, role: 'status' });
  private readonly cards = el('div', { class: 'milestone-cards', 'aria-live': 'polite' });
  private readonly hydrogen;
  private readonly earthLight = el('div', { class: 'earth-light', hidden: true });
  private readonly trace = el('div', { class: 'quake-trace', hidden: true });
  private readonly weather = el('div', { class: 'weather-readout', hidden: true });
  private readonly recording = el('div', { class: 'weather-recording', hidden: true });
  private powerSet = false; // Mars: setPowerLine owns the sunlight line
  private readonly radar = el('div', { class: 'radar-strip', hidden: true });
  private readonly radarLabel = el('span', {});
  private readonly radarCanvas = el('canvas', { width: 160, height: RADAR_HEIGHT_PX, 'aria-hidden': 'true' }) as HTMLCanvasElement;
  private radarKey = '';
  private readonly reticle = el('div', { class: 'laser-reticle', hidden: true, 'aria-hidden': 'true' });
  private readonly target = el('div', { class: 'laser-target', hidden: true });
  private readonly progress = el('div', { class: 'hold-progress', hidden: true });
  private readonly progressFill = el('div', { class: 'hold-progress-fill' });
  private readonly progressText = el('span', {});
  private lastWarnings = '';

  constructor(
    private readonly text: TextFile,
    onTogglePower: () => void,
    extra: HTMLElement,
    onToggleMute: () => void = () => {},
  ) {
    const h = text.hud;
    this.energy = meter(h.energy, 'energy');
    this.damage = meter(h.damage, 'damage');
    this.cold = meter(h.cold, 'cold');
    this.hydrogen = meter(text.instruments.hydrogenMeter, 'hydrogen');
    this.hydrogen.root.hidden = true;
    this.power = el('button', { class: 'power-toggle', type: 'button', onclick: () => onTogglePower() }, h.powerDown);
    this.mute = el('button', { class: 'sound-toggle', type: 'button', id: 'sound-toggle', onclick: () => onToggleMute() });
    this.setMuted(false);
    this.flare.append(this.flareText, el('div', { class: 'flare-bar' }, this.flareBar));
    this.sol.append(this.solText, this.nightText);
    this.radar.append(this.radarLabel, this.radarCanvas);
    this.progress.append(this.progressText, el('div', { class: 'hold-progress-track' }, this.progressFill));
    this.root = el('div', { class: 'hud-layer' },
      el('div', { class: 'hud' },
        this.energy.root,
        this.damage.root,
        this.cold.root,
        this.hydrogen.root,
        this.sun,
        this.sol,
        this.earthLight,
        this.trace,
        this.weather,
        this.recording,
        this.radar,
        this.target,
        el('div', { class: 'hud-power-row' }, this.power, this.mute),
        extra,
      ),
      el('div', { class: 'hud-center' }, this.banner, this.flare, this.warnings, this.lessons, this.notices, this.hint, this.progress),
      this.reticle,
      this.cards,
      this.flash,
    );
  }

  update(m: HudMeters): void {
    const h = this.text.hud;
    this.energy.set(m.energy / m.capacity, `${Math.round(m.energy)} / ${m.capacity}`, m.energy / m.capacity < 0.2);
    this.damage.set(m.damage, `${Math.round(m.damage * 100)}%`, m.damage >= 0.6);
    this.cold.set(m.freeze, `${Math.round(m.freeze * 100)}%`, m.freeze >= 0.5);
    if (!this.powerSet) {
      this.sun.textContent = m.panelText ?? (m.sunlight > 0.5 ? h.sunlit : h.shadow);
      this.sun.classList.toggle('shadow', m.panelText !== undefined || m.sunlight <= 0.5);
    }
    this.power.textContent = m.poweredDown ? h.powerUp : h.powerDown;
    this.power.classList.toggle('active', m.poweredDown);
  }

  /** The sound toggle: shows whether the sound is muted (the button and the M key both toggle it). */
  setMuted(muted: boolean): void {
    const label = muted ? this.text.settings.unmute : this.text.settings.mute;
    this.mute.replaceChildren(speakerIcon(muted));
    this.mute.title = label;
    this.mute.setAttribute('aria-label', label);
    this.mute.setAttribute('aria-pressed', String(muted));
    this.mute.classList.toggle('active', muted);
  }

  /**
   * Mars: the power line in place of the sunlight line (ui/hudText.ts powerLine), dim when nothing comes
   * in. Once set, update() no longer writes the Moon's sunlight line; null hands it back.
   */
  setPowerLine(line: { text: string; dim: boolean } | null): void {
    this.powerSet = line !== null;
    if (line === null) return;
    if (this.sun.textContent !== line.text) this.sun.textContent = line.text;
    this.sun.classList.toggle('shadow', line.dim);
  }

  /** Mars: the weather mast's recording state (ui/hudText.ts weatherRecordingLine), or null to hide it. */
  setRecording(line: string | null): void {
    this.recording.hidden = line === null;
    if (line !== null && this.recording.textContent !== line) this.recording.textContent = line;
  }

  /** Mars: the sol line and the night state under it (null hides each). */
  setSol(sol: string | null, night: string | null): void {
    this.sol.hidden = sol === null;
    if (this.solText.textContent !== (sol ?? '')) this.solText.textContent = sol ?? '';
    if (this.nightText.textContent !== (night ?? '')) this.nightText.textContent = night ?? '';
    this.nightText.hidden = night === null;
  }

  /** The neutron spectrometer's hydrogen meter (0..1), or null to hide it (switched off or powered down). */
  setHydrogen(reading: number | null): void {
    this.hydrogen.root.hidden = reading === null;
    if (reading !== null) this.hydrogen.set(reading, `${Math.round(reading * 100)}%`, false);
  }

  /**
   * The Earth-in-view light (laser retroreflector aboard; rules/instruments.ts reflectorEarthLight), or
   * null to hide it. In view but inside the near-lander zone, it says the station would not count there.
   */
  setEarthLight(light: 'hidden' | 'in-view' | 'in-view-too-close' | null): void {
    this.earthLight.hidden = light === null;
    if (light === null) return;
    const t = this.text.instruments;
    this.earthLight.classList.toggle('on', light === 'in-view');
    this.earthLight.classList.toggle('too-close', light === 'in-view-too-close');
    const label = light === 'in-view' ? t.earthInView : light === 'in-view-too-close' ? t.earthInViewTooClose : t.earthHidden;
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

  /** Mars: the weather mast's air readout (pressure, dust and their trends), or null to hide it. */
  setWeather(line: string | null): void {
    this.weather.hidden = line === null;
    if (line !== null && this.weather.textContent !== line) this.weather.textContent = line;
  }

  /**
   * Mars: the radar's subsurface strip under the meters (the profile's columns, newest on the right, a
   * gap where a turn or stop broke it), or null to hide it. Redrawn only when the columns change.
   */
  setRadar(columns: readonly RadarColumn[] | null, label: string): void {
    this.radar.hidden = columns === null;
    if (columns === null) return;
    if (this.radarLabel.textContent !== label) this.radarLabel.textContent = label;
    const key = `${columns.length}:${columns.map((c) => (c.startsProfile ? '|' : '') + c.layer).join(',')}`;
    if (key === this.radarKey) return;
    this.radarKey = key;
    const ctx = this.radarCanvas.getContext('2d');
    if (!ctx) return;
    const w = this.radarCanvas.width;
    const h = RADAR_HEIGHT_PX;
    ctx.fillStyle = '#1d140f';
    ctx.fillRect(0, 0, w, h);
    const first = w - columns.length * RADAR_COLUMN_PX;
    columns.forEach((c, i) => {
      const x = first + i * RADAR_COLUMN_PX;
      if (c.startsProfile && i > 0) return; // the break: a dark gap
      const look = RADAR_LOOK[c.layer] ?? RADAR_LOOK.floor!;
      for (let y = 0; y < h; y++) {
        const jitter = look.jumble ? Math.sin(i * 12.9898 + y * 78.233) * 1.5 : 0;
        const depth = (y + look.dip * i + jitter) / h;
        ctx.fillStyle = look.colors[Math.floor(depth * look.bands) % 2]!;
        ctx.fillRect(x, y, RADAR_COLUMN_PX, 1);
      }
    });
  }

  /** Mars: the laser's target (a reticle in the view and a line under the meters), or null when nothing is in reach. */
  setLaserTarget(line: string | null): void {
    this.reticle.hidden = line === null;
    this.target.hidden = line === null;
    if (line !== null && this.target.textContent !== line) this.target.textContent = line;
  }

  /** A long hold's progress (0..1) with its label, or null to hide the bar (the organics spectrometer). */
  setProgress(share: number | null, label = ''): void {
    this.progress.hidden = share === null;
    if (share === null) return;
    if (this.progressText.textContent !== label) this.progressText.textContent = label;
    this.progressFill.style.width = `${Math.max(0, Math.min(1, share)) * 100}%`;
  }

  /** A standing banner at the top of the view (Titan: "Sleeping · time speeds up"), or null to hide it. */
  setBanner(message: string | null): void {
    this.banner.hidden = message === null;
    if (message !== null && this.banner.textContent !== message) this.banner.textContent = message;
  }

  /** Standing warnings, already worded. Rebuilt only when they change. */
  setWarnings(lines: string[]): void {
    const key = lines.join('\n');
    if (key === this.lastWarnings) return;
    this.lastWarnings = key;
    this.warnings.replaceChildren(...lines.map((l) => el('li', {}, l)));
  }

  /**
   * A short notice that fades after a few seconds. At most three show; a fourth pushes out the oldest.
   * An array is a notice of several lines (a located site with its instrument lines), shown longer.
   */
  notify(message: string | string[], tone: 'warn' | 'good' = 'warn'): void {
    const long = Array.isArray(message) && message.length > 1;
    const text = Array.isArray(message) ? message.join('\n') : message;
    const n = el('div', { class: `hud-notice ${tone}${long ? ' site' : ''}` }, text);
    this.notices.append(n);
    while (this.notices.childElementCount > 3) this.notices.firstElementChild?.remove();
    window.setTimeout(() => n.remove(), (long ? SITE_NOTICE_SECONDS : NOTICE_SECONDS) * 1000);
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
    this.setLaserTarget(null);
    this.setProgress(null);
    this.setBanner(null);
    this.power.disabled = true;
    button.focus();
    return button;
  }
}
