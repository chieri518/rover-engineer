// Mars dust storm: wind-blown dust around the camera. Soft streaks and a few larger puffs ride a steady
// wind through a box that follows the camera (so the dust stays fixed in the world), with more of them
// showing as the storm builds (intensity 0..1). Rendering only: the storm's rules live in rules/storm.ts.
import * as THREE from 'three';

// Presentation settings, not game rules.
const COUNT = 9000;
const BOX_M = 56; // the dust box around the camera
const WIND_MPS = 16; // a regional storm's surface wind
const WIND_AZIMUTH_DEG = 70; // blowing toward this azimuth (terrain.json convention)
const GUST = 0.35; // wind speed swings by this share
const STREAK_M = 1.1; // a small grain's streak length (motion blur)
const PUFF_M = 3.5; // the largest puffs
const MAX_POINT_PX = 160;
const BRIGHTEN = 1.6; // dust in the air is lit from all sides: a little brighter than the haze behind it
const OPACITY = 0.7;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec2 seed; // x: which share of the storm shows it (0..1); y: 0 a fine streak .. 1 a large puff
uniform vec3 camPos;
uniform vec3 drift; // meters the wind has carried the dust so far
uniform float box;
uniform float density;
uniform float time;
uniform float halfHeightPx;
uniform float streakM;
uniform float puffM;
uniform float maxPx;
varying float vAlpha;
varying float vAspect;
void main() {
  vec3 p = position + drift;
  p.y += 0.6 * sin( time * 1.7 + seed.x * 40.0 ); // a little lift and fall
  p = mod( p - camPos, box ) - 0.5 * box + camPos;
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float big = seed.y * seed.y * seed.y;
  float sizeM = mix( streakM, puffM, big );
  float depth = max( -mv.z, 0.1 );
  gl_PointSize = min( maxPx, sizeM * projectionMatrix[1][1] * halfHeightPx / depth );
  float r = length( p - camPos );
  // Fade at the box edge (no popping), right at the lens, and for the grains this storm strength does not reach.
  vAlpha = ( 1.0 - smoothstep( 0.32 * box, 0.5 * box, r ) ) * smoothstep( 0.8, 3.0, depth ) * step( seed.x, density );
  vAlpha *= mix( 1.0, 0.25, big ) * mix( 0.6, 1.0, fract( seed.x * 13.7 ) );
  vAspect = mix( 9.0, 2.0, big );
  if ( vAlpha <= 0.0 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); // off screen
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
uniform float opacity;
varying float vAlpha;
varying float vAspect;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length( vec2( c.x, c.y * vAspect ) ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.0, 1.0, d ) ) * vAlpha * opacity;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( color, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class MarsDust {
  readonly object: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly drift = new THREE.Vector3();
  private time = 0;

  /** camera: its position is read at draw time, so the box always follows the current view. */
  constructor(camera: THREE.Camera) {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 2);
    // A fixed pseudo-random layout (no Math.random), so the dust looks the same every run.
    let s = 24680;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < COUNT; i++) {
      pos.set([rnd() * BOX_M, rnd() * BOX_M, rnd() * BOX_M], i * 3);
      seed.set([rnd(), rnd()], i * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        camPos: { value: camera.position },
        drift: { value: this.drift },
        box: { value: BOX_M },
        density: { value: 0 },
        time: { value: 0 },
        halfHeightPx: { value: 450 },
        streakM: { value: STREAK_M },
        puffM: { value: PUFF_M },
        maxPx: { value: MAX_POINT_PX },
        color: { value: new THREE.Color() },
        opacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.object = new THREE.Points(geometry, material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  /**
   * Advance the dust. intensity: the storm, 0..1 (the share of grains shown and their opacity);
   * color: the haze color (linear); heightPx: the drawing buffer's height.
   */
  update(dt: number, intensity: number, color: readonly [number, number, number], heightPx: number): void {
    const u = this.object.material.uniforms;
    this.object.visible = intensity > 0.01;
    if (!this.object.visible) return;
    this.time += dt;
    const speed = WIND_MPS * (1 + GUST * Math.sin(this.time * 0.9) * Math.sin(this.time * 0.37 + 1));
    const az = (WIND_AZIMUTH_DEG * Math.PI) / 180;
    this.drift.x = (this.drift.x + Math.sin(az) * speed * dt) % (BOX_M * 1000);
    this.drift.z = (this.drift.z - Math.cos(az) * speed * dt) % (BOX_M * 1000);
    u.time!.value = this.time % 1000;
    u.density!.value = intensity;
    u.opacity!.value = OPACITY * Math.min(1, 0.4 + intensity);
    u.halfHeightPx!.value = heightPx / 2;
    (u.color!.value as THREE.Color).setRGB(color[0] * BRIGHTEN, color[1] * BRIGHTEN, color[2] * BRIGHTEN);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
