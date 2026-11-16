// Campaign complete dashboard (game-design.md, "Titan goal and the campaign dashboard"): a headline,
// one card per mission from the recorded round stats, two small inline-SVG charts (the balance across
// the campaign, milestones by category per mission), records held and the end buttons. Missions with no
// stats (older saves) show as "not recorded". Every word comes from text.json → dashboard.
import type { Game } from '../flow/flow';
import type { CampaignState } from '../rules/campaign';
import type { RoundStats } from '../rules/roundStats';
import type { DashboardText, GameData, MilestoneCategory, MissionId, TextFile } from '../rules/types';
import { categoryLabel } from './milestoneText';
import { el, fill, money } from './dom';

export const MISSIONS: readonly MissionId[] = ['moon', 'mars', 'titan'];

/** Mission time as m:ss (the same format as clockText in screens.ts, kept here to avoid an import cycle). */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const pct = (share: number, t: DashboardText) => fill(t.percent, { pct: Math.round(share * 100) });

export function distanceText(m: number, t: DashboardText): string {
  return m >= 1000 ? fill(t.kilometers, { km: (m / 1000).toFixed(2) }) : fill(t.meters, { m: Math.round(m) });
}

/** The recorded round for each mission (the latest entry wins), or null. */
export function statsByMission(state: CampaignState): Record<MissionId, RoundStats | null> {
  const out: Record<MissionId, RoundStats | null> = { moon: null, mars: null, titan: null };
  for (const s of state.stats ?? []) if (s.mission in out) out[s.mission] = s;
  return out;
}

/** The headline numbers, summed over the recorded rounds. finalSurvived: null when Titan was not recorded. */
export function dashboardTotals(state: CampaignState) {
  const by = statsByMission(state);
  const recorded = MISSIONS.map((m) => by[m]).filter((s): s is RoundStats => s !== null);
  return {
    finalSurvived: by.titan ? by.titan.passed : null,
    distanceM: recorded.reduce((sum, s) => sum + s.distanceM, 0),
    earned: recorded.reduce((sum, s) => sum + s.milestones.reduce((a, c) => a + c.earned, 0), 0),
    available: recorded.reduce((sum, s) => sum + s.milestones.reduce((a, c) => a + c.available, 0), 0),
    recorded: recorded.length,
  };
}

// ---- SVG helpers -------------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...children: (Node | string | null)[]): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const c of children) if (c !== null) node.append(c);
  return node;
}

let chartId = 0;
/** An accessible chart frame: role img with its own <title> and <desc>. */
function chartFrame(width: number, height: number, title: string, desc: string, cls: string): SVGSVGElement {
  const id = `dash-chart-${++chartId}`;
  return svg('svg', { class: `dash-svg ${cls}`, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': `${id}-t ${id}-d` },
    svg('title', { id: `${id}-t` }, title),
    svg('desc', { id: `${id}-d` }, desc));
}

/** The balance at the start and after each recorded mission: a line with labeled points. */
function balanceChart(state: CampaignState, data: GameData): HTMLElement {
  const { text } = data;
  const t = text.dashboard;
  const by = statsByMission(state);
  const slots: { label: string; value: number | null }[] = [
    { label: t.balanceStart, value: data.tuning.budget.startingBudget },
    ...MISSIONS.map((m) => ({ label: t.worldShort[m], value: by[m]?.balanceAfter ?? null })),
  ];
  const values = slots.map((s) => s.value).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...values);
  // Room under the lowest point for a label below it when the balance went negative.
  const W = 360, H = 190, left = 34, right = 34, top = 26, bottom = lo < 0 ? 48 : 30;
  const hi = Math.max(...values, 1);
  const span = hi - lo || 1;
  const x = (i: number) => left + (i * (W - left - right)) / (slots.length - 1);
  const y = (v: number) => top + ((hi - v) / span) * (H - top - bottom);
  const points = slots.map((s, i) => (s.value === null ? null : { ...s, i, x: x(i), y: y(s.value) })).filter((p) => p !== null);
  const desc = fill(t.balanceChartDesc, { points: points.map((p) => `${p.label} ${money(p.value!, text)}`).join(', ') });
  const chart = chartFrame(W, H, t.balanceChartTitle, desc, 'dash-balance');
  // Recessive zero baseline and x labels for every slot (a missing mission keeps its place).
  chart.append(svg('line', { class: 'dash-axis', x1: left - 12, x2: W - right + 12, y1: y(0), y2: y(0) }));
  slots.forEach((s, i) => chart.append(svg('text', { class: 'dash-xlabel', x: x(i), y: H - 8, 'text-anchor': 'middle' }, s.label)));
  if (points.length > 1) {
    chart.append(svg('polyline', { class: 'dash-line', points: points.map((p) => `${p.x},${p.y}`).join(' ') }));
  }
  for (const p of points) {
    const label = money(p.value!, text);
    chart.append(svg('g', { class: 'dash-point' },
      svg('title', {}, `${p.label}: ${label}`),
      svg('circle', { cx: p.x, cy: p.y, r: 10, class: 'dash-hit' }),
      svg('circle', { cx: p.x, cy: p.y, r: 4.5, class: 'dash-dot' }),
      svg('text', { class: 'dash-value', x: p.x, y: p.value! < 0 ? p.y + 18 : p.y - 10, 'text-anchor': 'middle' }, label)));
  }
  return el('figure', { class: 'dash-chart' }, el('figcaption', {}, t.balanceChartTitle), chart);
}

