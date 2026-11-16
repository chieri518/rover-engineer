// titan-fx: ground. Wind ripples on Titan's loose dune sand, drawn in the ground shader (lunarLighting.ts).
// Two ripple sets (fine and coarse) tilt the ground's fine-bump gradient (moonBump, applied by GROUND_NORMAL)
// and shade the color a little, since Titan's nearly all-diffuse light hides small relief. Crests lie across
// the wind (the wind blows along the west-east dunes), wander with noise and break into patches. They appear
// only where the graded soft-ground mask says loose sand, and fade per wavelength once a pixel is too coarse,
// then with camera distance. Numbers in data/titan/tuning.json `look.ripples`; titanGround.ts sets the uniforms.
import * as THREE from 'three';
import type { GridMask } from '../rules/titan';
import type { TitanRippleTuning } from '../rules/titanTypes';

/** Shared uniforms, merged into every Titan-patched material (lunarLighting.ts, `if (lunar === 'titan')`). */
export const titanRippleUniforms = {
  titanSoftMask: { value: null as THREE.Texture | null },
  /** Soft mask placement: x, z of its outer corner, span (m), and w = 1 when ripples are on. */
  titanSoftRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  /** x = fine wavelength, y = fine height, z = coarse wavelength, w = coarse height (m). */
  titanRippleWave: { value: new THREE.Vector4(0.3, 0, 1, 0) },
  /** x = fine shade, y = coarse shade, z..w = camera distance fade (m). */
  titanRippleShade: { value: new THREE.Vector4(0, 0, 60, 140) },
  /** xy = wind direction in world x, z; z..w = softness fade-in range. */
  titanRippleDir: { value: new THREE.Vector4(1, 0, 0.15, 0.5) },
  /** x = warp noise scale, y = warp (m), z = patch noise scale, w = patch amount. */
  titanRippleWarp: { value: new THREE.Vector4(3.5, 0.5, 6, 0.8) },
};

/** Declarations, at the end of TITAN_PARS (before GROUND_PARS, so no moonNoise here). */
export const TITAN_RIPPLE_PARS = /* glsl */ `
uniform sampler2D titanSoftMask;
uniform vec4 titanSoftRect;
uniform vec4 titanRippleWave;
uniform vec4 titanRippleShade;
uniform vec4 titanRippleDir;
uniform vec4 titanRippleWarp;
`;

/** Ground color chunk: first at the end of GROUND_COLOR's MOON_TITAN block (wp, pixelM, moonBump in scope). */
export const TITAN_RIPPLE_COLOR = /* glsl */ `
if ( titanSoftRect.w > 0.0 ) {
  float rSoft = texture2D( titanSoftMask, ( wp - titanSoftRect.xy ) / titanSoftRect.z ).r;
  float rK = smoothstep( titanRippleDir.z, titanRippleDir.w, rSoft )
    * ( 1.0 - smoothstep( titanRippleShade.z, titanRippleShade.w, length( vViewPosition ) ) );
  if ( rK > 0.0 ) {
    vec2 rDir = titanRippleDir.xy;
    vec3 rWarp = moonNoise( wp / titanRippleWarp.x );
    vec3 rPatch = moonNoise( wp / titanRippleWarp.z + 17.3 );
    rK *= clamp( 1.0 + titanRippleWarp.w * 1.4 * rPatch.x, 0.0, 1.6 );
    // Along-wind coordinate with wandering crests, and its gradient in world x, z.
    float rS = dot( wp, rDir ) + titanRippleWarp.y * rWarp.x;
    vec2 rGrad = rDir + titanRippleWarp.y * rWarp.yz / titanRippleWarp.x;
    float rShade = 0.0;
    for ( int i = 0; i < 2; i++ ) {
      float lambda = i == 0 ? titanRippleWave.x : titanRippleWave.z;
      float height = i == 0 ? titanRippleWave.y : titanRippleWave.w;
      float shade = i == 0 ? titanRippleShade.x : titanRippleShade.y;
      float wgt = moonOctaveWeight( lambda, pixelM ) * rK;
      if ( wgt > 0.0 ) {
        float ph = 6.2831853 * rS / lambda + float( i ) * 1.7;
        // Asymmetric profile: gentle windward slope, steeper lee (fundamental plus a second harmonic).
        float h = sin( ph ) + 0.3 * sin( 2.0 * ph );
        float dh = cos( ph ) + 0.6 * cos( 2.0 * ph );
        moonBump.yz += wgt * 0.5 * height * dh * ( 6.2831853 / lambda ) * rGrad;
        rShade += wgt * shade * h * 0.75;
      }
    }
    diffuseColor.rgb *= 1.0 + rShade;
  }
}
`;

/** Turn the ripples on: upload the soft-ground mask and the tuning. */
export function enableTitanRipples(mask: GridMask, t: TitanRippleTuning): void {
  const u = titanRippleUniforms;
  const data = mask.data instanceof Uint8Array ? mask.data : Uint8Array.from(mask.data);
  const tex = new THREE.DataTexture(data, mask.n, mask.n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.unpackAlignment = 1;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  u.titanSoftMask.value?.dispose();
  u.titanSoftMask.value = tex;
  // Vertex-centered grid: sample (col, row) sits at x = (col - half) × pixel, so texel centers line up.
  const half = (mask.n - 1) / 2;
  u.titanSoftRect.value.set(-(half + 0.5) * mask.pixelM, -(half + 0.5) * mask.pixelM, mask.n * mask.pixelM, 1);
  u.titanRippleWave.value.set(t.fineWavelengthM, t.fineHeightM, t.coarseWavelengthM, t.coarseHeightM);
  u.titanRippleShade.value.set(t.fineShade, t.coarseShade, t.fadeStartM, t.fadeEndM);
  const a = (t.windAzimuthDeg * Math.PI) / 180;
  // Azimuth clockwise from north; north is -z, east is +x.
  u.titanRippleDir.value.set(Math.sin(a), -Math.cos(a), t.softLow, t.softHigh);
  u.titanRippleWarp.value.set(t.warpScaleM, t.warpM, t.breakScaleM, t.breakAmount);
}

export function disableTitanRipples(): void {
  const u = titanRippleUniforms;
  u.titanSoftMask.value?.dispose();
  u.titanSoftMask.value = null;
  u.titanSoftRect.value.w = 0;
}
