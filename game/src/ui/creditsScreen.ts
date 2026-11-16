// Data sources and credits, generated from the source metadata in the data files: terrain.json and
// texture.json (fetched at runtime, as the mission does), events.json, milestones.json and text.json.
// Every world is listed, whichever world the campaign is on.
import type { Screen } from '../flow/flow';
import type { CreditEntry, GameData, HistoryKey, TextFile } from '../rules/types';
import { el, fill } from './dom';
import { terrainUrl, WORLD_IDS, type WorldId } from '../worlds';

/** The fields of public/terrain/terrain.json this screen reads. */
interface TerrainSources {
  sources?: { dataset: string; url?: string | string[]; citation?: string; provider?: string }[];
  credits?: string[];
}

/** The fields of public/terrain/texture.json this screen reads. */
interface TextureSource {
  source?: { dataset: string; url?: string; page?: string; citation?: string; credit?: string; license?: string };
}

const HISTORY_KEYS: HistoryKey[] = ['survived', 'energy', 'stuck', 'froze', 'destroyed', 'rollover'];

// Full URLs, DOIs, and bare host/path references such as "science.nasa.gov/mission/lro".
const LINK = /https?:\/\/[^\s)]+|doi:\s?10\.\d{4,9}\/[^\s,;)]+|(?<![\w.\-/@])(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s,;)]*/gi;

function link(label: string, href: string): HTMLAnchorElement {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

/** Text with its URLs, DOIs and host/path references turned into links. */
function linkify(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    let raw = m[0];
    const trail = /[.,;:]+$/.exec(raw)?.[0] ?? '';
    raw = raw.slice(0, raw.length - trail.length);
    const start = m.index ?? 0;
    out.push(text.slice(at, start));
    const doi = /^doi:\s?(.+)$/i.exec(raw);
    const href = doi ? `https://doi.org/${doi[1]}` : /^https?:/i.test(raw) ? raw : `https://${raw}`;
    out.push(link(raw, href));
    at = start + raw.length;
  }
  out.push(text.slice(at));
  return out.filter((n) => n !== '');
}

function entry(label: string | null, ...lines: (string | Node[] | null | undefined | false)[]): HTMLLIElement {
  return el('li', { class: 'credit' },
    label && el('strong', {}, label),
    ...lines.filter((l): l is string | Node[] => Boolean(l))
      .map((l) => el('span', { class: 'credit-line' }, ...(typeof l === 'string' ? linkify(l) : l))),
  );
}

function urls(url: string | string[] | undefined): Node[] | null {
  const list = url === undefined ? [] : Array.isArray(url) ? url : [url];
  if (list.length === 0) return null;
  return list.flatMap((u, i) => (i === 0 ? [link(u, u)] : [el('br'), link(u, u)]));
}

function handEntry(e: CreditEntry): HTMLLIElement {
  return entry(e.label, e.text, e.citation, urls(e.url));
}

async function fetchJson<T>(world: WorldId, file: string): Promise<T> {
  const res = await fetch(terrainUrl(world, file));
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return (await res.json()) as T;
}

function terrainList(info: TerrainSources, c: TextFile['credits']): Node[] {
  const sources = info.sources ?? [];
  if (sources.length === 0 && !info.credits?.length) throw new Error('no terrain sources');
  return [
    ...(info.credits ?? []).map((line) => el('p', {}, line)),
    el('ul', { class: 'credit-list' },
      ...sources.map((s) => entry(s.dataset, s.citation, s.provider && fill(c.provider, { provider: s.provider }), urls(s.url)))),
  ];
}

function imageryList(info: TextureSource, c: TextFile['credits']): Node[] {
  const s = info.source;
  if (!s) throw new Error('no texture source');
  return [
    el('ul', { class: 'credit-list' },
      entry(s.dataset,
        s.credit && fill(c.imageCredit, { credit: s.credit }),
        s.citation,
        s.license && fill(c.license, { license: s.license }),
        urls(s.url),
        s.page ? [link(c.productPage, s.page)] : null,
      )),
  ];
}

function fallback(c: TextFile['credits'], lines: string[]): Node[] {
  return [el('p', { class: 'note' }, c.loadFailed), ...lines.map((l) => el('p', {}, l))];
}

/** A source line that is filled in (stub data files mark theirs "[placeholder]"). */
function isReal(s: string | undefined): s is string {
  return Boolean(s) && !s!.startsWith('[placeholder');
}

/** One entry per source behind a relationship, skipping sources already listed under the instrument facts. */
function relationshipEntries(data: GameData): HTMLLIElement[] {
  const seen = new Set<string>();
  for (const p of data.parts.parts) {
    const src = p.effects.instrument ? data.text.instrumentText[p.effects.instrument]?.source : undefined;
    if (src) seen.add(src);
  }
  // No lesson names: undiscovered lessons stay hidden (the notebook shows them only as a count).
  const sources = new Set<string>();
  for (const r of data.relationships.relationships) if (r.source && !seen.has(r.source)) sources.add(r.source);
  return [...sources].map((source) => entry(null, source));
}

