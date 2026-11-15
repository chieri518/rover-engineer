// Lighting patch for MeshLambertMaterial:
// - Sun visibility from the GPU sun masks (terrain shadows at any distance, see sunMask.ts).
// - Optional lunar photometry (Lommel–Seeliger): regolith stays readable under a 1.5° Sun,
//   where plain Lambert shading would make flat ground almost black.
// - Optional ground detail for the terrain: the LROC albedo map over the play area, plus fine
//   procedural regolith (albedo speckle and small bumps) that fades out with distance so it never
//   shimmers. See public/terrain/texture.json for the albedo map's grid and values.
// - Mars ('mars' photometry): near-Lambert with a mild backscatter, and the grayscale HiRISE image
//   used as relative brightness (contrast-limited) on the Mars ground color, darker areas greyer.
// - Titan ('titan' photometry): plain Lambert (the light is nearly all diffuse), the grayscale albedo map
//   as relative brightness on the Titan ground color, the dark dune sand tinted (moonDarkTint/moonDarkTone).
import * as THREE from 'three';
import type { HeightGrid } from './terrainData';

/** Shared uniforms: every patched material reads the same objects, so one update reaches all. */
export interface MoonLightUniforms {
  [name: string]: THREE.IUniform;
  moonMaskFine: THREE.IUniform<THREE.Texture | null>;
  moonMaskNear: THREE.IUniform<THREE.Texture | null>;
  moonMaskFar: THREE.IUniform<THREE.Texture | null>;
  moonGridExtent: THREE.IUniform<THREE.Vector3>;
  moonGridSpan: THREE.IUniform<THREE.Vector3>; // pixel × samples per grid
  moonAlbedo: THREE.IUniform<THREE.Texture | null>;
  /** Albedo map placement: x, z of its outer corner (min), span in meters, fade width at its edge. */
  moonAlbedoRect: THREE.IUniform<THREE.Vector4>;
  /** Albedo map tone: x = its mean linear value (maps to the material color), y = contrast (1 = as is). */
  moonAlbedoTone: THREE.IUniform<THREE.Vector2>;
  /** Titan: color multiplier for dark ground (dune sand), and the tone range over which it fades out (x..y). */
  moonDarkTint: THREE.IUniform<THREE.Color>;
  moonDarkTone: THREE.IUniform<THREE.Vector2>;
}

/** How a patched material scatters sunlight: lunar regolith, Mars ground, Titan ground, or plain Lambert (false). */
export type Photometry = boolean | 'mars' | 'titan';

export function createMoonLightUniforms(fine: HeightGrid, near: HeightGrid, far: HeightGrid): MoonLightUniforms {
  return {
    moonMaskFine: { value: null },
    moonMaskNear: { value: null },
    moonMaskFar: { value: null },
    moonGridExtent: { value: new THREE.Vector3(fine.extent, near.extent, far.extent) },
    moonGridSpan: { value: new THREE.Vector3(fine.pixel * fine.n, near.pixel * near.n, far.pixel * far.n) },
    moonAlbedo: { value: null },
    moonAlbedoRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    moonAlbedoTone: { value: new THREE.Vector2(ALBEDO_MEAN, 1) },
    moonDarkTint: { value: new THREE.Color(1, 1, 1) },
    moonDarkTone: { value: new THREE.Vector2(0, 1) },
  };
}

/** Mean linear albedo of the LROC map (texture.json "values"): dividing by it keeps the average tone. */
export const ALBEDO_MEAN = 0.22;

/** How much of the Lommel–Seeliger term to mix with Lambert for lunar-photometry materials. */
const LUNAR_LS_WEIGHT = 0.85;
/** Brightness factor with the Sun behind the viewer (phase 0°) and when looking into it (180°). */
const PHASE_BRIGHT = 1.3;
const PHASE_DARK = 0.45;
/** Mars: dustier, more Lambertian ground with a weak backscatter. */
const MARS_PHASE_BRIGHT = 1.12;
const MARS_PHASE_DARK = 0.88;

const PARS = /* glsl */ `
uniform sampler2D moonMaskFine;
uniform sampler2D moonMaskNear;
uniform sampler2D moonMaskFar;
uniform vec3 moonGridExtent;
uniform vec3 moonGridSpan;
varying vec3 vMoonWorld;
float moonSunVis = 1.0;

float moonSunVisibility( vec2 p ) {
  vec2 a = abs( p );
  float m = max( a.x, a.y );
  if ( m <= moonGridExtent.x ) return texture2D( moonMaskFine, 0.5 + p / moonGridSpan.x ).r;
  if ( m <= moonGridExtent.y ) return texture2D( moonMaskNear, 0.5 + p / moonGridSpan.y ).r;
  if ( m <= moonGridExtent.z ) return texture2D( moonMaskFar, 0.5 + p / moonGridSpan.z ).r;
  return 1.0;
}
`;