const CATS: readonly MilestoneCategory[] = ['capability', 'scientific', 'record', 'picture'];

/** Milestones by category per recorded mission: an outlined bar for those available, filled for those earned. */
function milestonesChart(state: CampaignState, text: TextFile): HTMLElement {
  const t = text.dashboard;
  const by = statsByMission(state);
  const groups = MISSIONS.filter((m) => by[m]).map((m) => ({ mission: m, cats: by[m]!.milestones }));
  const legend = el('ul', { class: 'dash-legend' },
    ...CATS.map((c) => el('li', {}, el('span', { class: `dash-swatch cat-${c}`, 'aria-hidden': 'true' }), categoryLabel(c, text))),
    el('li', { class: 'dash-legend-key' }, el('span', { class: 'dash-swatch outline', 'aria-hidden': 'true' }), t.legendAvailable),
    el('li', { class: 'dash-legend-key' }, el('span', { class: 'dash-swatch filled', 'aria-hidden': 'true' }), t.legendEarned));
  if (!groups.length) {
    return el('figure', { class: 'dash-chart' }, el('figcaption', {}, t.milestonesChartTitle), el('p', { class: 'muted' }, t.chartNoData));
  }
  const W = 360, H = 190, left = 10, right = 10, top = 22, bottom = 30;
  const max = Math.max(1, ...groups.flatMap((g) => g.cats.map((c) => c.available)));
  const groupW = (W - left - right) / groups.length;
  const barW = 18, gap = 6;
  const y = (v: number) => top + ((max - v) / max) * (H - top - bottom);
  const base = y(0);
  const desc = fill(t.milestonesChartDesc, {
    points: groups.map((g) => `${t.worldShort[g.mission]}: ${g.cats.map((c) => `${categoryLabel(c.category, text)} ${c.earned}/${c.available}`).join(', ')}`).join('; '),
  });
  const chart = chartFrame(W, H, t.milestonesChartTitle, desc, 'dash-milestones');
  chart.append(svg('line', { class: 'dash-axis', x1: left, x2: W - right, y1: base, y2: base }));
  groups.forEach((g, gi) => {
    const cx = left + groupW * (gi + 0.5);
    const total = g.cats.length * barW + (g.cats.length - 1) * gap;
    g.cats.forEach((c, ci) => {
      const bx = cx - total / 2 + ci * (barW + gap);
      const name = categoryLabel(c.category, text);
      chart.append(svg('g', { class: `dash-bar cat-${c.category}` },
        svg('title', {}, `${t.worldShort[g.mission]}, ${name}: ${fill(t.ofTotal, { n: c.earned, total: c.available })}`),
        svg('rect', { class: 'dash-avail', x: bx + 0.75, y: y(c.available) + 0.75, width: barW - 1.5, height: Math.max(0, base - y(c.available) - 0.75), rx: 2 }),
        c.earned > 0 ? svg('rect', { class: 'dash-earned', x: bx, y: y(c.earned), width: barW, height: base - y(c.earned), rx: 2 }) : null,
        svg('text', { class: 'dash-value small', x: bx + barW / 2, y: y(c.available) - 5, 'text-anchor': 'middle' }, `${c.earned}/${c.available}`)));
    });
    chart.append(svg('text', { class: 'dash-xlabel', x: cx, y: H - 8, 'text-anchor': 'middle' }, t.worldShort[g.mission]));
  });
  return el('figure', { class: 'dash-chart' }, el('figcaption', {}, t.milestonesChartTitle), chart, legend);
}

