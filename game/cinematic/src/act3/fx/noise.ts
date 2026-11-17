// A tileable 3D noise texture (smooth value noise, 64³, one byte) for the volumetric effects: sampled with hardware
// trilinear filtering it is far cheaper than procedural noise per ray-march sample. Deterministic (fixed seed).
import * as THREE from 'three';
import { seeded } from '../../clock';

const SIZE = 64;
const CELLS = 16; // lattice cells per tile side

let shared: THREE.Data3DTexture | null = null;

export function noiseTexture(): THREE.Data3DTexture {
  if (shared) return shared;
  const rnd = seeded(0xa37);
  const lattice = new Float32Array(CELLS * CELLS * CELLS);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
  const L = (x: number, y: number, z: number) => lattice[((z & (CELLS - 1)) * CELLS + (y & (CELLS - 1))) * CELLS + (x & (CELLS - 1))]!;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const data = new Uint8Array(SIZE * SIZE * SIZE);
  const k = CELLS / SIZE;
  for (let z = 0; z < SIZE; z++) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const fx = x * k, fy = y * k, fz = z * k;
        const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
        const u = fade(fx - ix), v = fade(fy - iy), w = fade(fz - iz);
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const val = lerp(
          lerp(lerp(L(ix, iy, iz), L(ix + 1, iy, iz), u), lerp(L(ix, iy + 1, iz), L(ix + 1, iy + 1, iz), u), v),
          lerp(lerp(L(ix, iy, iz + 1), L(ix + 1, iy, iz + 1), u), lerp(L(ix, iy + 1, iz + 1), L(ix + 1, iy + 1, iz + 1), u), v),
          w,
        );
        data[(z * SIZE + y) * SIZE + x] = Math.round(val * 255);
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, SIZE, SIZE, SIZE);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}

/** GLSL: `float noise3( vec3 p )` (one lattice cell per unit, 0..1) and `float fbm3( vec3 p )` (4 octaves, ~0..1). */
export const NOISE_GLSL = /* glsl */ `
uniform highp sampler3D tNoise;
float noise3( vec3 p ) { return texture( tNoise, p * ${(1 / CELLS).toFixed(6)} ).r; }
float fbm3( vec3 p ) {
  float s = 0.5 * noise3( p );
  s += 0.25 * noise3( p * 2.03 + vec3( 17.1, 3.7, 9.2 ) );
  s += 0.125 * noise3( p * 4.01 + vec3( 5.3, 21.9, 13.1 ) );
  s += 0.0625 * noise3( p * 8.05 + vec3( 31.7, 7.1, 2.9 ) );
  return s / 0.9375;
}
`;
