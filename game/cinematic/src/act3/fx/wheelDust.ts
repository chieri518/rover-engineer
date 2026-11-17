// Dust thrown up by the wheels. The drive is pre-recorded, so every grain's birth (time, place, velocity) is worked
// out at load from the track; at render time each grain's position is a closed-form function of time (ballistic
// under the world's gravity, with air drag and wind where there is air). That keeps it exact at every motion-blur
// sub-frame. Grains are small soft discs lit by the Sun (unless they are in the terrain's shadow), the sky and the
// floodlights.
import * as THREE from 'three';
import { seeded } from '../../clock';
import { LAMP_GLSL, type LampRig } from './lamps';
import type { DriveTrack } from '../track';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${LAMP_GLSL}
attribute vec2 corner;
attribute vec4 birth;   // position (xyz), time
attribute vec4 vel;     // velocity (xyz), size (m)
attribute vec4 seed;    // ground y at birth, life (s), random, random
uniform float time;
uniform float gravity;
uniform float drag;     // 1/s (0: vacuum)
uniform vec3 wind;      // m/s (with drag)
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 ambient;
uniform vec4 shadowLine; // xz normal, offset, softness: sun visible where dot(n, xz) + offset < 0
uniform float lampGain;
uniform float opacity;
uniform float growth;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = corner;
  vColor = vec4( 0.0 );
  float a = time - birth.w;
  if ( a < 0.0 || a > seed.y ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
  vec3 p;
  if ( drag > 0.0 ) {
    float e = ( 1.0 - exp( -drag * a ) ) / drag;
    p = birth.xyz + wind * a + ( vel.xyz - wind ) * e;
    p.y -= gravity * ( a - e ) / drag;
  } else {
    p = birth.xyz + vel.xyz * a;
    p.y -= 0.5 * gravity * a * a;
  }
  float landed = smoothstep( 0.02, -0.04, p.y - seed.x ) * step( 0.06, a );
  p.y = max( p.y, seed.x );
  vec4 view = viewMatrix * vec4( p, 1.0 );
  float r = vel.w * ( 1.0 + growth * a );
  view.xy += corner * r;
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
  float sunVis = smoothstep( shadowLine.w, -shadowLine.w, dot( shadowLine.xy, p.xz ) + shadowLine.z );
  vec3 light = sunColor * sunVis * ( 0.6 + 0.4 * seed.z ) + ambient + lampGain * lampLight( p, 0.6 );
  float fade = ( 1.0 - smoothstep( 0.6, 1.0, a / seed.y ) ) * ( 1.0 - landed ) * smoothstep( 0.0, 0.05, a );
  // Unlit grains are black specks: in vacuum nothing lights them, and against the dark they are invisible anyway.
  float lum = dot( light, vec3( 0.2126, 0.7152, 0.0722 ) );
  vColor = vec4( light, opacity * fade * ( 0.5 + 0.5 * seed.w ) * smoothstep( 0.02, 0.25, lum ) );
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 albedo;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  #include <logdepthbuf_fragment>
  float d = dot( vUv, vUv );
  if ( d > 1.0 ) discard;
  float a = vColor.a * exp( -d * 3.0 );
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( albedo * vColor.rgb * a, a );
}
`;

export interface WheelDustOptions {
  /** Grains per second per wheel at full speed (scaled by speed / fullSpeed). */
  rate: number;
  fullSpeed: number;
  gravity: number;
  drag: number;
  wind: [number, number, number];
  /** Upward speed range (m/s), share of the rover's velocity kept, sideways spread (m/s). */
  up: [number, number];
  keep: [number, number];
  spread: number;
  size: [number, number];
  life: [number, number];
  albedo: THREE.ColorRepresentation;
  opacity: number;
  /** Size growth per second (puffs spread as they drift). */
  growth?: number;
  lampGain: number;
  /** Wheel geometry (chassis frame). */
  wheelBase: number;
  wheelTrack: number;
  rideHeight: number;
  /** Track time span to emit over (s): from, to. */
  from: number;
  to: number;
}

export class WheelDust {
  readonly object: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

  constructor(track: DriveTrack, groundAt: (x: number, z: number) => number, lamps: LampRig | null, o: WheelDustOptions) {
    const rnd = seeded(0xd057);
    const births: number[] = [];
    const vels: number[] = [];
    const seeds: number[] = [];
    const pos = new THREE.Vector3();
    const prev = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const v = new THREE.Vector3();
    const dt = 1 / 240;
    for (let t = o.from; t < o.to; t += dt) {
      track.position(t, pos);
      track.position(t - 0.01, prev);
      v.copy(pos).sub(prev).multiplyScalar(100);
      const speed = v.length();
      const n = (o.rate * dt * Math.min(1.5, speed / o.fullSpeed));
      track.forward(t, fwd);
      right.set(-fwd.z, 0, fwd.x).normalize();
      for (let w = 0; w < 4; w++) {
        let count = Math.floor(n + rnd());
        while (count-- > 0) {
          const bt = t + rnd() * dt;
          const sx = w < 2 ? o.wheelBase / 2 : -o.wheelBase / 2;
          const sz = w % 2 === 0 ? o.wheelTrack / 2 : -o.wheelTrack / 2;
          const bx = pos.x + fwd.x * (sx - 0.2) + right.x * sz + (rnd() - 0.5) * 0.25;
          const bz = pos.z + fwd.z * (sx - 0.2) + right.z * sz + (rnd() - 0.5) * 0.25;
          const gy = groundAt(bx, bz);
          const keep = o.keep[0] + (o.keep[1] - o.keep[0]) * rnd();
          const up = o.up[0] + (o.up[1] - o.up[0]) * Math.pow(rnd(), 1.5);
          const side = (rnd() - 0.5) * 2 * o.spread + Math.sign(sz) * o.spread * 0.5;
          births.push(bx, gy + 0.03, bz, bt);
          vels.push(v.x * keep + right.x * side, up, v.z * keep + right.z * side, o.size[0] + (o.size[1] - o.size[0]) * Math.pow(rnd(), 2));
          seeds.push(gy, o.life[0] + (o.life[1] - o.life[0]) * rnd(), rnd(), rnd());
        }
      }
    }
    const count = births.length / 4;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('birth', new THREE.InstancedBufferAttribute(new Float32Array(births), 4));
    geometry.setAttribute('vel', new THREE.InstancedBufferAttribute(new Float32Array(vels), 4));
    geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4));
    geometry.instanceCount = count;
    const zeroLamps = {
      lampPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
      lampDir: { value: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)] },
      lampColor: { value: new THREE.Color(0, 0, 0) },
      lampCone: { value: new THREE.Vector4(0.9, 0.95, 1, 0) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...(lamps?.uniforms ?? zeroLamps),
        time: { value: 0 },
        gravity: { value: o.gravity },
        drag: { value: o.drag },
        wind: { value: new THREE.Vector3(...o.wind) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color() },
        ambient: { value: new THREE.Color() },
        shadowLine: { value: new THREE.Vector4(0, 0, -1, 1) },
        lampGain: { value: o.lampGain },
        opacity: { value: o.opacity },
        growth: { value: o.growth ?? 0.6 },
        albedo: { value: new THREE.Color(o.albedo) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 200;
  }

  update(t: number, light: { sun: THREE.Color; ambient: THREE.Color; shadowLine?: THREE.Vector4 }): void {
    const u = this.object.material.uniforms;
    u.time!.value = t;
    (u.sunColor!.value as THREE.Color).copy(light.sun);
    (u.ambient!.value as THREE.Color).copy(light.ambient);
    if (light.shadowLine) (u.shadowLine!.value as THREE.Vector4).copy(light.shadowLine);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
