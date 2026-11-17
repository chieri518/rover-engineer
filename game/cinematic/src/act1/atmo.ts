// Aerial perspective for the pad scene: every lit material fades toward the twilight sky colour in its own view
// direction (orange toward the dawn, blue-grey away from it), instead of three's single-colour fog.
import * as THREE from 'three';
import { SKY_GLSL } from './sky';

export interface FogUniforms {
  sunDir: { value: THREE.Vector3 };
  skyTime: { value: number };
  fogDensity: { value: number };
  fogHeight: { value: number };
}

export function makeFogUniforms(sunDir: THREE.Vector3): FogUniforms {
  return { sunDir: { value: sunDir }, skyTime: { value: 0 }, fogDensity: { value: 1.6e-4 }, fogHeight: { value: 220 } };
}

/** Patch a built-in material (standard/physical/basic) with twilight aerial perspective; chains an existing onBeforeCompile. */
/** `key` must differ between materials whose own shader patches differ (it is the program cache key). */
export function withSkyFog<T extends THREE.Material>(mat: T, fog: FogUniforms, key = 'plain'): T {
  const prev = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (s, r) => {
    prev(s, r);
    Object.assign(s.uniforms, fog);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 fw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fw = instanceMatrix * fw;
          #endif
          vFogW = (modelMatrix * fw).xyz;
        }`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFogW;\nuniform float fogDensity; uniform float fogHeight;\n${SKY_GLSL}`)
      .replace(
        '#include <fog_fragment>',
        `{
          vec3 dv = vFogW - cameraPosition;
          float dist = length(dv);
          vec3 dir = dv / max(dist, 1e-3);
          // Height fog: denser near the ground (exponential falloff with altitude along the ray).
          float hAvg = max(0.0, (vFogW.y + cameraPosition.y) * 0.5);
          float dens = fogDensity * exp(-hAvg / fogHeight);
          float f = 1.0 - exp(-dist * dens);
          vec3 fogCol = twilight(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.6 + 0.01, dir.z)));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogCol, f);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `skyfog-${key}`;
  return mat;
}
