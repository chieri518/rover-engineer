// The desk's mission brief icons (game-design.md, "the header reads at a glance"): small line drawings on a
// 16 by 16 grid, stroked in the current colour. The data names an icon (text.json design.brief); this draws it.
import type { BriefIcon } from '../rules/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Each icon's path data (stroked, no fill; round caps and joins). */
export const BRIEF_ICONS: Record<BriefIcon, string> = {
  flare: 'M8 5.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13',
  quake: 'M1 8h3l1.5-5l2.5 10l2-7l1.2 2H15',
  slope: 'M1 13.5L6 4.5l3 5l2-3l4 7z',
  sand: 'M1 6c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0c1.4-1.3 2.6-1.4 4-.4M1 11c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0c1.4-1.3 2.6-1.4 4-.4',
  cold: 'M8 1v14M2 4.5l12 7M2 11.5l12-7M6.3 2.3L8 3.8l1.7-1.5M6.3 13.7L8 12.2l1.7 1.5',
  night: 'M10.5 2.2A6 6 0 1 0 13.8 10A5 5 0 0 1 10.5 2.2z',
  storm: 'M1.5 5.5h8a2 2 0 1 0-2-2M1.5 8.5h11a2 2 0 1 1-2 2M3.5 11.5h4',
  rain: 'M4.5 9.5a3 3 0 0 1 .4-6a3.8 3.8 0 0 1 7 1.2a2.4 2.4 0 0 1-.4 4.8zM5 12l-.8 2M8 12l-.8 2M11 12l-.8 2',
  haze: 'M5 7a3 3 0 0 1 6 0M1.5 9.5h13M3 12h10M5 14.5h6',
  layers: 'M1.5 4.5h13M1.5 7.5h13M1.5 10.5h13M1.5 13.5h13M5 4.5v3M10 7.5v3M7 10.5v3',
  rock: 'M2 12.5l1.5-5L7 4l4.5 1.2l2.5 4.3l-1 3z',
  hydrogen: 'M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M5.5 5v6M10.5 5v6M5.5 8h5',
  radar: 'M1 5.5h14M4.5 5.5a3.5 3.5 0 0 0 7 0M2.5 5.5a5.5 5.5 0 0 0 11 0M8 5.5V2',
  sky: 'M4 12.5a3 3 0 0 1 .3-6a4 4 0 0 1 7.5 1.4a2.3 2.3 0 0 1-.3 4.6z',
  earth: 'M8 2.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8M8 2.5c-1.6 1.8-1.6 6.2 0 8M4 6.5h8M1 13.5h14',
  view: 'M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8zM8 6a2 2 0 1 1 0 4a2 2 0 1 1 0-4',
  organics: 'M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5zM8 4.2l3.3 1.9v3.8L8 11.8L4.7 9.9V6.1z',
};

/** An icon as an inline SVG, hidden from screen readers (the item's words say it). */
export function briefIcon(name: BriefIcon): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'brief-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', BRIEF_ICONS[name] ?? '');
  svg.append(path);
  return svg;
}