export const creditsScreen: Screen = (game, root) => {
  // The shared sections (intro, soil, drive speeds) come from the shared text; each world then lists
  // its own terrain, imagery, events, milestone facts and debrief comparisons.
  const shared = game.dataOf('moon');
  const c = shared.text.credits;
  const disposed = { value: false };
  const back = el('button', { class: 'primary', type: 'button', onclick: () => game.go('title') }, c.back);

  root.append(
    el('section', { class: 'panel credits' },
      el('h2', {}, c.heading),
      el('p', {}, c.intro),
      el('p', { class: 'credits-disclaimer' }, c.disclaimer),
      el('p', { class: 'note' }, shared.text.moneyNote),

      ...WORLD_IDS.map((w) => worldCredits(w, game.dataOf(w), shared, disposed)),

      el('section', { class: 'credit-world' },
        section(c.soil,
          el('ul', { class: 'credit-list' },
            ...c.soilEntries.map(handEntry),
            entry(c.speedLabel, shared.text.design.speedInfoSources))),
        section(c.generatedHeading, el('p', {}, c.generated)),
      ),

      el('div', { class: 'actions' }, back),
    ),
  );

  return () => {
    disposed.value = true;
  };
};

function section(heading: string, ...body: (Node | false | null | undefined)[]): HTMLElement {
  return el('section', { class: 'credit-section' }, el('h3', {}, heading), ...body.filter((n): n is Node => Boolean(n)));
}

/** One world's sources: terrain and imagery (fetched from its terrain folder), events, milestones, debrief. */
function worldCredits(world: WorldId, data: GameData, shared: GameData, disposed: { value: boolean }): HTMLElement {
  const { text } = data;
  const c = text.credits;
  const loading = () => el('div', { class: 'credit-async' }, el('p', { class: 'muted' }, c.loading));
  const terrain = loading();
  const imagery = loading();
  const flare = data.events.flare;
  const storm = data.events.duststorm;
  const historyLabel = (k: HistoryKey) => (k === 'survived' ? c.survivedLabel : k === 'rollover' ? text.debrief.rollover : text.causes[k]);
  // Other worlds list only the debrief comparisons they replace.
  const historyKeys = HISTORY_KEYS.filter((k) => world === 'moon' || text.historySources[k] !== shared.text.historySources[k]);
  const milestones = data.milestones.milestones.filter((m) => isReal(m.source));
  const landing = text.campaign;

  void fetchJson<TerrainSources>(world, 'terrain.json')
    .then((info) => terrainList(info, c))
    .catch(() => fallback(c, c.terrainFallback))
    .then((nodes) => { if (!disposed.value) terrain.replaceChildren(...nodes); });
  void fetchJson<TextureSource>(world, 'texture.json')
    .then((info) => imageryList(info, c))
    .catch(() => fallback(c, [c.imageryFallback]))
    .then((nodes) => { if (!disposed.value) imagery.replaceChildren(...nodes); });

  return el('section', { class: 'credit-world', 'data-world': world },
    el('h2', { class: 'credit-world-heading' }, text.worlds[world]),
    section(c.terrain, terrain),
    section(c.imagery, imagery),
    flare && section(c.spaceWeather,
      el('ul', { class: 'credit-list' },
        entry(null, flare.source,
          fill(c.flaresUsed, { list: flare.realFlares.map((f) => `${f.class} (${f.date})`).join(', ') })))),
    storm && (isReal(storm.source) || isReal(text.storm?.credit)) && section(c.spaceWeather,
      el('ul', { class: 'credit-list' }, entry(null, isReal(storm.source) && storm.source, isReal(text.storm?.credit) && text.storm!.credit))),
    landing && isReal(landing.sources) && section(landing.sourcesLabel,
      el('ul', { class: 'credit-list' }, entry(null, landing.sources))),
    (milestones.length > 0 || world === 'moon') && section(c.milestones,
      el('ul', { class: 'credit-list' },
        ...milestones.map((m) => entry(m.name, m.source)))),
    // The instruments and the relationships are the Moon's (the parts are shared; every relationship is a Moon one).
    world === 'moon' && section(c.instrumentsLabel,
      el('ul', { class: 'credit-list' },
        ...data.parts.parts.flatMap((p) => {
          const it = p.effects.instrument ? text.instrumentText[p.effects.instrument] : undefined;
          return it?.source ? [entry(p.name, it.source)] : [];
        }))),
    world === 'moon' && section(c.relationshipsLabel, el('ul', { class: 'credit-list' }, ...relationshipEntries(data))),
    historyKeys.length > 0 && section(c.debrief,
      el('ul', { class: 'credit-list' }, ...historyKeys.map((k) => entry(historyLabel(k), text.historySources[k])))),
  );
}
