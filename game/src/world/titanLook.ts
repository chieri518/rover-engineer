// Titan sky and light through the one long day, from two inputs: the Sun's elevation and the methane
// rain intensity. Pure math (no three, no DOM) so it can be unit tested; the scene (moonScene.ts,
// titanSky.ts) applies it. Every number comes from data (data/titan/tuning.json `look`).
//
// Titan's thick nitrogen atmosphere and orange organic haze scatter almost all sunlight before it
// reaches the ground: the light is dim, nearly all diffuse (so shadows are weak and soft), orange,
// and the haze limits how far one can see. The direct beam is a small share that reddens with the
// Sun's airmass; sky light follows the Sun's height and lingers into a long twilight. Real daylight is
// about a thousandth of Earth's; the game keeps it readable with a capped eye adaptation (as a camera's
// exposure would), so a moody but legible dim-orange world, darkening clearly at dusk, near black at night.
// Rain thickens the haze, darkens the scene and closes in the visibility.
import type { TitanLookTuning } from '../rules/titanTypes';

export type RGB = [number, number, number];

/** Same fields as MarsLook (so the scene applies both the same way), plus the rain streaks. */
export interface TitanLook {
  /** Directional sunlight: linear color with intensity folded in (THREE.DirectionalLight units). */
  sun: RGB;
  /** Sky light on the scene (hemisphere light): color from above and from below, linear with intensity. */
  skyLight: RGB;
  groundLight: RGB;
  /** Sky dome, displayed values (linear, 0..1, not tone-mapped). */
  zenith: RGB;
  horizon: RGB;
  /** Added to the sky around the Sun's direction, falling off over glowWidthDeg. */
  glow: RGB;
  glowWidthDeg: number;
  /** Share of the sky color the glow replaces at the Sun (0..1). */
  glowReplace: number;
  /** Opacity of the Sun's faint disc behind the haze, 0..1, and its color (linear). */
  sunDisc: number;
  sunDiscColor: RGB;
  /** Star brightness, 0..1 (always 0 on Titan: the haze hides them). */
  stars: number;
  /** Haze density (per meter; the terrain uses fogShape, see TitanLookTuning.fog) and color (the sky at the horizon, so distant terrain melts into it). */
  fogDensity: number;
  fogShape: number;
  fog: RGB;
  /** Opacity of the rain streaks, 0..1, and their color (linear). */
  rainStreaks: number;
  rainColor: RGB;
}

const DEG = Math.PI / 180;

/** sRGB hex string ("#rrggbb") to linear RGB. */
export function hexToLinear(hex: string): RGB {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = (b: number) => {
    const s = b / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((v >> 16) & 255), c((v >> 8) & 255), c(v & 255)];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
export const luminance = (a: RGB) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];

/** Airmass through a spherical shell atmosphere; held at its horizon value once the Sun is below it. */
export function titanAirmass(elevationDeg: number, t: TitanLookTuning): number {
  const r = t.radiusOverScaleHeight;
  const mu = Math.sin(Math.max(0, elevationDeg) * DEG);
  return Math.sqrt((r * mu) ** 2 + 2 * r + 1) - r * mu;
}

/** Direct sunlight through the haze per channel, relative to top of atmosphere (0 once the Sun has set). */
export function titanDirect(elevationDeg: number, rain: number, t: TitanLookTuning): RGB {
  const tau = t.directDepth + t.rain.directDepth * clamp01(rain);
  const m = titanAirmass(elevationDeg, t);
  const disc = smoothstep(-0.3, 0.5, elevationDeg);
  return [0, 1, 2].map((i) => t.directGain * disc * Math.exp(-tau * m * t.directReddening[i]!)) as RGB;
}

/** Diffuse sky light on level ground, relative to top-of-atmosphere sunlight at normal incidence. */
export function titanSkyLight(elevationDeg: number, rain: number, t: TitanLookTuning): number {
  const day = Math.pow(Math.max(0, Math.sin(elevationDeg * DEG)), t.diffuseSunPower);
  const twilight = t.twilightShare * Math.exp(Math.min(elevationDeg, 0) / t.twilightScaleDeg);
  return t.diffuseGain * Math.max(day, twilight) * (1 - t.rain.skyDim * clamp01(rain));
}

/** Light on level ground (direct plus sky), relative to top-of-atmosphere sunlight. */
export function titanLevelLight(elevationDeg: number, rain: number, t: TitanLookTuning): number {
  return luminance(titanDirect(elevationDeg, rain, t)) * Math.max(0, Math.sin(elevationDeg * DEG)) + titanSkyLight(elevationDeg, rain, t);
}

