// Mars sky and light through a sol, from two inputs: the Sun's elevation and the dust-storm intensity.
// Pure math (no three, no DOM) so it can be unit tested; the scene (moonScene.ts, marsSky.ts) applies it.
//
// The model is a small single-layer dust atmosphere. Direct sunlight falls off with airmass through the
// dust (redder near the horizon, because dust absorbs blue); sky light grows as direct light is scattered
// out; a blue glow sits around the Sun, because Mars dust scatters blue light forward (why Martian
// sunsets look blue); twilight fades over a few degrees below the horizon. These are presentation
// values (rendering constants), not game rules: the storm's effect on solar power lives in rules/.

export type RGB = [number, number, number];

export interface MarsLook {
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
  /** Share of the sky color the glow replaces at the Sun (0..1): a low Sun's blue halo hides the butterscotch. */
  glowReplace: number;
  /** Opacity of the Sun's disc, 0..1. */
  sunDisc: number;
  /** Star brightness, 0..1. */
  stars: number;
  /** THREE.FogExp2 density (per meter) and color (the sky at the horizon, so distant terrain melts into it). */
  fogDensity: number;
  fog: RGB;
}

const DEG = Math.PI / 180;

/** Top-of-atmosphere sunlight in scene intensity units (tuned against the Moon's look with screenshots). */
export const MARS_SUN_I0 = 6;
const TAU_CLEAR = 0.6; // dust optical depth on a clear day in early northern autumn
const TAU_STORM = 3.5; // regional storm: total light falls to about a third, direct light far more
/** Light scattered only slightly forward stays near the beam: the effective depth for shadow-casting light. */
const DIRECT_TAU_SHARE = 0.6;
const DUST_REDDENING: RGB = [0.85, 1.0, 1.3]; // relative depth per channel for the direct beam
const R_OVER_H = 3390 / 11; // Mars radius over the atmosphere's scale height, for the airmass
const DIFFUSE_GAIN = 0.8;
const DIFFUSE_ABSORB = 0.3; // thick dust absorbs part of the light it scatters
const DIFFUSE_MAX_AIRMASS = 3;
const TWILIGHT_SHARE = 0.05; // sky light at sunset, relative to a Sun overhead
const TWILIGHT_SCALE_DEG = 2.5; // sky light falls by e every this many degrees below the horizon
const SKY_GAMMA = 0.55; // displayed sky brightness ~ (sky light)^gamma: twilight stays readable
const NIGHT_LIGHT = 0.25; // ambient floor at night: dark enough that the floodlights matter
const GROUND_BOUNCE = 0.12; // light reflected up by the ground (albedo × a geometry share)
// Eye adaptation: a dim morning or storm is brightened toward noon (light × (noon / now)^k, at most
// ADAPT_MAX, twice that in a full storm), as a camera's exposure would, so low-Sun and storm play stay
// readable; the night floor is not.
const ADAPT_K = 0.55;
const ADAPT_MAX = 6;
// The sky dome adapts too, but only while the Sun is up: dawn and dusk skies stay readable instead of
// going grey-brown, and twilight still darkens toward night.
const SKY_ADAPT_K = 0.35;
const SKY_ADAPT_MAX = 2.2;

