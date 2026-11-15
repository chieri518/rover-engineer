// Simple minimap: shaded relief of the 8 km play area under a fog that clears where the rover has
// been, permanent-shadow cold zones (the dark crater), markers for craters and viewpoint zones from
// terrain.json, the lander, the operating boundary, and the rover. Up is local −z (grid north, toward
// Earth). The exact ice spot is not marked: players search the dark crater by drilling.
import type { TextFile } from '../rules/types';
import type { HeightGrid } from '../world/terrainData';
import type { TerrainMasks } from '../world/terrainMasks';
import { el } from './dom';

const PX = 400; // canvas pixels per side (20 m per pixel over 8 km)
const FOG = 'rgba(6, 7, 10, 0.86)';
const MARK = '#f0b429';
const COLD = 'rgba(90, 150, 255, 0.85)';

export class Minimap {
  readonly root: HTMLElement;
  private readonly canvas = el('canvas', { width: PX, height: PX, class: 'minimap-canvas' });
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base = document.createElement('canvas');
  private readonly fog = document.createElement('canvas');
  private readonly fogCtx: CanvasRenderingContext2D;
  private readonly scale: number; // canvas px per meter
  private readonly sizeM: number;

  constructor(
    grid: HeightGrid,
    private readonly masks: TerrainMasks,
    private readonly boundaryM: number,
    text: TextFile,
  ) {
    this.sizeM = grid.extent * 2;
    this.scale = PX / this.sizeM;
    this.ctx = this.canvas.getContext('2d')!;
    this.base.width = this.base.height = PX;
    this.fog.width = this.fog.height = PX;
    this.fogCtx = this.fog.getContext('2d')!;
    this.fogCtx.fillStyle = FOG;
    this.fogCtx.fillRect(0, 0, PX, PX);
    this.drawBase(grid);
    const h = text.hud;
    this.root = el('div', { class: 'minimap', role: 'img', 'aria-label': h.minimap },
      this.canvas,
      el('div', { class: 'minimap-legend' },
        el('span', { class: 'lg lander' }, h.legendLander),
        el('span', { class: 'lg viewpoint' }, h.legendViewpoint),
        el('span', { class: 'lg crater' }, h.legendCrater),
        el('span', { class: 'lg cold' }, h.legendCold),
      ),
    );
  }

  private px(x: number): number {
    return (x + this.sizeM / 2) * this.scale;
  }

  /** Shaded relief and cold zones, drawn once. */
  private drawBase(grid: HeightGrid): void {
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(PX, PX);
    const step = (grid.n - 1) / PX;
    const cell = this.sizeM / PX;
    const light = { x: -0.6, z: -0.6, y: 0.53 };
    for (let r = 0; r < PX; r++) {
      for (let c = 0; c < PX; c++) {
        const x = (c + 0.5) * cell - this.sizeM / 2;
        const z = (r + 0.5) * cell - this.sizeM / 2;
        const dx = (grid.sample(x + cell, z) - grid.sample(x - cell, z)) / (2 * cell);
        const dz = (grid.sample(x, z + cell) - grid.sample(x, z - cell)) / (2 * cell);
        const len = Math.hypot(dx, dz, 1);
        const shade = Math.max(0, (-dx * light.x - dz * light.z + light.y) / len);
        const i = (r * PX + c) * 4;
        const col = Math.round(c * step);
        const row = Math.round(r * step);
        const cold = this.masks.cold[row * grid.n + col] === 1;
        const g = 70 + shade * 170;
        img.data[i] = cold ? 50 : g;
        img.data[i + 1] = cold ? 95 : g;
        img.data[i + 2] = cold ? 200 : g;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Clear the fog around a newly explored position. */
  reveal(x: number, z: number, radiusM: number): void {
    const f = this.fogCtx;
    f.save();
    f.globalCompositeOperation = 'destination-out';
    f.beginPath();
    f.arc(this.px(x), this.px(z), radiusM * this.scale, 0, Math.PI * 2);
    f.fill();
    f.restore();
  }

  draw(rover: { x: number; z: number; headingX: number; headingZ: number }): void {
    const ctx = this.ctx;
    const info = this.masks.info;
    const f = info.features;
    ctx.clearRect(0, 0, PX, PX);
    ctx.drawImage(this.base, 0, 0);
    ctx.drawImage(this.fog, 0, 0);

    // Operating boundary
    ctx.strokeStyle = 'rgba(255, 122, 89, 0.6)';
    ctx.lineWidth = 1;
    const b0 = this.px(-this.boundaryM);
    ctx.strokeRect(b0, b0, this.px(this.boundaryM) - b0, this.px(this.boundaryM) - b0);

    // Shadowed crater outline (known from orbit, so drawn over the fog)
    ctx.strokeStyle = COLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    f.shadowedCrater.outlineLocal_xz.forEach(([x, z], i) => (i ? ctx.lineTo(this.px(x), this.px(z)) : ctx.moveTo(this.px(x), this.px(z))));
    ctx.closePath();
    ctx.stroke();

    // Craters: rocky areas (small fresh craters) and the de Gerlache wall descent
    ctx.strokeStyle = MARK;
    ctx.lineWidth = 1.5;
    for (const a of f.rockyAreas) {
      ctx.beginPath();
      ctx.arc(this.px(a.local.x), this.px(a.local.z), Math.max(4, a.radius_m * this.scale), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(this.px(f.craterDescent.local.x), this.px(f.craterDescent.local.z), 6, 0, Math.PI * 2);
    ctx.stroke();

    // Viewpoint zones
    ctx.fillStyle = MARK;
    for (const v of f.rimViewpoints) {
      const x = this.px(v.local.x);
      const y = this.px(v.local.z);
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y + 5);
      ctx.lineTo(x - 6, y + 5);
      ctx.closePath();
      ctx.fill();
    }

    // Lander
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(this.px(info.landing.local.x) - 4, this.px(info.landing.local.z) - 4, 8, 8);

    // Rover: an arrow along its heading
    const x = this.px(rover.x);
    const y = this.px(rover.z);
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
  }
}
