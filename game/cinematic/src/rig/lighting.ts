// Cinematic materials in the game's light: MeshStandard/Physical materials that take the Sun's terrain
// shadows (the game's GPU sun masks, as patchMoonLighting gives its Lambert materials) and an adjustable
// share of indirect light (ambient fill and environment reflections), so a model can sit in a dark bay
// (little fill) or out on the sunlit regolith (full fill) under the same Sun.
import * as THREE from 'three';
import type { MoonOfflineScene } from '../../../src/world/moonScene';

/** The world's shared sun-mask uniforms (moonMaskFine/Near/Far, moonGridExtent/Span, ...). */
export type MoonUniforms = Record<string, THREE.IUniform>;

const cache = new WeakMap<MoonOfflineScene, MoonUniforms>();

/**
 * The sun-mask uniforms of a world started offline. The world does not expose them, so this patches a
 * throwaway Lambert material with `offline.patch` and runs its shader hook on an empty shader: the hook
 * copies the shared uniform objects in (the same objects every patched material reads).
 */
export function moonUniforms(offline: MoonOfflineScene): MoonUniforms {
  let u = cache.get(offline);
  if (u) return u;
  const material = new THREE.MeshLambertMaterial();
  offline.patch(new THREE.Mesh(new THREE.BufferGeometry(), material));
  const shader = { uniforms: {} as MoonUniforms, vertexShader: '', fragmentShader: '', defines: {} };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, offline.renderer);
  material.dispose();
  u = shader.uniforms;
  cache.set(offline, u);
  return u;
}

const SUN_MASK_PARS = /* glsl */ `
uniform sampler2D moonMaskFine;
uniform sampler2D moonMaskNear;
uniform sampler2D moonMaskFar;
uniform vec3 moonGridExtent;
uniform vec3 moonGridSpan;
float cineSunVisibility( vec2 p ) {
  vec2 a = abs( p );
  float m = max( a.x, a.y );
  if ( m <= moonGridExtent.x ) return texture2D( moonMaskFine, 0.5 + p / moonGridSpan.x ).r;
  if ( m <= moonGridExtent.y ) return texture2D( moonMaskNear, 0.5 + p / moonGridSpan.y ).r;
  if ( m <= moonGridExtent.z ) return texture2D( moonMaskFar, 0.5 + p / moonGridSpan.z ).r;
  return 1.0;
}
`;

export interface CinePatchOptions {
  /** The world's sun masks (moonUniforms); without them the Sun is never masked by terrain. */
  moon?: MoonUniforms;
  /** Multiplies indirect light (ambient, hemisphere, environment): 1 outdoors, ~0.05 in a dark bay. Shared between materials. */
  indirect?: THREE.IUniform<number>;
  /** Extra GLSL run at the end of the fragment shader's lighting (e.g. emissive pulses); optional. */
  key?: string;
}

/**
 * Patch a MeshStandardMaterial (or Physical) in place: Sun masked by the terrain like the game's
 * materials, and an indirect-light multiplier. Chains an existing onBeforeCompile.
 */
export function cinePatch<M extends THREE.MeshStandardMaterial>(material: M, opts: CinePatchOptions = {}): M {
  const prev = material.onBeforeCompile.bind(material);
  const indirect = opts.indirect ?? { value: 1 };
  const moon = opts.moon;
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.uniforms.cineIndirect = indirect;
    if (moon) Object.assign(shader.uniforms, moon);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCineWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 cw = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            cw = instanceMatrix * cw;
          #endif
          vCineWorld = ( modelMatrix * cw ).xyz;
        }`,
      );
    let frag = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\nvarying vec3 vCineWorld;\nuniform float cineIndirect;\n${moon ? SUN_MASK_PARS : ''}`,
    );
    const lightsBegin = THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );',
      `getDirectionalLightInfo( directionalLight, directLight );\n${moon ? 'directLight.color *= cineSunVisibility( vCineWorld.xz );' : ''}`,
    );
    frag = frag
      .replace('#include <lights_fragment_begin>', lightsBegin)
      .replace(
        '#include <lights_fragment_end>',
        `#if defined( RE_IndirectDiffuse )
          irradiance *= cineIndirect;
          iblIrradiance *= cineIndirect;
        #endif
        #if defined( RE_IndirectSpecular )
          radiance *= cineIndirect;
          clearcoatRadiance *= cineIndirect;
        #endif
        #include <lights_fragment_end>`,
      );
    shader.fragmentShader = frag;
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `cine${moon ? '-moon' : ''}${opts.key ? `-${opts.key}` : ''}|${prevKey()}`;
  material.needsUpdate = true;
  return material;
}
