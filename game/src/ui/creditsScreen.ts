// Data sources and credits, generated from the source metadata in the data files: terrain.json and
// texture.json (fetched at runtime, as the mission does), events.json, milestones.json and text.json.
import type { Screen } from '../flow/flow';
import type { CreditEntry, HistoryKey, TextFile } from '../rules/types';
import { el, fill } from './dom';
import { terrainUrl, type WorldId } from '../worlds';

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

export const creditsScreen: Screen = (game, root) => {
  const { data } = game;
  const { text } = data;
  const c = text.credits;
  const flare = data.events.flare;
  let disposed = false;

  const loading = () => el('div', { class: 'credit-async' }, el('p', { class: 'muted' }, c.loading));
  const terrain = loading();
  const imagery = loading();
  const section = (heading: string, ...body: Node[]) => el('section', { class: 'credit-section' }, el('h3', {}, heading), ...body);
  const historyLabel = (k: HistoryKey) => (k === 'survived' ? c.survivedLabel : k === 'rollover' ? text.debrief.rollover : text.causes[k]);
  const back = el('button', { class: 'primary', type: 'button', onclick: () => game.go('title') }, c.back);

  root.append(
    el('section', { class: 'panel credits' },
      el('h2', {}, c.heading),
      el('p', {}, c.intro),
      el('p', { class: 'credits-disclaimer' }, c.disclaimer),
      el('p', { class: 'note' }, text.moneyNote),

      section(c.terrain, terrain),
      section(c.imagery, imagery),
      flare && section(c.spaceWeather,
        el('ul', { class: 'credit-list' },
          entry(null, flare.source,
            fill(c.flaresUsed, { list: flare.realFlares.map((f) => `${f.class} (${f.date})`).join(', ') })))),
      section(c.soil,
        el('ul', { class: 'credit-list' },
          ...c.soilEntries.map(handEntry),
          entry(c.speedLabel, text.design.speedInfoSources))),
      section(c.milestones,
        el('ul', { class: 'credit-list' },
          ...data.milestones.milestones.filter((m) => m.source).map((m) => entry(m.name, m.source)),
          entry(c.drillHydrogenLabel, text.drill.hydrogenSource))),
      section(c.debrief,
        el('ul', { class: 'credit-list' }, ...HISTORY_KEYS.map((k) => entry(historyLabel(k), text.historySources[k])))),
      section(c.generatedHeading, el('p', {}, c.generated)),

      el('div', { class: 'actions' }, back),
    ),
  );

  void fetchJson<TerrainSources>(game.world, 'terrain.json')
    .then((info) => terrainList(info, c))
    .catch(() => fallback(c, c.terrainFallback))
    .then((nodes) => { if (!disposed) terrain.replaceChildren(...nodes); });
  void fetchJson<TextureSource>(game.world, 'texture.json')
    .then((info) => imageryList(info, c))
    .catch(() => fallback(c, [c.imageryFallback]))
    .then((nodes) => { if (!disposed) imagery.replaceChildren(...nodes); });

  return () => {
    disposed = true;
  };
};
