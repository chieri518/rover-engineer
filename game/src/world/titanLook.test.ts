import { describe, expect, it } from 'vitest';
import titanTuning from '../../data/titan/tuning.json';
import type { TitanLookTuning } from '../rules/titanTypes';
import { marsLook } from './marsLook';
import { hexToLinear, luminance as lum, titanDirect, titanHaze, titanLook } from './titanLook';

const t = titanTuning.look as unknown as TitanLookTuning;
const look = (el: number, rain = 0) => titanLook(el, rain, t);
/** Light on level ground as the scene draws it: direct × sin(el) plus the sky light. */
const sceneLight = (l: { sun: number[]; skyLight: number[] }, el: number) =>
  lum(l.sun as [number, number, number]) * Math.max(0, Math.sin((el * Math.PI) / 180)) + lum(l.skyLight as [number, number, number]);
const NOON = 65; // the site's noon Sun in late 2034 (research track)

describe('titanLook', () => {
  it('reads its colors from data', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
  });

  it('the day sky is hazy orange-brown, darker overhead', () => {
    const noon = look(NOON);
    expect(noon.horizon[0]).toBeGreaterThan(noon.horizon[1] * 1.5);
    expect(noon.horizon[1]).toBeGreaterThan(noon.horizon[2] * 1.5);
    expect(lum(noon.zenith)).toBeLessThan(lum(noon.horizon));
    expect(noon.stars).toBe(0);
  });

  it('light is mostly diffuse: weak shadows, but the Sun still has a side', () => {
    for (const el of [15, 30, NOON]) {
      const l = look(el);
      const direct = lum(l.sun) * Math.sin((el * Math.PI) / 180);
      expect(direct, `${el}°`).toBeLessThan(0.4 * lum(l.skyLight));
      expect(direct, `${el}°`).toBeGreaterThan(0.03 * lum(l.skyLight));
    }
  });

  it('a low Sun is redder than a high one', () => {
    const low = titanDirect(5, 0, t);
    const high = titanDirect(NOON, 0, t);
    expect(low[2] / low[0]).toBeLessThan(high[2] / high[0]);
  });

  it('the day is dim but readable: darker than a clear Mars noon, not a black screen', () => {
    const titan = sceneLight(look(NOON), NOON);
    const mars = sceneLight(marsLook(60, 0), 60);
    expect(titan).toBeLessThan(mars * 0.9);
    expect(titan).toBeGreaterThan(mars * 0.35);
    // A mid-morning Sun keeps most of the light (eye adaptation), so the morning start reads clearly.
    expect(sceneLight(look(25), 25)).toBeGreaterThan(titan * 0.6);
  });

  it('dusk and dawn read clearly: the scene and sky darken through the last degrees', () => {
    const noon = sceneLight(look(NOON), NOON);
    expect(sceneLight(look(2), 2)).toBeLessThan(noon * 0.6);
    expect(sceneLight(look(-4), -4)).toBeLessThan(noon * 0.2);
    expect(lum(look(-3).horizon)).toBeLessThan(lum(look(15).horizon) * 0.25);
    // Dusk has its own warm, dark sky hue (redder than the day's).
    const dusk = look(1).horizon;
    const day = look(NOON).horizon;
    expect(dusk[0] / dusk[1]).toBeGreaterThan(day[0] / day[1]);
  });

  it('night is near black: no stars, no Sun, no Earth or Saturn to show', () => {
    const night = look(-30);
    expect(lum(night.horizon)).toBeLessThan(0.005);
    expect(lum(night.zenith)).toBeLessThan(0.005);
    expect(lum(night.skyLight)).toBeLessThan(sceneLight(look(NOON), NOON) * 0.02);
    expect(night.stars).toBe(0);
    expect(night.sunDisc).toBe(0);
  });

  it('the Sun is a faint disc behind the haze', () => {
    expect(look(NOON).sunDisc).toBeGreaterThan(0.1);
    expect(look(NOON).sunDisc).toBeLessThan(0.6);
    expect(look(2).sunDisc).toBeLessThan(look(NOON).sunDisc);
  });

  it('the haze limits visibility to a few kilometers; rain closes it in to a few hundred meters', () => {
    const d95 = (l: { fogDensity: number; fogShape: number }) => Math.pow(3, 1 / l.fogShape) / l.fogDensity; // the haze hides 95% here
    expect(d95(look(NOON))).toBeGreaterThan(2000);
    expect(d95(look(NOON))).toBeLessThan(8000);
    expect(d95(look(NOON, 1))).toBeGreaterThan(150);
    expect(d95(look(NOON, 1))).toBeLessThan(400);
    expect(d95(look(NOON, 0.5))).toBeLessThan(d95(look(NOON)) * 0.5); // the haze closes in early
  });

  it('the day haze is soft: dune relief within 3 km still shows, distant terrain melts into the sky (T8)', () => {
    const l = look(NOON);
    expect(titanHaze(1000, l)).toBeGreaterThan(0.15); // a nearer haze: lower contrast already at 1 km
    expect(titanHaze(3000, l)).toBeLessThan(0.75);
    expect(titanHaze(10000, l)).toBeGreaterThan(0.97);
    expect(titanHaze(250, look(NOON, 1))).toBeGreaterThan(0.8); // rain: about 250 m visibility
  });

  it('the light dims visibly in the last degrees before sunset (T8)', () => {
    const noon = sceneLight(look(NOON), NOON);
    expect(sceneLight(look(11), 11)).toBeLessThan(noon * 0.85); // about 30 s before sunset
    expect(sceneLight(look(3), 3)).toBeLessThan(noon * 0.4);
    expect(lum(look(3).horizon)).toBeLessThan(lum(look(NOON).horizon) * 0.6);
  });

  it('rain darkens the scene, hides the Sun and draws streaks', () => {
    const clear = look(NOON);
    const wet = look(NOON, 1);
    expect(sceneLight(wet, NOON)).toBeLessThan(sceneLight(clear, NOON) * 0.6);
    expect(sceneLight(wet, NOON)).toBeGreaterThan(sceneLight(clear, NOON) * 0.2); // still drivable
    expect(wet.sunDisc).toBe(0);
    expect(clear.rainStreaks).toBe(0);
    expect(wet.rainStreaks).toBeGreaterThan(0);
  });

  it('values stay displayable and finite everywhere', () => {
    for (let el = -90; el <= 90; el += 1.5) {
      for (const rain of [0, 0.5, 1]) {
        const l = look(el, rain);
        for (const c of [l.horizon, l.zenith, l.fog]) for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
        for (const c of [l.sun, l.skyLight, l.groundLight, l.glow, l.rainColor]) for (const v of c) expect(Number.isFinite(v) && v >= 0).toBe(true);
        expect(Number.isFinite(l.fogDensity) && l.fogDensity > 0).toBe(true);
      }
    }
  });
});