const GROUND_PARS = /* glsl */ `
uniform sampler2D moonAlbedo;
uniform vec4 moonAlbedoRect;
uniform vec2 moonAlbedoTone;
uniform vec3 moonDarkTint;
uniform vec2 moonDarkTone;

// Gradient noise with its analytic derivative (returns value, d/dx, d/dy), range about -0.7..0.7.
// Lattice cells wrap every 289 so the hash stays exact in 32-bit floats far from the origin.
vec2 moonHash2( vec2 i ) {
  vec3 p3 = fract( vec3( mod( i.xyx, 289.0 ) ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.xx + p3.yz ) * p3.zy ) * 2.0 - 1.0;
}
vec3 moonNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  vec2 du = 30.0 * f * f * ( f * ( f - 2.0 ) + 1.0 );
  vec2 ga = moonHash2( i );
  vec2 gb = moonHash2( i + vec2( 1.0, 0.0 ) );
  vec2 gc = moonHash2( i + vec2( 0.0, 1.0 ) );
  vec2 gd = moonHash2( i + vec2( 1.0, 1.0 ) );
  float va = dot( ga, f );
  float vb = dot( gb, f - vec2( 1.0, 0.0 ) );
  float vc = dot( gc, f - vec2( 0.0, 1.0 ) );
  float vd = dot( gd, f - vec2( 1.0, 1.0 ) );
  float k = va - vb - vc + vd;
  return vec3( va + u.x * ( vb - va ) + u.y * ( vc - va ) + u.x * u.y * k,
               ga + u.x * ( gb - ga ) + u.y * ( gc - ga ) + u.x * u.y * ( ga - gb - gc + gd )
               + du * ( u.yx * k + vec2( vb, vc ) - va ) );
}
// Fade an octave of this wavelength (m) out once a pixel covers more than a quarter of it.
float moonOctaveWeight( float wavelength, float pixelM ) {
  return 1.0 - smoothstep( 0.15, 0.45, pixelM / wavelength );
}
`;

// Wavelength (m), height amplitude (m) and albedo amplitude of each regolith octave. Under a Sun
// 1.5° high, brightness scales with the slope toward the Sun divided by sin(1.5°), so even a 0.5°
// tilt is a strong change: the bumps stay tiny and fine-grained, and the larger octaves only vary albedo.
const OCTAVES: [number, number, number][] = [
  [7.0, 0, 0.05],
  [2.3, 0.0015, 0.05],
  [0.8, 0.003, 0.07],
  [0.27, 0.0018, 0.10],
  [0.09, 0.0006, 0.08],
];

const NOISE_GAIN = 1.4; // gradient noise spans about ±0.7: scale it to the amplitudes above
// Crisp specks on the finest octaves: bright pebbles and dark pits, so the ground stays sharp up close.
const PEBBLE_BRIGHT = 0.22;
const PEBBLE_DARK = 0.2;

const GROUND_COLOR = /* glsl */ `
vec3 moonBump = vec3( 0.0 ); // height (unused), d/dx, d/dz in world meters
{
  vec2 wp = vMoonWorld.xz;
  // LROC albedo, relative to its mean, blended to plain at the edge of the play area.
  vec2 auv = ( wp - moonAlbedoRect.xy ) / moonAlbedoRect.z;
  float edge = min( min( auv.x, 1.0 - auv.x ), min( auv.y, 1.0 - auv.y ) ) * moonAlbedoRect.z;
  float inside = smoothstep( 0.0, moonAlbedoRect.w, edge );
  float albedo = 1.0 + ( texture2D( moonAlbedo, clamp( auv, 0.0, 1.0 ) ).r / moonAlbedoTone.x - 1.0 ) * moonAlbedoTone.y;
  float tone = mix( 1.0, albedo, inside );
  // Fine regolith: speckle and bumps far below the 5 m map resolution.
  float pixelM = max( length( fwidth( wp ) ), 1e-4 );
  float speckle = 0.0;
${OCTAVES.map(([w, h, a], i) => `  {
    float wgt = moonOctaveWeight( ${w.toFixed(2)}, pixelM );
    if ( wgt > 0.0 ) {
      mat2 r = mat2( ${Math.cos(i * 1.1).toFixed(4)}, ${Math.sin(i * 1.1).toFixed(4)}, ${(-Math.sin(i * 1.1)).toFixed(4)}, ${Math.cos(i * 1.1).toFixed(4)} );
      vec3 n = moonNoise( r * wp * ${(1 / w).toFixed(5)} );
      speckle += ${(a * NOISE_GAIN).toFixed(3)} * wgt * n.x;
      ${w < 0.5 ? `speckle += wgt * ( ${PEBBLE_BRIGHT.toFixed(2)} * smoothstep( 0.36, 0.46, n.x ) - ${PEBBLE_DARK.toFixed(2)} * smoothstep( 0.36, 0.46, -n.x ) );` : ''}
      ${h > 0 ? `moonBump.yz += ${((h / w) * NOISE_GAIN).toFixed(5)} * wgt * ( n.yz * r );` : ''}
    }
  }`).join('\n')}
  diffuseColor.rgb *= tone * ( 1.0 + speckle );
  #ifdef MOON_MARS
    // Dark basaltic sand is greyer than the bright red dust.
    diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), diffuseColor.rgb, 0.55 + 0.45 * smoothstep( 0.5, 1.1, tone ) );
  #endif
  #ifdef MOON_TITAN
    // Dark dune sand takes its own tint; the bright interdune ground keeps the ground color.
    diffuseColor.rgb *= mix( moonDarkTint, vec3( 1.0 ), smoothstep( moonDarkTone.x, moonDarkTone.y, tone ) );
  #endif
}
`;

