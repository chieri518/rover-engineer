// The minimap, built for exploring: shaded relief of the play area hidden under an opaque fog that
// clears where the rover has been, zoomed in on the lander at first and widening to fit the explored
// area (rules/survey.ts mapView). Sites (viewpoints, rocky areas, the wall descent point, the dark
// crater's outline) appear only once discovered. Undiscovered orbital survey leads show as numbered
// arrows on the map's edge, pointing from the rover toward their areas: bearings, not markers. The
// lander, the operating boundary and the rover are always drawn. Up is local −z (grid north, toward
// Earth). The ice spot is never marked.
import { growBounds, mapView, type Bounds, type MapView, type Site } from '../rules/survey';
import type { TextFile, Tuning } from '../rules/types';
import type { HeightGrid } from '../world/terrainData';
import type { TerrainMasks } from '../world/terrainMasks';
import { el } from './dom';

const PX = 400; // display canvas pixels per side
const FOG = '#070a10';
const MARK = '#f0b429';
const COLD = 'rgba(90, 150, 255, 0.85)';
const LEAD = '#5ec8ff';
const ZOOM_RATE = 2.5; // per second: the view eases toward the explored area, so the map widens smoothly
const REVEAL_SOFT_EDGE = 0.8; // the fog fades out over the outer 20% of each reveal circle

/** An undiscovered lead, as the map draws it. */
export interface LeadArrow {
  label: string; // short tag on the arrow ("1")
  azimuth: number; // degrees from grid north (−z), toward +x
}

export class Minimap {
  readonly root: HTMLElement;
  private readonly canvas = el('canvas', { width: PX, height: PX, class: 'minimap-canvas' });
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base = document.createElement('canvas');
  private readonly fog = document.createElement('canvas');
  private readonly fogCtx: CanvasRenderingContext2D;
  private readonly leadList = el('ol', { class: 'minimap-leads' });
  private readonly sizeM: number;
  private readonly basePx: number; // base and fog pixels per side (one per terrain sample)
  private readonly baseScale: number; // base pixels per meter
  private bounds: Bounds | null = null;
  private view: MapView | null = null;
  private lastDraw = 0;
  private lastLeads = '';

  constructor(
    grid: HeightGrid,
    private readonly masks: TerrainMasks,
    private readonly boundaryM: number,
    text: TextFile,
    private readonly tuning: Tuning['minimap'],
  ) {
    this.sizeM = grid.extent * 2;
    this.basePx = grid.n - 1;
    this.baseScale = this.basePx / this.sizeM;
    this.ctx = this.canvas.getContext('2d')!;
    this.base.width = this.base.height = this.basePx;
    this.fog.width = this.fog.height = this.basePx;
    this.fogCtx = this.fog.getContext('2d')!;
    this.fogCtx.fillStyle = FOG;
    this.fogCtx.fillRect(0, 0, this.basePx, this.basePx);
    this.drawBase(grid);
    const h = text.hud;
    this.root = el('div', { class: 'minimap', role: 'img', 'aria-label': h.minimap },
      this.canvas,
      el('div', { class: 'minimap-legend' },
        el('span', { class: 'lg lander' }, h.legendLander),
        el('span', { class: 'lg viewpoint' }, h.legendViewpoint),
        el('span', { class: 'lg crater' }, h.legendCrater),
        el('span', { class: 'lg cold' }, h.legendCold),
        el('span', { class: 'lg lead' }, text.survey.legendLead),
      ),
      this.leadList,
    );
  }