/** Dusk dimming factor: 1 with the Sun above dusk.dimDeg, easing down to dusk.dim at the horizon and below. */
export function titanDuskDim(elevationDeg: number, t: TitanLookTuning): number {
  return t.dusk.dim + (1 - t.dusk.dim) * smoothstep(0, t.dusk.dimDeg, elevationDeg);
}

/** Share of the terrain color the haze replaces at `depthM` (1 - exp(-(density × depth)^shape)). */
export function titanHaze(depthM: number, l: Pick<TitanLook, 'fogDensity' | 'fogShape'>): number {
  return 1 - Math.exp(-Math.pow(l.fogDensity * depthM, l.fogShape));
}

export function titanLook(sunElevationDeg: number, rainIntensity: number, t: TitanLookTuning): TitanLook {
  const el = sunElevationDeg;
  const rain = clamp01(rainIntensity);
  const c = t.colors;
  const direct = titanDirect(el, rain, t);
  const skyLight = titanSkyLight(el, rain, t);
  const skyRef = titanSkyLight(t.referenceElevationDeg, 0, t);
  const levelRef = titanLevelLight(t.referenceElevationDeg, 0, t);

  // Sky dome: hue by Sun height and rain, brightness by the sky light (adapted while the Sun is up).
  const day = smoothstep(t.duskLowDeg, t.duskHighDeg, el);
  const up = smoothstep(-2, 3, el);
  const skyAdapt = 1 + (Math.min(t.skyAdaptMax, Math.pow(skyRef / Math.max(skyLight, 1e-9), t.skyAdaptK)) - 1) * up;
  // Dusk: the eye adaptation stops hiding the lowering Sun, so the last minute before sunset visibly dims.
  const dusk = titanDuskDim(el, t);
  const brightness = Math.min(1.1, Math.pow(skyLight / skyRef, t.skyGamma) * skyAdapt * dusk * (1 - t.rain.gloom * rain));
  const night = hexToLinear(c.night);
  const tint = (dusk: string, dayC: string, rainC: string): RGB => {
    const v = scale(mix(mix(hexToLinear(dusk), hexToLinear(dayC), day), hexToLinear(rainC), rain), brightness);
    return [Math.max(v[0], night[0]), Math.max(v[1], night[1]), Math.max(v[2], night[2])];
  };
  const horizon = tint(c.duskHorizon, c.dayHorizon, c.rainHorizon);
  const zenith = tint(c.duskZenith, c.dayZenith, c.rainZenith);

  // A soft brighter patch of haze around the Sun: wide and warm at dusk, fading through twilight, gone in rain.
  const g = t.glow;
  const high = smoothstep(0, g.highDeg, el);
  const twilight = el >= 0 ? 1 : Math.exp(el / g.twilightScaleDeg);
  const glowStrength = (g.duskStrength + (g.dayStrength - g.duskStrength) * high) * twilight * (1 - rain);
  const glow = scale(mix(hexToLinear(c.duskGlow), hexToLinear(c.glow), high), glowStrength * Math.max(brightness, 0.15));

  // Light on the scene.
  const levelLight = titanLevelLight(el, rain, t);
  const exposure = t.sunIntensity * Math.min(t.adaptMax, Math.pow(levelRef / Math.max(levelLight, 1e-9), t.adaptK)) * dusk * (1 - t.rain.gloom * rain);
  const sunColor = hexToLinear(c.sun);
  const sun = [0, 1, 2].map((i) => sunColor[i]! * direct[i]! * exposure) as RGB;
  const skyMid = mix(horizon, zenith, 0.5);
  const midLum = luminance(skyMid);
  const skyHue = mix([midLum, midLum, midLum], skyMid, t.skyLightSaturation);
  const hueLum = Math.max(luminance(skyHue), 1e-6);
  const skyColor = scale(skyHue, (skyLight * exposure + t.nightLight) / hueLum);
  const groundColor = scale(hexToLinear(t.ground.color), levelLight * exposure * t.groundBounce + t.nightLight * 0.3);

  const fogClear = t.fog.clearDensity;
  return {
    sun,
    skyLight: skyColor,
    groundLight: groundColor,
    zenith,
    horizon,
    glow,
    glowWidthDeg: g.duskWidthDeg + (g.widthDeg - g.duskWidthDeg) * high,
    glowReplace: 0,
    sunDisc: t.sunDisc.opacity * smoothstep(-0.3, t.sunDisc.fullDeg, el) * (1 - rain),
    sunDiscColor: sunColor,
    stars: 0,
    fogDensity: fogClear * Math.pow(t.fog.rainDensity / fogClear, Math.pow(rain, t.fog.rainEase)),
    fogShape: t.fog.shapePower,
    fog: horizon,
    rainStreaks: t.rain.streakOpacity * rain,
    rainColor: scale(hexToLinear(t.rain.color), Math.max(0.05, Math.min(1, brightness * 1.5))),
  };
}