const SUN_COLOR = srgb(0xfff6ea);
const DAY_HORIZON = srgb(0xcfa57a); // butterscotch
const DAY_ZENITH = srgb(0x9c6e4e); // darker, redder overhead
const DUSK_HORIZON = srgb(0x9a7a64); // muted brown away from a low Sun
const DUSK_ZENITH = srgb(0x4a3e44);
const STORM_HORIZON = srgb(0xb4875a); // flat ochre haze: sky and horizon merge
const STORM_ZENITH = srgb(0xa98058);
const STORM_GLOW = srgb(0xe6c8a0); // the Sun as a dim, wide, dusty smudge
const NIGHT_SKY = srgb(0x05060a);
const GLOW_DAY = srgb(0xcfd6e2); // pale blue-white aureole around a high Sun
const GLOW_SUNSET = srgb(0x80a2dc); // the blue sunset
const GLOW_DAY_STRENGTH = 0.12;
const GLOW_SUNSET_STRENGTH = 0.5;
const GLOW_SUNSET_REPLACE = 0.75; // around a low Sun the blue halo replaces most of the butterscotch
// The blue glow stays strong up to about 15° (the Blue sunset photo band) and fades to the day aureole by 30°.
const GLOW_LOW_DEG = 13;
const GLOW_HIGH_DEG = 30;
const STORM_GLOW_STRENGTH = 0.18;
const STORM_GLOW_WIDTH_DEG = 22;
const GLOW_TWILIGHT_SCALE_DEG = 3.5;
/** Mean Mars ground color (sRGB hex): the ground material's color, tinting the grayscale HiRISE image. */
export const MARS_GROUND_HEX = 0x9c7c62;
const GROUND_TINT = srgb(MARS_GROUND_HEX);
const FOG_CLEAR = 2.5e-5; // crater rim ~20 km away is hazy but visible
// Peak storm: terrain is half hidden at ~190 m and gone by ~350 m (exp² fog), as in the 2018 storm images.
const FOG_STORM = 5e-3;
const FOG_STORM_EASE = 0.35; // fog follows storm^0.35 on a log scale: the haze closes in early in the build-up
const STORM_GLOOM = 0.5; // the eye adapts less than fully to a storm: the day stays dim
const SKY_LIGHT_SATURATION = 0.6; // sky light on the ground is whiter than the sky looks

function srgb(hex: number): RGB {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const luminance = (a: RGB) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];

/** Airmass through a spherical shell atmosphere; held at its horizon value once the Sun is below it. */
export function marsAirmass(elevationDeg: number): number {
  const mu = Math.sin(Math.max(0, elevationDeg) * DEG);
  return Math.sqrt((R_OVER_H * mu) ** 2 + 2 * R_OVER_H + 1) - R_OVER_H * mu;
}

/** Diffuse sky light on level ground, relative to top-of-atmosphere sunlight at normal incidence. */
export function marsSkyLight(elevationDeg: number, storm: number): number {
  const tau = TAU_CLEAR + (TAU_STORM - TAU_CLEAR) * clamp01(storm);
  const tm = tau * Math.min(marsAirmass(elevationDeg), DIFFUSE_MAX_AIRMASS);
  const muEff = Math.max(Math.sin(elevationDeg * DEG), TWILIGHT_SHARE * Math.exp(Math.min(elevationDeg, 0) / TWILIGHT_SCALE_DEG));
  return DIFFUSE_GAIN * muEff * (1 - Math.exp(-tm)) * Math.exp(-DIFFUSE_ABSORB * tm);
}

/** Direct sunlight through the dust per channel, relative to top of atmosphere (0 once the Sun has set). */
export function marsDirect(elevationDeg: number, storm: number): RGB {
  const tau = TAU_CLEAR + (TAU_STORM - TAU_CLEAR) * clamp01(storm);
  const tm = tau * DIRECT_TAU_SHARE * marsAirmass(elevationDeg);
  const disc = smoothstep(-0.3, 0.5, elevationDeg);
  return [0, 1, 2].map((i) => disc * Math.exp(-tm * DUST_REDDENING[i]!)) as RGB;
}

const SKY_REF = marsSkyLight(60, 0);

/** Light on level ground (direct plus sky), relative to top-of-atmosphere sunlight. */
export function marsLevelLight(elevationDeg: number, storm: number): number {
  return luminance(marsDirect(elevationDeg, storm)) * Math.max(0, Math.sin(elevationDeg * DEG)) + marsSkyLight(elevationDeg, storm);
}
const LEVEL_REF = marsLevelLight(60, 0);

