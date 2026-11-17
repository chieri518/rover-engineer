// Mars step 6a: the dust devil columns and the laser target marker (no renderer needed).
import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { dustDevilPosition, placeDustDevil } from '../rules/dust';
import { DEVIL_FRAME_HEIGHTS, DustDevils, devilAlpha, devilFramePoints, dustDevilColumns } from './dustDevil';
import { LaserMarker } from './laserMarker';

const spec = worldGameData('mars').events.dustdevil!;
const a = placeDustDevil({ at: 100, passM: 50, headingDeg: 90, side: 1 }, spec, { x: 0, z: 0 });
const b = placeDustDevil({ at: 200, passM: 120, headingDeg: 200, side: -1 }, spec, { x: 300, z: -40 });

describe('dust devil columns', () => {
  it('lists only the devils standing now, where the rules put them', () => {
    expect(dustDevilColumns([a, b], 99, spec)).toEqual([]);
    const mid = a.at + spec.lifeSeconds / 2;
    const cols = dustDevilColumns([a, b], mid, spec);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject(dustDevilPosition(a, mid));
    expect(cols[0]!.strength).toBe(1);
    expect(dustDevilColumns([a, b], a.endAt, spec)).toEqual([]);
    expect(dustDevilColumns([a, b], b.at + 1, spec).map((c) => c.strength)[0]).toBeGreaterThan(0);
  });

  it('ramps in after it forms', () => {
    const early = dustDevilColumns([a], a.at + spec.rampSeconds / 4, spec)[0]!.strength;
    const later = dustDevilColumns([a], a.at + spec.rampSeconds / 2, spec)[0]!.strength;
    expect(early).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(early);
  });

  it('tries points up the column, from near the ground to well up it', () => {
    const pts = devilFramePoints({ x: 5, z: -7 }, 10, spec.heightM);
    expect(pts).toHaveLength(DEVIL_FRAME_HEIGHTS.length);
    for (const p of pts) expect(p).toMatchObject({ x: 5, z: -7 });
    expect(pts[0]!.y).toBeGreaterThan(10);
    expect(pts.at(-1)!.y).toBeLessThan(10 + spec.heightM);
  });

  it('is see-through and fades out at the top', () => {
    for (let v = 0; v <= 1; v += 0.1) for (let u = 0; u < 1; u += 0.1) {
      expect(devilAlpha(u, v)).toBeGreaterThanOrEqual(0);
      expect(devilAlpha(u, v)).toBeLessThanOrEqual(1);
    }
    expect(devilAlpha(0.3, 1)).toBe(0);
    expect(Math.max(...[0, 0.1, 0.2, 0.3].map((u) => devilAlpha(u, 0.1)))).toBeGreaterThan(0.4);
  });

  it('draws one column per standing devil on the ground under it', () => {
    const devils = new DustDevils(spec);
    const ground = (x: number, z: number) => 0.01 * x - 0.02 * z;
    devils.update([a, b], a.at + 5, ground, 1 / 60);
    const shown = devils.group.children.filter((c) => c.visible);
    expect(shown).toHaveLength(1);
    const c = devils.columns[0]!;
    expect(shown[0]!.position.toArray()).toEqual([c.x, ground(c.x, c.z), c.z]);
    devils.update([a, b], 10_000, ground, 1 / 60);
    expect(devils.group.children.filter((o) => o.visible)).toHaveLength(0);
    expect(devils.columns).toEqual([]);
    devils.dispose();
  });
});

describe('laser target marker', () => {
  it('hovers above the target top and hides with no target', () => {
    const m = new LaserMarker();
    expect(m.object.visible).toBe(false);
    m.set({ x: 3, z: 4, topY: 10 });
    expect(m.object.visible).toBe(true);
    expect(m.object.position.x).toBe(3);
    expect(m.object.position.z).toBe(4);
    for (let i = 0; i < 30; i++) {
      m.update(0.05);
      expect(m.object.position.y).toBeGreaterThan(10);
      expect(m.object.position.y).toBeLessThan(11.5);
    }
    // The cone's tip is its lowest point, at the object's origin.
    m.object.geometry.computeBoundingBox();
    expect(m.object.geometry.boundingBox!.min.y).toBeCloseTo(0, 6);
    m.set(null);
    expect(m.object.visible).toBe(false);
    m.dispose();
  });
});
