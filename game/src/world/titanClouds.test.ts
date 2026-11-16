import { describe, expect, it } from 'vitest';
import titanTuning from '../../data/titan/tuning.json';
import type { TitanLookTuning } from '../rules/titanTypes';
import { titanCloudLook } from './titanClouds';
import { luminance as lum, titanLook } from './titanLook';

const t = titanTuning.look as unknown as TitanLookTuning;
const c = t.clouds!;
const clouds = (el: number, rain = 0) => titanCloudLook(el, rain, titanLook(el, rain, t), t, c);

describe('titan clouds (demo visuals)', () => {
  it('are configured in data', () => {
    expect(c).toBeDefined();
    expect(c.opacity).toBeGreaterThan(0);
    expect(c.opacity).toBeLessThan(1);
  });

  it('are faint by day and nearly invisible at night', () => {
    const day = clouds(40);
    const night = clouds(-20);
    expect(day.opacity).toBeLessThanOrEqual(c.opacity + 1e-9);
    expect(night.opacity).toBeLessThan(0.3 * day.opacity);
    expect(lum(night.lit)).toBeLessThan(0.05 * lum(day.lit));
  });

  it('are warmer at dusk than by day', () => {
    const day = clouds(40);
    const dusk = clouds(2);
    expect(dusk.lit[2] / dusk.lit[0]).toBeLessThan(day.lit[2] / day.lit[0]);
  });

  it('thicken and darken in the rain', () => {
    const dry = clouds(30);
    const wet = clouds(30, 1);
    expect(wet.opacity).toBeGreaterThan(dry.opacity);
    expect(wet.coverage).toBeLessThan(dry.coverage);
    expect(lum(wet.lit)).toBeLessThan(lum(dry.lit));
  });

  it('cast gentle shadows by day only, none at night or in the rain', () => {
    expect(clouds(40).shadow).toBeGreaterThan(0);
    expect(clouds(40).shadow).toBeLessThanOrEqual(0.3);
    expect(clouds(-5).shadow).toBe(0);
    expect(clouds(40, 1).shadow).toBe(0);
  });
});
