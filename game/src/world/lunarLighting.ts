// Lighting patch for MeshLambertMaterial:
// - Sun visibility from the GPU sun masks (terrain shadows at any distance, see sunMask.ts).
// - Optional lunar photometry (Lommel–Seeliger): regolith stays readable under a 1.5° Sun,
//   where plain Lambert shading would make flat ground almost black.
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
}

export function createMoonLightUniforms(fine: HeightGrid, near: HeightGrid, far: HeightGrid): MoonLightUniforms {
  return {
    moonMaskFine: { value: null },
    moonMaskNear: { value: null },
    moonMaskFar: { value: null },
    moonGridExtent: { value: new THREE.Vector3(fine.extent, near.extent, far.extent) },
    moonGridSpan: { value: new THREE.Vector3(fine.pixel * fine.n, near.pixel * near.n, far.pixel * far.n) },
  };
}

/** How much of the Lommel–Seeliger term to mix with Lambert for lunar-photometry materials. */
const LUNAR_LS_WEIGHT = 0.85;
/** Brightness factor with the Sun behind the viewer (phase 0°) and when looking into it (180°). */
const PHASE_BRIGHT = 1.3;
const PHASE_DARK = 0.45;

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

/** Patch a Lambert material so the Sun is masked by terrain shadows; `lunar` adds regolith photometry. */
export function patchMoonLighting(
  material: THREE.MeshLambertMaterial,
  uniforms: MoonLightUniforms,
  lunar: boolean,
): THREE.MeshLambertMaterial {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (lunar) shader.defines = { ...shader.defines, MOON_LUNAR: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMoonWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvMoonWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
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
  material.customProgramCacheKey = () => (lunar ? 'moon-lunar' : 'moon-lambert');
  return material;
}