  /** Shaded relief and cold zones at the terrain's own resolution, drawn once. */
  private drawBase(grid: HeightGrid): void {
    const ctx = this.base.getContext('2d')!;
    const n = this.basePx;
    const img = ctx.createImageData(n, n);
    const cell = grid.pixel;
    const light = { x: -0.6, z: -0.6, y: 0.53 };
    const cold = this.masks.cold;
    const mn = this.masks.n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // Pixel (c, r) covers the cell between samples c..c+1 and r..r+1.
        const dx = (grid.at(c + 1, r) + grid.at(c + 1, r + 1) - grid.at(c, r) - grid.at(c, r + 1)) / (2 * cell);
        const dz = (grid.at(c, r + 1) + grid.at(c + 1, r + 1) - grid.at(c, r) - grid.at(c + 1, r)) / (2 * cell);
        const len = Math.hypot(dx, dz, 1);
        const shade = Math.max(0, (-dx * light.x - dz * light.z + light.y) / len);
        const i = (r * n + c) * 4;
        const isCold = cold[Math.min(r, mn - 1) * mn + Math.min(c, mn - 1)] === 1;
        const g = 70 + shade * 170;
        img.data[i] = isCold ? 50 : g;
        img.data[i + 1] = isCold ? 95 : g;
        img.data[i + 2] = isCold ? 200 : g;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Clear the fog around a newly explored position and widen the explored area. */
  reveal(x: number, z: number, radiusM: number): void {
    this.bounds = growBounds(this.bounds, { x, z }, radiusM);
    const f = this.fogCtx;
    const cx = (x + this.sizeM / 2) * this.baseScale;
    const cy = (z + this.sizeM / 2) * this.baseScale;
    const r = radiusM * this.baseScale;
    const g = f.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(REVEAL_SOFT_EDGE, 'rgba(0, 0, 0, 1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    f.save();
    f.globalCompositeOperation = 'destination-out';
    f.fillStyle = g;
    f.beginPath();
    f.arc(cx, cy, r, 0, Math.PI * 2);
    f.fill();
    f.restore();
  }

  /** Widen the map to show a newly discovered site whole (the dark crater is larger than the reveal circle). */
  includeSite(site: Site): void {
    const a = site.area;
    const pts: [number, number][] = a.kind === 'polygon' ? a.points : [[a.x - a.r, a.z - a.r], [a.x + a.r, a.z + a.r]];
    for (const [x, z] of pts) this.bounds = growBounds(this.bounds, { x, z }, 0);
  }

  /** The list of undiscovered leads under the map (already worded, numbered like the arrows). */
  setLeads(lines: string[]): void {
    const key = lines.join('\n');
    if (key === this.lastLeads) return;
    this.lastLeads = key;
    this.leadList.replaceChildren(...lines.map((l) => el('li', {}, l)));
    this.leadList.hidden = lines.length === 0;
  }

  draw(rover: { x: number; z: number; headingX: number; headingZ: number }, sites: Site[], leads: LeadArrow[]): void {
    const ctx = this.ctx;
    const info = this.masks.info;
    const target = this.bounds ? mapView(this.bounds, this.tuning) : { cx: rover.x, cz: rover.z, spanM: this.tuning.startSpanM };
    const now = performance.now();
    const ease = 1 - Math.exp(-ZOOM_RATE * Math.min(0.5, (now - this.lastDraw) / 1000));
    this.lastDraw = now;
    const v = this.view
      ? {
        cx: this.view.cx + (target.cx - this.view.cx) * ease,
        cz: this.view.cz + (target.cz - this.view.cz) * ease,
        spanM: this.view.spanM + (target.spanM - this.view.spanM) * ease,
      }
      : target;
    this.view = v;
    const k = PX / v.spanM; // canvas px per meter
    const px = (x: number) => (x - v.cx + v.spanM / 2) * k;
    const py = (z: number) => (z - v.cz + v.spanM / 2) * k;

    // Relief under the fog, cropped to the view.
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, PX, PX);
    const sx = (v.cx - v.spanM / 2 + this.sizeM / 2) * this.baseScale;
    const sy = (v.cz - v.spanM / 2 + this.sizeM / 2) * this.baseScale;
    const sw = v.spanM * this.baseScale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, sx, sy, sw, sw, 0, 0, PX, PX);
    ctx.drawImage(this.fog, sx, sy, sw, sw, 0, 0, PX, PX);

    // Operating boundary
    ctx.strokeStyle = 'rgba(255, 122, 89, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px(-this.boundaryM), py(-this.boundaryM), 2 * this.boundaryM * k, 2 * this.boundaryM * k);

    // Discovered sites
    for (const s of sites) {
      if (!s.discovered) continue;
      const a = s.area;
      if (s.kind === 'shadowed-crater' && a.kind === 'polygon') {
        ctx.strokeStyle = COLD;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        a.points.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z))));
        ctx.closePath();
        ctx.stroke();
      } else if (a.kind === 'circle' && s.kind === 'viewpoint') {
        const x = px(a.x);
        const y = py(a.z);
        ctx.fillStyle = MARK;
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y + 5);
        ctx.lineTo(x - 6, y + 5);
        ctx.closePath();
        ctx.fill();
      } else if (a.kind === 'circle') {
        ctx.strokeStyle = MARK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px(a.x), py(a.z), s.kind === 'rocky-area' ? Math.max(4, a.r * k) : 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Lander
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(px(info.landing.local.x) - 4, py(info.landing.local.z) - 4, 8, 8);

    // Rover: an arrow along its heading
    const x = px(rover.x);
    const y = py(rover.z);
    const len = Math.hypot(rover.headingX, rover.headingZ) || 1;
    const hx = rover.headingX / len;
    const hz = rover.headingZ / len;
    ctx.fillStyle = '#7bc47f';
    ctx.strokeStyle = '#0b0c10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + hx * 12, y + hz * 12);
    ctx.lineTo(x - hx * 7 - hz * 7, y - hz * 7 + hx * 7);
    ctx.lineTo(x - hx * 7 + hz * 7, y - hz * 7 - hx * 7);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Survey leads: arrows on the map's edge, along the bearing from the rover.
    for (const l of leads) this.drawLeadArrow(x, y, l);
  }

  private drawLeadArrow(rx: number, ry: number, lead: LeadArrow): void {
    const ctx = this.ctx;
    const a = (lead.azimuth * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a); // canvas y grows toward +z (south)
    const inset = 14;
    const ox = Math.min(PX - inset, Math.max(inset, rx));
    const oy = Math.min(PX - inset, Math.max(inset, ry));
    const tx = dx > 1e-6 ? (PX - inset - ox) / dx : dx < -1e-6 ? (inset - ox) / dx : Infinity;
    const ty = dy > 1e-6 ? (PX - inset - oy) / dy : dy < -1e-6 ? (inset - oy) / dy : Infinity;
    const t = Math.min(tx, ty);
    const ex = ox + dx * t;
    const ey = oy + dy * t;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = LEAD;
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    // The tag sits just inside the arrow.
    ctx.font = 'bold 15px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#05070b';
    ctx.fillStyle = LEAD;
    ctx.strokeText(lead.label, ex - dx * 20, ey - dy * 20);
    ctx.fillText(lead.label, ex - dx * 20, ey - dy * 20);
  }
}
