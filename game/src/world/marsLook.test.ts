import { describe, expect, it } from 'vitest';
import { marsAirmass, marsDirect, marsLevelLight, marsLook } from './marsLook';

const lum = (c: number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
const total = marsLevelLight;

describe('marsLook', () => {
  it('airmass is 1 overhead and about 25 at the horizon', () => {
    expect(marsAirmass(90)).toBeCloseTo(1, 3);
    expect(marsAirmass(0)).toBeGreaterThan(20);
    expect(marsAirmass(0)).toBeLessThan(30);
    expect(marsAirmass(-10)).toBe(marsAirmass(0));
  });

  it('sunlight through the dust grows with the Sun height and is gone at night', () => {
    let last = -1;
    for (const el of [0, 2, 5, 10, 20, 40, 63]) {
      const s = lum(marsDirect(el, 0));
      expect(s).toBeGreaterThan(last);
      last = s;
    }
    expect(lum(marsLook(-5, 0).sun)).toBe(0);
  });

  it('a low Sun is redder than a high one (dust absorbs blue)', () => {
    const low = marsLook(4, 0).sun;
    const high = marsLook(60, 0).sun;
    expect(low[2] / low[0]).toBeLessThan(high[2] / high[0]);
  });

  it('the day sky is butterscotch and the sunset glow is blue', () => {
    const noon = marsLook(60, 0);
    expect(noon.horizon[0]).toBeGreaterThan(noon.horizon[2] * 2);
    const sunset = marsLook(1, 0);
    expect(sunset.glow[2]).toBeGreaterThan(sunset.glow[0] * 1.5);
    // Around the setting Sun the glow outshines the sky away from it.
    expect(lum(sunset.glow)).toBeGreaterThan(lum(sunset.horizon));
  });

  it('a Sun up to about 15° wears a blue halo: at the Sun the sky reads blue, not mauve', () => {
    for (const el of [1, 5, 10, 15]) {
      const l = marsLook(el, 0);
      const atSun = l.horizon.map((v, i) => v * (1 - l.glowReplace) + l.glow[i]!);
      expect(atSun[2], `${el}°`).toBeGreaterThan(atSun[0]! * 1.25);
    }
    expect(marsLook(40, 0).glowReplace).toBe(0); // a high Sun has only the pale day aureole
  });

  it('a low morning Sun still gives a readable sky, not a gloomy grey-brown one', () => {
    expect(lum(marsLook(5, 0).horizon)).toBeGreaterThan(lum(marsLook(60, 0).horizon) * 0.35);
    expect(lum(marsLook(15, 0).horizon)).toBeGreaterThan(lum(marsLook(60, 0).horizon) * 0.6);
    expect(lum(marsLook(-6, 0).horizon)).toBeLessThan(lum(marsLook(5, 0).horizon) * 0.2); // twilight still darkens
  });

  it('night is dark with stars; day has none', () => {
    const night = marsLook(-25, 0);
    expect(night.stars).toBeGreaterThan(0.95);
    expect(night.sunDisc).toBe(0);
    expect(lum(night.horizon)).toBeLessThan(0.01);
    expect(lum(night.skyLight)).toBeLessThan(lum(marsLook(60, 0).skyLight) * 0.15);
    expect(marsLook(30, 0).stars).toBe(0);
  });

  it('eye adaptation brightens a low Sun, but the scene still darkens toward sunset', () => {
    expect(lum(marsLook(10, 0).sun)).toBeGreaterThan(lum(marsDirect(10, 0)) * 6.5);
    expect(lum(marsLook(3, 0).sun) + lum(marsLook(3, 0).skyLight)).toBeLessThan(lum(marsLook(60, 0).sun) + lum(marsLook(60, 0).skyLight));
  });

  it('a full storm cuts total light to about a third, direct light far more, and thickens the haze', () => {
    const ratio = total(60, 1) / total(60, 0);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.45);
    expect(lum(marsDirect(60, 1))).toBeLessThan(lum(marsDirect(60, 0)) * 0.2);
    // On screen the storm still reads darker and flatter: weaker sunlight against the sky light.
    const clear = marsLook(60, 0);
    const dusty = marsLook(60, 1);
    expect(lum(dusty.sun) / lum(dusty.skyLight)).toBeLessThan((lum(clear.sun) / lum(clear.skyLight)) * 0.5);
    // Peak storm visibility is a few hundred meters: exp² fog hides 95% of the terrain by ~350 m.
    const d95 = Math.sqrt(3) / marsLook(60, 1).fogDensity;
    expect(d95).toBeGreaterThan(250);
    expect(d95).toBeLessThan(500);
    expect(Math.sqrt(3) / marsLook(60, 0).fogDensity).toBeGreaterThan(30000);
    // Sky and horizon merge, and the Sun is a dim smudge.
    expect(lum(dusty.zenith) / lum(dusty.horizon)).toBeGreaterThan(0.8);
    expect(dusty.sunDisc).toBeLessThan(0.2);
    expect(marsLook(-25, 1).stars).toBe(0);
  });

  it('sky values stay displayable and finite everywhere', () => {
    for (let el = -90; el <= 90; el += 1.5) {
      for (const storm of [0, 0.5, 1]) {
        const l = marsLook(el, storm);
        for (const c of [l.horizon, l.zenith, l.fog]) for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
        for (const c of [l.sun, l.skyLight, l.groundLight, l.glow]) for (const v of c) expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
  });
});
