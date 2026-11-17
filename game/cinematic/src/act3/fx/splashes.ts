// Titan: raindrops splashing on the ground, seen where the floodlights fall. Each splash site sits on the terrain in
// a box that follows the camera, flashes briefly every so often (its own period and phase: purely a function of
// time) as a small crown that spreads and fades, lit by the floodlights. Additive, depth tested.
import * as THREE from 'three';
import { seeded } from '../../clock';
import { LAMP_GLSL, type LampRig } from './lamps';
import { groundTexture, type SliceVolumeOptions } from './volume';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${LAMP_GLSL}
attribute vec2 corner;
attribute vec2 site;   // position in the box (m)
attribute vec4 seed;   // period (s), phase (0..1), size (m), random
uniform vec2 boxCenter;
uniform float box;
uniform float time;
uniform float life;
uniform float gain;
uniform sampler2D tGround;
uniform vec4 groundRect;
varying vec2 vUv;
varying vec3 vColor;
varying float vAge;
void main() {
  vUv = corner;
  vColor = vec3( 0.0 );
  vec2 xz = mod( site - boxCenter, box ) - 0.5 * box + boxCenter;
  // Each site jumps to a fresh spot every cycle, so splashes never repeat in place.
  float cycle = floor( time / seed.x + seed.y );
  vec2 jitter = fract( sin( vec2( cycle * 12.9898 + seed.w * 78.233, cycle * 39.425 + seed.w * 11.135 ) ) * 43758.5453 ) - 0.5;
  xz += jitter * 1.2;
  float age = fract( time / seed.x + seed.y ) * seed.x;
  vAge = age / life;
  if ( vAge > 1.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
  vec2 uv = ( xz - groundRect.xy ) / groundRect.z;
  float y = groundRect.w + texture2D( tGround, clamp( uv, 0.0, 1.0 ) ).r;
  vec3 p = vec3( xz.x, y + 0.01, xz.y );
  vec4 view = viewMatrix * vec4( p, 1.0 );
  float r = seed.z * ( 0.4 + 0.9 * vAge );
  // A crown: wider than tall, standing on the ground.
  view.xy += vec2( corner.x * r, ( corner.y + 0.9 ) * r * 0.55 );
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
  vColor = gain * lampLight( p + vec3( 0.0, 0.05, 0.0 ), 0.8 );
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
varying vec3 vColor;
varying float vAge;
void main() {
  #include <logdepthbuf_fragment>
  float d = length( vUv * vec2( 1.0, 1.4 ) );
  if ( d > 1.0 ) discard;
  float ring = exp( -pow( ( d - mix( 0.2, 0.85, vAge ) ) * 7.0, 2.0 ) );
  float core = exp( -d * d * 18.0 ) * ( 1.0 - vAge );
  float a = ( ring * 0.8 + core ) * ( 1.0 - vAge ) * ( 1.0 - vAge );
  gl_FragColor = vec4( vColor * a, 1.0 );
}
`;

export class Splashes {
  readonly object: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly tex: THREE.DataTexture;
  private readonly ahead = new THREE.Vector3();

  constructor(lamps: LampRig, ground: NonNullable<SliceVolumeOptions['ground']>, opts: { count: number; boxM: number; life: number; gain: number }) {
    const n = opts.count;
    const g = groundTexture(ground);
    this.tex = g.tex;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const rnd = seeded(0x5b1);
    const site = new Float32Array(n * 2);
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      site.set([rnd() * opts.boxM, rnd() * opts.boxM], i * 2);
      seed.set([0.35 + rnd() * 0.6, rnd(), 0.025 + 0.03 * rnd(), rnd()], i * 4);
    }
    geometry.setAttribute('site', new THREE.InstancedBufferAttribute(site, 2));
    geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 4));
    geometry.instanceCount = n;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...lamps.uniforms,
        boxCenter: { value: new THREE.Vector2() },
        box: { value: opts.boxM },
        time: { value: 0 },
        life: { value: opts.life },
        gain: { value: opts.gain },
        tGround: { value: g.tex },
        groundRect: { value: g.rect },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 290;
    this.boxM = opts.boxM;
  }

  private readonly boxM: number;

  update(camera: THREE.Camera, t: number): void {
    const u = this.object.material.uniforms;
    u.time!.value = t;
    camera.getWorldDirection(this.ahead);
    (u.boxCenter!.value as THREE.Vector2).set(camera.position.x + this.ahead.x * this.boxM * 0.4, camera.position.z + this.ahead.z * this.boxM * 0.4);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.tex.dispose();
  }
}