// ---- Cards -------------------------------------------------------------------------------------

function row(label: string, value: string | Node, cls = ''): HTMLElement[] {
  return [el('dt', {}, label), el('dd', { class: cls }, value)];
}

function partName(id: string, data: GameData): string {
  return data.parts.parts.find((p) => p.id === id)?.name ?? id;
}

function missionCard(mission: MissionId, index: number, s: RoundStats | null, game: Game): HTMLElement {
  const { text } = game.data;
  const t = text.dashboard;
  const own = game.dataOf(mission);
  const head = el('header', { class: 'dash-card-head' },
    el('p', { class: 'dash-kicker' }, fill(t.missionNumber, { n: index + 1 })),
    el('h3', {}, own.text.worlds[mission]),
    s && el('span', { class: `dash-badge ${s.passed ? 'good' : 'bad'}` }, s.passed ? t.passed : t.notPassed));
  if (!s) {
    return el('article', { class: 'dash-card not-recorded' }, head,
      el('p', { class: 'dash-badge muted-badge' }, t.notRecorded),
      el('p', { class: 'muted' }, t.notRecordedBody));
  }
  const cause = s.outcome === 'survived' ? own.text.dashboard.survivedToEnd
    : fill(t.lostAt, { cause: s.outcome === 'rollover' ? own.text.debrief.rollover : own.text.causes[s.outcome], time: clock(s.secondsLasted) });
  const milestoneList = el('ul', { class: 'dash-cats' }, ...s.milestones.map((c) =>
    el('li', {}, el('span', { class: `dash-swatch cat-${c.category}`, 'aria-hidden': 'true' }),
      el('span', {}, categoryLabel(c.category, text)),
      el('span', { class: 'num' }, fill(t.ofTotal, { n: c.earned, total: c.available })))));
  const n = s.nights;
  return el('article', { class: 'dash-card' }, head,
    el('p', { class: `dash-outcome ${s.passed ? 'good' : 'bad'}` }, cause),
    el('dl', { class: 'dash-stats' },
      ...row(t.labelTime, fill(t.ofTotal, { n: clock(s.secondsLasted), total: clock(s.missionSeconds) }), 'num'),
      ...row(t.labelDistance, distanceText(s.distanceM, t), 'num'),
      ...row(t.labelEarned, money(s.moneyEarned, text), 'num money'),
      ...(s.penalty > 0 ? row(t.labelPenalty, money(-s.penalty, text), 'num bad') : []),
      ...row(t.labelSpentRover, money(s.spentRover, text), 'num'),
      ...row(t.labelSpentTicket, money(s.spentTicket, text), 'num'),
      ...row(t.labelBalanceAfter, money(s.balanceAfter, text), 'num money'),
      ...row(t.labelRp, String(s.rp), 'num'),
      ...row(t.labelEnergy, String(Math.round(s.energyUsed)), 'num'),
      ...row(t.labelBattery, String(s.batteryCapacity), 'num'),
      ...row(t.labelLowestBattery, pct(s.lowestBattery, t), 'num'),
      ...row(t.labelCold, pct(s.peakCold, t), 'num'),
      ...row(t.labelSamples, String(s.samples), 'num'),
      ...row(t.labelPhotos, String(s.photos), 'num'),
    ),
    el('h4', {}, t.labelMilestones),
    milestoneList,
    n && el('h4', {}, t.labelNights),
    n && el('dl', { class: 'dash-stats' },
      ...row(t.nightsSurvived, String(n.survived), 'num'),
      ...row(t.nightsAsleep, String(n.asleep), 'num'),
      ...row(t.nightsLights, String(n.lights), 'num'),
      ...row(t.nightsDark, String(n.dark), 'num')),
    el('h4', {}, t.labelBuild),
    el('dl', { class: 'dash-build' },
      ...row(t.labelParts, s.build.parts.map((id) => partName(id, own)).join(', ') || t.noPayload),
      ...row(t.labelPayload, s.build.payload.map((id) => partName(id, own)).join(', ') || t.noPayload)),
  );
}

