// Titan: methane raindrops that catch the floodlights. Instanced beads in a box that follows the camera (so the rain
// stays fixed in the world), falling with the wind; each drop is lit by the floodlights (lamps.ts) and only faintly
// by the night, so the rain shows where the beams cut through it. The motion-blur sub-frames turn the beads into
// streaks. Drawn additively (a lit drop adds light), depth tested against the scene.
import * as THREE from 'three';
import { seeded } from '../../clock';
import { LAMP_GLSL, type LampRig } from './lamps';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${LAMP_GLSL}
attribute vec2 corner;
attribute vec3 offset;
attribute vec4 drop; // radius (m), fall speed (m/s), phase, random
uniform vec3 boxCenter;
uniform float box;
uniform float time;
uniform vec2 wind;
uniform float pxPerM;
uniform float minPx;
uniform vec3 ambient;
uniform float lampGain;
uniform float density;
uniform float stretch;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vColor = vec3( 0.0 );
  vUv = corner;
  if ( drop.w > density ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
  vec3 p = offset + vec3( wind.x * time, -drop.y * time, wind.y * time );
  p.xz += 0.05 * vec2( sin( time * 2.1 + drop.z ), cos( time * 1.7 + drop.z * 1.3 ) );
  p = mod( p - boxCenter, box ) - 0.5 * box + boxCenter;
  vec4 view = viewMatrix * vec4( p, 1.0 );
  float depth = max( -view.z, 1e-3 );
  float r = drop.x;
  float rMin = minPx * depth / pxPerM;
  float faint = 1.0;
  if ( r < rMin ) { faint = ( r / rMin ) * ( r / rMin ); r = rMin; }
  // Long axis along the fall direction on screen.
  vec3 fall = normalize( vec3( wind.x, -drop.y, wind.y ) );
  vec2 up = ( viewMatrix * vec4( -fall, 0.0 ) ).xy;
  up = length( up ) > 1e-3 ? normalize( up ) : vec2( 0.0, 1.0 );
  vec2 side = vec2( up.y, -up.x );
  view.xy += side * corner.x * r + up * corner.y * r * stretch;
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
  float fade = smoothstep( 0.25, 0.8, depth ) * ( 1.0 - smoothstep( 0.3 * box, 0.5 * box, length( p - boxCenter ) ) );
  vColor = ( ambient + lampGain * lampLight( p, 0.5 ) ) * faint * fade / stretch;
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
varying vec3 vColor;
void main() {
  #include <logdepthbuf_fragment>
  float d = length( vec2( vUv.x, vUv.y * ( vUv.y > 0.0 ? 0.8 : 1.0 ) ) );
  if ( d > 1.0 ) discard;
  // A refracting bead: a bright rim and a glint toward the light, a dimmer body.
  float rim = smoothstep( 0.45, 0.85, d ) * ( 1.0 - smoothstep( 0.85, 1.0, d ) );
  float glint = exp( -dot( vUv - vec2( 0.0, -0.35 ), vUv - vec2( 0.0, -0.35 ) ) * 14.0 );
  float a = 0.25 * ( 1.0 - d ) + 0.6 * rim + 1.6 * glint;
  gl_FragColor = vec4( vColor * a, 1.0 );
}
`;

export class Rain {
  readonly object: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly size = new THREE.Vector2();
  private readonly ahead = new THREE.Vector3();

  constructor(lamps: LampRig, opts: { stretch: number; count: number; boxM: number; fallMps: number; wind: [number, number]; radiusMm: [number, number]; drawScale: number; lampGain: number; minPx: number }) {
    const n = opts.count;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const rnd = seeded(0x7a1);
    const offset = new Float32Array(n * 3);
    const drop = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      offset.set([rnd() * opts.boxM, rnd() * opts.boxM, rnd() * opts.boxM], i * 3);
      const k = Math.pow(rnd(), 2);
      const radius = ((opts.radiusMm[0] + (opts.radiusMm[1] - opts.radiusMm[0]) * k) / 1000) * opts.drawScale;
      drop.set([radius, opts.fallMps * (0.7 + 0.3 * k), rnd() * 6.28, rnd()], i * 4);
    }
    geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offset, 3));
    geometry.setAttribute('drop', new THREE.InstancedBufferAttribute(drop, 4));
    geometry.instanceCount = n;
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...lamps.uniforms,
        boxCenter: { value: new THREE.Vector3() },
        box: { value: opts.boxM },
        time: { value: 0 },
        wind: { value: new THREE.Vector2(...opts.wind) },
        pxPerM: { value: 1000 },
        minPx: { value: opts.minPx },
        ambient: { value: new THREE.Color() },
        lampGain: { value: opts.lampGain },
        density: { value: 1 },
        stretch: { value: opts.stretch },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 300;
    this.object.onBeforeRender = (renderer, _s, camera) => {
      renderer.getDrawingBufferSize(this.size);
      material.uniforms.pxPerM!.value = ((camera as THREE.PerspectiveCamera).projectionMatrix.elements[5] ?? 1) * this.size.y * 0.5;
    };
    this.boxM = opts.boxM;
  }

  private readonly boxM: number;

  update(camera: THREE.Camera, t: number, ambient: THREE.Color, density: number): void {
    const u = this.object.material.uniforms;
    u.time!.value = t;
    camera.getWorldDirection(this.ahead);
    (u.boxCenter!.value as THREE.Vector3).copy(camera.position).addScaledVector(this.ahead, this.boxM * 0.3);
    (u.ambient!.value as THREE.Color).copy(ambient);
    u.density!.value = density;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