// Tilt the (view-space) normal by the bump gradient, measured in world x and z.
const GROUND_NORMAL = /* glsl */ `
{
  vec3 nw = inverseTransformDirection( normal, viewMatrix );
  vec3 g = vec3( moonBump.y, 0.0, moonBump.z );
  nw = normalize( nw - ( g - nw * dot( g, nw ) ) );
  normal = normalize( ( viewMatrix * vec4( nw, 0.0 ) ).xyz );
}
`;

const LAMBERT_PARS = /* glsl */ `
varying vec3 vViewPosition;

struct LambertMaterial {
  vec3 diffuseColor;
  float specularStrength;
};

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float mu0 = saturate( dot( geometryNormal, directLight.direction ) );
  #ifdef MOON_LUNAR
    float mu = saturate( dot( geometryNormal, geometryViewDir ) );
    float f = mix( mu0, 2.0 * mu0 / ( mu0 + mu + 1e-4 ), ${LUNAR_LS_WEIGHT.toFixed(3)} );
    // Regolith scatters light back toward the Sun: darker when looking into the Sun.
    float phase = acos( clamp( dot( directLight.direction, geometryViewDir ), -1.0, 1.0 ) );
    f *= ${PHASE_BRIGHT.toFixed(3)} - ${(PHASE_BRIGHT - PHASE_DARK).toFixed(3)} * phase / PI;
  #elif defined( MOON_MARS )
    float phase = acos( clamp( dot( directLight.direction, geometryViewDir ), -1.0, 1.0 ) );
    float f = mu0 * ( ${MARS_PHASE_BRIGHT.toFixed(3)} - ${(MARS_PHASE_BRIGHT - MARS_PHASE_DARK).toFixed(3)} * phase / PI );
  #else
    float f = mu0;
  #endif
  vec3 irradiance = f * moonSunVis * directLight.color;
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;

/**
 * Patch a Lambert material so the Sun is masked by terrain shadows; `lunar` adds regolith photometry
 * (true) or Mars ground photometry ('mars'), `ground` the albedo map and fine detail (terrain only).
 */
export function patchMoonLighting(
  material: THREE.MeshLambertMaterial,
  uniforms: MoonLightUniforms,
  lunar: Photometry,
  ground = false,
): THREE.MeshLambertMaterial {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (lunar === 'mars') shader.defines = { ...shader.defines, MOON_MARS: '' };
    else if (lunar === 'titan') shader.defines = { ...shader.defines, MOON_TITAN: '' };
    else if (lunar) shader.defines = { ...shader.defines, MOON_LUNAR: '' };
    let fragment = shader.fragmentShader;
    if (ground) {
      fragment = fragment
        .replace('#include <common>', `#include <common>\n${GROUND_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${GROUND_COLOR}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GROUND_NORMAL}`);
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMoonWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvMoonWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
      );
    shader.fragmentShader = fragment
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <lights_lambert_pars_fragment>', LAMBERT_PARS)
      // Terrain shadows mask only the Sun (the directional light), not the rover's floodlights.
      .replace(
        '#include <lights_fragment_begin>',
        THREE.ShaderChunk.lights_fragment_begin.replace(
          '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )',
          'moonSunVis = moonSunVisibility( vMoonWorld.xz );\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )',
        ),
      );
  };
  const mode = lunar === 'mars' || lunar === 'titan' ? lunar : lunar ? 'lunar' : 'lambert';
  material.customProgramCacheKey = () => (ground ? `moon-ground-${mode}` : `moon-${mode}`);
  return material;
}
