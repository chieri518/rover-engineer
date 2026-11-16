// Titan methane clouds (demo visuals, presentation only): a faint, slowly drifting layer of streaky,
// cirrus-like clouds on a flat plane above the rover, drawn in the Titan sky dome (titanSky.ts), and their
// soft shadows on the dunes (a gentle darkening in the Titan ground shader, lunarLighting.ts). Both read the
// same procedural noise at the same world position and drift, so the shadows slide with the clouds overhead.
// Lit by the Sun (brighter on its side, warmer at dusk, nearly invisible at night); rain thickens and darkens
// them; the shadows show by day only and fade out in the rain. Numbers: data/titan/tuning.json `look.clouds`.
//
// API: TITAN_CLOUD_PARS (GLSL uniforms and noise, for the sky and the ground), TITAN_CLOUD_SHADOW (GLSL, in the
// ground color, multiplies diffuseColor), titanCloudUniforms (shared uniform objects: one update reaches the sky
// and every ground material), updateTitanClouds(...) once per frame, titanCloudLook(...) the pure lighting math.
import * as THREE from 'three';
import type { SkyDirection } from '../rules/sun';
import type { TitanCloudTuning, TitanLookTuning } from '../rules/titanTypes';
import { hexToLinear, type RGB, type TitanLook } from './titanLook';

/** Shared uniforms (module-wide): the sky dome and the Titan ground materials hold these same objects. */
export const titanCloudUniforms = {
  /** Drift so far (world meters along the drift direction); the pattern is read at position - tclOffset. */
  tclOffset: { value: new THREE.Vector2() },
  /** Streak direction (unit, world x/z). */
  tclWind: { value: new THREE.Vector2(1, 0) },
  /** x = feature size (m), y = stretch along the wind, z = coverage threshold, w = edge softness. */
  tclShape: { value: new THREE.Vector4(9000, 4, 0.55, 0.2) },
  /** World height of the cloud plane (m) and the camera position (the sky dome has no position of its own). */
  tclPlaneY: { value: 8000 },
  tclCam: { value: new THREE.Vector3() },
  /** Sky: opacity (0 = no clouds), lit (Sun side) and shaded colors, forward-scatter glow toward the Sun. */
  tclOpacity: { value: 0 },
  tclLit: { value: new THREE.Color() },
  tclShade: { value: new THREE.Color() },
  tclForward: { value: 0 },
  /** Ground: shadow strength (0 = none), Sun direction x/z over y (clamped), shadow edge softness. */
  tclShadow: { value: 0 },
  tclSunXZ: { value: new THREE.Vector2() },
  tclShadowSoft: { value: 0.3 },
};

/** GLSL: uniforms and the cloud field. Prefix tcl; needs nothing else from the shader. */
export const TITAN_CLOUD_PARS = /* glsl */ `
uniform vec2 tclOffset;
uniform vec2 tclWind;
uniform vec4 tclShape;
uniform float tclPlaneY;
uniform vec3 tclCam;
uniform float tclOpacity;
uniform vec3 tclLit;
uniform vec3 tclShade;
uniform float tclForward;
uniform float tclShadow;
uniform vec2 tclSunXZ;
uniform float tclShadowSoft;
float tclHash( vec2 p ) {
  vec3 p3 = fract( vec3( mod( p.xyx, 289.0 ) ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float tclNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( tclHash( i ), tclHash( i + vec2( 1.0, 0.0 ) ), u.x ),
              mix( tclHash( i + vec2( 0.0, 1.0 ) ), tclHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
// World meters to cloud space: drifted, turned into the wind frame (x along, y across), stretched along the wind.
vec2 tclFrame( vec2 pw ) {
  vec2 q = pw - tclOffset;
  q = vec2( dot( q, tclWind ), dot( q, vec2( -tclWind.y, tclWind.x ) ) );
  return vec2( q.x / tclShape.y, q.y ) / tclShape.x;
}
// Large shapes, 0..1 (the shadows read only this).
float tclBase( vec2 q ) {
  return 0.55 * tclNoise( q ) + 0.3 * tclNoise( q * 2.03 + vec2( 5.2, 1.3 ) ) + 0.15 * tclNoise( q * 4.1 + vec2( 1.7, 9.2 ) );
}
// Fine fibers along the wind (ridged, slightly warped), 0..1; fade with wDetail (1 near, 0 at the horizon).
float tclFibers( vec2 q, float wDetail ) {
  vec2 s = vec2( q.x * 2.5, q.y * 10.0 ) + vec2( 0.0, 1.5 * tclNoise( q * 4.0 + vec2( 3.1, 7.7 ) ) );
  float r = 1.0 - abs( 2.0 * tclNoise( s ) - 1.0 );
  r = 0.6 * r + 0.4 * ( 1.0 - abs( 2.0 * tclNoise( s * 2.1 + vec2( 9.4, 2.6 ) ) - 1.0 ) );
  return mix( 0.7, r * r, wDetail );
}
float tclCloud( vec2 pw, float wDetail ) {
  vec2 q = tclFrame( pw );
  float m = smoothstep( tclShape.z, tclShape.z + tclShape.w, tclBase( q ) );
  return m * tclFibers( q, wDetail );
}
float tclCloudShadow( vec2 pw ) {
  vec2 q = tclFrame( pw );
  // The cloud seen through a slight blur: the large shapes with softened edges, and most of the fibers.
  return smoothstep( tclShape.z - tclShadowSoft, tclShape.z + tclShape.w + tclShadowSoft, tclBase( q ) ) * tclFibers( q, 0.8 );
}
`;

