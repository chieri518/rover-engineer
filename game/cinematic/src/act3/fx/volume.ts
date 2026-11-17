// Participating media (dust storm, rain haze, floodlight beams) drawn as camera-facing slices, far to near. Each
// slice integrates the medium over its depth segment with a few jittered samples and blends over what is behind it.
// Because every slice is real geometry at its own depth, the scene's depth buffer occludes it: terrain, boulders
// and the rover cut the medium exactly where they stand (a ray march over a fullscreen quad could not, without a
// depth texture).
//
// The medium is GLSL supplied by the user:
//   void medium( vec3 p, vec3 rd, float dist, out vec3 radiance, out float extinction )
// radiance: the light it scatters toward the camera per unit of extinction (albedo × in-scattered light), linear HDR;
// extinction: per metre. The volume's own uniforms (time...) are passed in `uniforms`.
import * as THREE from 'three';
import { noiseTexture, NOISE_GLSL } from './noise';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float depth;
uniform vec2 sliceHalf;
uniform mat4 camWorld;
varying vec3 vWorld;
void main() {
  vec4 view = vec4( position.xy * sliceHalf, -depth, 1.0 );
  vWorld = ( camWorld * view ).xyz;
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
}
`;

const fragment = (medium: string, samples: number) => /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
uniform float depth;
uniform float depthNext;
uniform float frameJitter;
uniform sampler2D tGround;
uniform vec4 groundRect; // min x, min z, size (m), base height
varying vec3 vWorld;
// Terrain height (m) under xz, from the height window (base height outside it).
float terrainY( vec2 xz ) {
  vec2 uv = ( xz - groundRect.xy ) / groundRect.z;
  if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return groundRect.w;
  return groundRect.w + texture2D( tGround, uv ).r;
}
${medium}
void main() {
  #include <logdepthbuf_fragment>
  vec3 ro = cameraPosition;
  vec3 rd = vWorld - ro;
  float t0 = length( rd );
  rd /= t0;
  float t1 = t0 * depthNext / depth;
  float dt = ( t1 - t0 ) / ${samples.toFixed(1)};
  float j = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) + frameJitter );
  vec3 S = vec3( 0.0 );
  float T = 1.0;
  for ( int i = 0; i < ${samples}; i++ ) {
    float t = t0 + ( float( i ) + j ) * dt;
    vec3 p = ro + rd * t;
    // Under the ground the medium ends (the slice's depth test only clips its front).
    if ( p.y < terrainY( p.xz ) ) break;
    vec3 L;
    float ext;
    medium( p, rd, t, L, ext );
    float tr = exp( -ext * dt );
    S += T * L * ( 1.0 - tr );
    T *= tr;
  }
  if ( T > 0.9995 && dot( S, vec3( 1.0 ) ) < 1e-5 ) discard;
  gl_FragColor = vec4( S, 1.0 - T );
}
`;

export interface SliceVolumeOptions {
  /** Number of slices, and the nearest and farthest slice depths (m, along the view axis); exponential spacing. */
  count: number;
  near: number;
  far: number;
  /** Samples per slice. */
  samples: number;
  medium: string;
  uniforms: Record<string, THREE.IUniform>;
  /** Draw order base (slices draw far to near from here). */
  renderOrder?: number;
  /** Terrain heights for `terrainY()` in the medium and for ending samples under the ground. */
  ground?: { heightAt: (x: number, z: number) => number; centerX: number; centerZ: number; sizeM: number; cellM: number };
}

/** A window of terrain heights (relative to its centre's height) as a half-float texture. */
export function groundTexture(g: NonNullable<SliceVolumeOptions['ground']>): { tex: THREE.DataTexture; rect: THREE.Vector4 } {
  const n = Math.round(g.sizeM / g.cellM) + 1;
  const minX = g.centerX - g.sizeM / 2;
  const minZ = g.centerZ - g.sizeM / 2;
  const base = g.heightAt(g.centerX, g.centerZ);
  const data = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = THREE.DataUtils.toHalfFloat(g.heightAt(minX + i * g.cellM, minZ + j * g.cellM) - base);
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // Texel centres sit on the samples: the window spans half a cell beyond them on each side.
  return { tex, rect: new THREE.Vector4(minX - g.cellM / 2, minZ - g.cellM / 2, n * g.cellM, base) };
}

export class SliceVolume {
  readonly group = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly depths: number[] = [];
  private readonly shared: Record<string, THREE.IUniform>;
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly groundTex: THREE.DataTexture | null;

  constructor(opts: SliceVolumeOptions) {
    const ground = opts.ground ? groundTexture(opts.ground) : null;
    this.groundTex = ground?.tex ?? null;
    this.shared = {
      ...opts.uniforms,
      tGround: { value: ground?.tex ?? null },
      groundRect: { value: ground?.rect ?? new THREE.Vector4(1e9, 1e9, 1, -1e9) },
      tNoise: { value: noiseTexture() },
      camWorld: { value: new THREE.Matrix4() },
      frameJitter: { value: 0 },
    };
    const k = Math.pow(opts.far / opts.near, 1 / opts.count);
    for (let i = 0; i <= opts.count; i++) this.depths.push(opts.near * Math.pow(k, i));
    const frag = fragment(opts.medium, opts.samples);
    for (let i = 0; i < opts.count; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: frag,
        uniforms: {
          ...this.shared,
          depth: { value: this.depths[i]! },
          depthNext: { value: this.depths[i + 1]! },
          sliceHalf: { value: new THREE.Vector2(1, 1) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = (opts.renderOrder ?? 100) + (opts.count - i); // far slices first
      mesh.onBeforeRender = (_r, _s, camera) => {
        (mat.uniforms.camWorld!.value as THREE.Matrix4).copy(camera.matrixWorld);
      };
      this.mats.push(mat);
      this.group.add(mesh);
    }
  }

  get uniforms(): Record<string, THREE.IUniform> {
    return this.shared;
  }

  /** Size the slices to the camera's view (call after the camera is placed) and set the sample jitter for time t. */
  update(camera: THREE.PerspectiveCamera, t: number): void {
    const tanH = (Math.tan((camera.fov * Math.PI) / 360) / camera.zoom) * 1.25;
    this.mats.forEach((m, i) => {
      const d = this.depths[i]!;
      (m.uniforms.sliceHalf!.value as THREE.Vector2).set(d * tanH * camera.aspect, d * tanH);
    });
    this.shared.frameJitter!.value = (t * 960 * 0.6180339887) % 1;
  }

  dispose(): void {
    this.geometry.dispose();
    this.groundTex?.dispose();
    for (const m of this.mats) m.dispose();
  }
}