function tile(label: string, value: string, cls = '', note?: string): HTMLElement {
  return el('div', { class: `dash-tile ${cls}` },
    el('span', { class: 'dash-tile-label' }, label),
    el('span', { class: 'dash-tile-value' }, value),
    note ? el('span', { class: 'dash-tile-note' }, note) : null);
}

/** A record's name with its world ("Moon: Touchdown"), since each world has its own Touchdown. */
function recordName(id: string, game: Game): string {
  const t = game.data.text.dashboard;
  for (const m of MISSIONS) {
    const found = game.dataOf(m).milestones.milestones.find((x) => x.id === id);
    if (found) return fill(t.recordName, { world: t.worldShort[m], name: found.name });
  }
  return id;
}

/** The Campaign complete screen. */
export function renderDashboard(game: Game, root: HTMLElement): void {
  const { data, state } = game;
  const { text } = data;
  const t = text.dashboard;
  const end = text.titanCampaign?.complete;
  const totals = dashboardTotals(state);
  const by = statsByMission(state);
  const sumNote = totals.recorded < MISSIONS.length ? t.tileSumNote : undefined;
  const finalValue = totals.finalSurvived === null ? t.notRecorded : totals.finalSurvived ? t.yes : t.no;
  const finalCls = totals.finalSurvived === null ? 'muted-tile' : totals.finalSurvived ? 'good' : 'bad';
  root.append(
    el('section', { class: 'panel dashboard' },
      el('header', { class: 'dash-head' },
        el('p', { class: 'title-kicker' }, t.kicker),
        el('h2', {}, t.heading),
        el('p', { class: 'muted' }, t.body),
        totals.finalSurvived !== null && el('p', { class: 'story-beat' }, totals.finalSurvived ? t.storySurvived : t.storyLost)),
      el('div', { class: 'dash-tiles' },
        tile(t.tileFinal, finalValue, finalCls),
        tile(t.tileDistance, distanceText(totals.distanceM, t), '', sumNote),
        tile(t.tileMilestones, fill(t.ofTotal, { n: totals.earned, total: totals.available }), '', sumNote),
        tile(t.tileBalance, money(state.balance, text), 'money'),
        tile(t.tileRp, String(state.rp))),
      el('h3', { class: 'dash-section' }, t.missionsHeading),
      el('div', { class: 'dash-cards' }, ...MISSIONS.map((m, i) => missionCard(m, i, by[m], game))),
      el('h3', { class: 'dash-section' }, t.chartsHeading),
      el('div', { class: 'dash-charts' }, balanceChart(state, data), milestonesChart(state, text)),
      el('h3', { class: 'dash-section' }, t.recordsHeading),
      state.records.length
        ? el('p', {}, fill(t.recordsCount, { n: state.records.length }), ' ',
          el('span', { class: 'muted' }, state.records.map((id) => recordName(id, game)).join(', ')))
        : el('p', { class: 'muted' }, t.noRecords),
      end && el('h3', { class: 'dash-section' }, end.lessonsHeading),
      end && el('ul', { class: 'new-on-world' }, ...end.lessons.map((line) => el('li', {}, line))),
      el('div', { class: 'actions' },
        el('button', { onclick: () => game.go('title') }, text.comingSoon.backToTitle),
        el('button', { onclick: () => game.go('credits') }, text.credits.open),
        el('button', { class: 'primary', onclick: () => game.newCampaign() }, text.title.newCampaign)),
    ),
  );
}