/** GLSL for the sky dome fragment: `d` (unit view direction), `sunDir` and `c` (sky color, linear) in scope. */
export const TITAN_CLOUD_SKY = /* glsl */ `
if ( tclOpacity > 0.001 && d.y > 0.01 ) {
  vec2 pw = tclCam.xz + d.xz / max( d.y, 0.03 ) * max( tclPlaneY - tclCam.y, 100.0 );
  float lowFade = smoothstep( 0.02, 0.3, d.y ); // the layer dissolves into the haze toward the horizon
  float dens = tclCloud( pw, smoothstep( 0.05, 0.35, d.y ) ) * lowFade;
  float cs = dot( d, sunDir );
  float side = 0.5 + 0.5 * cs;
  vec3 cc = mix( tclShade, tclLit, side * side ) + tclLit * tclForward * exp( -acos( clamp( cs, -1.0, 1.0 ) ) / 0.5 );
  c = mix( c, cc, clamp( dens * tclOpacity, 0.0, 1.0 ) );
}
`;

/** GLSL for the Titan ground color: `wp` (world x/z) and `diffuseColor` in scope; vMoonWorld from the light patch. */
export const TITAN_CLOUD_SHADOW = /* glsl */ `
if ( tclShadow > 0.001 ) {
  vec2 tclP = wp + tclSunXZ * max( tclPlaneY - vMoonWorld.y, 0.0 );
  diffuseColor.rgb *= 1.0 - tclShadow * tclCloudShadow( tclP );
}
`;

export interface TitanCloudLook {
  opacity: number;
  coverage: number;
  lit: RGB;
  shade: RGB;
  forward: number;
  shadow: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, b: RGB, k = 1): RGB => [a[0] * b[0] * k, a[1] * b[1] * k, a[2] * b[2] * k];

/** Cloud colors, opacity and shadow strength for a Sun elevation and rain intensity (pure; colors follow the sky look). */
export function titanCloudLook(elevationDeg: number, rainIntensity: number, look: Pick<TitanLook, 'horizon' | 'zenith'>, t: TitanLookTuning, c: TitanCloudTuning): TitanCloudLook {
  const rain = clamp01(rainIntensity);
  const day = smoothstep(t.duskLowDeg, t.duskHighDeg, elevationDeg);
  const tint = mix(hexToLinear(c.duskTint), hexToLinear(c.dayTint), day);
  const dryLit = mul(look.horizon, tint, c.litGain);
  const dryShade = mul(look.zenith, tint, c.shadeGain);
  const wet: RGB = [c.rain.darken, c.rain.darken, c.rain.darken];
  const lit = mix(dryLit, mul(look.horizon, wet), rain);
  const shade = mix(dryShade, mul(look.zenith, wet, 0.8), rain);
  const visible = c.nightOpacity + (1 - c.nightOpacity) * smoothstep(c.nightDeg, 0, elevationDeg);
  return {
    opacity: clamp01(c.opacity * (1 + c.rain.opacityGain * rain) * visible),
    coverage: c.coverage - c.rain.coverageDrop * rain,
    lit,
    shade,
    forward: c.forwardGlow * smoothstep(-2, 2, elevationDeg) * (1 - rain),
    shadow: c.shadow.strength * smoothstep(c.shadow.lowDeg, c.shadow.highDeg, elevationDeg) * (1 - rain),
  };
}

let driftM = 0;
/** Development only (window.__titanClouds): scale the sky opacity and ground shadows for before/after screenshots. */
const dev = { opacity: 1, shadow: 1 };
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __titanClouds?: unknown }).__titanClouds = dev;

/** Once per frame on Titan: advance the drift and set the shared uniforms. dt 0 while paused. */
export function updateTitanClouds(dt: number, sun: SkyDirection, rain: number, look: TitanLook, camera: THREE.Camera, t: TitanLookTuning): void {
  const c = t.clouds;
  const u = titanCloudUniforms;
  if (!c) {
    u.tclOpacity.value = 0;
    u.tclShadow.value = 0;
    return;
  }
  driftM = (driftM + dt * c.driftMps) % 1e7;
  const w = (c.windDeg * Math.PI) / 180;
  const dr = (c.driftDeg * Math.PI) / 180;
  u.tclWind.value.set(Math.cos(w), Math.sin(w));
  u.tclOffset.value.set(Math.cos(dr) * driftM, Math.sin(dr) * driftM);
  const l = titanCloudLook(sun.elevationDeg, rain, look, t, c);
  u.tclShape.value.set(c.scaleM, c.stretch, l.coverage, c.softness);
  u.tclCam.value.copy(camera.position);
  u.tclPlaneY.value = camera.position.y + c.heightM;
  u.tclOpacity.value = l.opacity * dev.opacity;
  u.tclLit.value.setRGB(...l.lit);
  u.tclShade.value.setRGB(...l.shade);
  u.tclForward.value = l.forward;
  u.tclShadow.value = l.shadow * dev.shadow;
  u.tclShadowSoft.value = c.shadow.softness;
  const sy = Math.max(sun.y, Math.sin((c.shadow.lowDeg * Math.PI) / 180), 0.05);
  u.tclSunXZ.value.set(sun.x / sy, sun.z / sy);
}