export function marsLook(sunElevationDeg: number, stormIntensity: number): MarsLook {
  const el = sunElevationDeg;
  const storm = clamp01(stormIntensity);
  const direct = marsDirect(el, storm);
  const skyLight = marsSkyLight(el, storm);

  // Sky dome: hue by Sun height and storm, brightness by the sky light.
  const day = smoothstep(-4, 14, el);
  const up = smoothstep(-2, 3, el); // the sky's adaptation fades out through twilight
  const skyAdapt = 1 + (Math.min(SKY_ADAPT_MAX, Math.pow(SKY_REF / Math.max(skyLight, 1e-9), SKY_ADAPT_K)) - 1) * up * (1 - 0.5 * storm);
  const brightness = Math.min(1.15, Math.pow(skyLight / SKY_REF, SKY_GAMMA) * Math.max(1, skyAdapt));
  const tint = (dusk: RGB, dayC: RGB, stormC: RGB): RGB => {
    const c = scale(mix(mix(dusk, dayC, day), stormC, storm), brightness);
    return [Math.max(c[0], NIGHT_SKY[0]), Math.max(c[1], NIGHT_SKY[1]), Math.max(c[2], NIGHT_SKY[2])];
  };
  const horizon = tint(DUSK_HORIZON, DAY_HORIZON, STORM_HORIZON);
  const zenith = tint(DUSK_ZENITH, DAY_ZENITH, STORM_ZENITH);

  const high = smoothstep(GLOW_LOW_DEG, GLOW_HIGH_DEG, el);
  const twilight = el >= 0 ? 1 : Math.exp(el / GLOW_TWILIGHT_SCALE_DEG);
  const glowStrength = (GLOW_SUNSET_STRENGTH + (GLOW_DAY_STRENGTH - GLOW_SUNSET_STRENGTH) * high) * twilight;
  // In a storm the blue halo gives way to a wide, dim, dusty smudge around the Sun.
  const stormGlow = scale(STORM_GLOW, STORM_GLOW_STRENGTH * brightness);
  const glow = mix(scale(mix(GLOW_SUNSET, GLOW_DAY, high), glowStrength), stormGlow, storm);

  // Light on the scene.
  const levelLight = marsLevelLight(el, storm);
  const exposure =
    MARS_SUN_I0 * Math.min(ADAPT_MAX * (1 + storm), Math.pow(LEVEL_REF / Math.max(levelLight, 1e-9), ADAPT_K)) * (1 - STORM_GLOOM * storm);
  const sun = [0, 1, 2].map((i) => SUN_COLOR[i]! * direct[i]! * exposure) as RGB;
  const skyMid = mix(horizon, zenith, 0.5);
  const midLum = luminance(skyMid);
  const skyHue = mix([midLum, midLum, midLum], skyMid, SKY_LIGHT_SATURATION);
  const hueLum = Math.max(luminance(skyHue), 1e-6);
  const skyColor = scale(skyHue, (skyLight * exposure + NIGHT_LIGHT) / hueLum);
  const groundColor = scale(GROUND_TINT, levelLight * exposure * GROUND_BOUNCE + NIGHT_LIGHT * 0.3);

  return {
    sun,
    skyLight: skyColor,
    groundLight: groundColor,
    zenith,
    horizon,
    glow,
    glowWidthDeg: 7 + 5 * high + (STORM_GLOW_WIDTH_DEG - 7 - 5 * high) * storm,
    glowReplace: GLOW_SUNSET_REPLACE * (1 - high) * twilight * (1 - storm),
    sunDisc: smoothstep(-0.3, 0.3, el) * (1 - 0.85 * storm),
    stars: (1 - smoothstep(0.01, 0.06, brightness)) * (1 - storm),
    fogDensity: FOG_CLEAR * Math.pow(FOG_STORM / FOG_CLEAR, Math.pow(storm, FOG_STORM_EASE)),
    fog: horizon,
  };
}
