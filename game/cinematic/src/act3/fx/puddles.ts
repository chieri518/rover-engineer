// Titan: wet ground with standing methane puddles that mirror the floodlit rain haze and the night sky glow. A sheet
// laid just above the terrain over the drive; per pixel it reflects the view ray off the (rippled) ground and marches
// a few samples along the reflected ray through the floodlight beams (lamps.ts), adding the sky glow at the end, with
// Fresnel. Puddles come and go in patches (noise); between them the wet sand keeps a faint sheen. Additive.
import * as THREE from 'three';
import { LAMP_GLSL, type LampRig } from './lamps';
import { noiseTexture, NOISE_GLSL } from './noise';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${LAMP_GLSL}
${NOISE_GLSL}
uniform float time;
uniform float scatter;
uniform vec3 skyGlow;
uniform float strength;
uniform float sheen;
varying vec3 vWorld;
void main() {
  #include <logdepthbuf_fragment>
  vec2 xz = vWorld.xz;
  // Puddles: low spots in a patchy noise field; wet sand around them.
  float n = noise3( vec3( xz * 0.18, 0.5 ) ) * 0.65 + noise3( vec3( xz * 0.55, 3.1 ) ) * 0.35;
  float puddle = smoothstep( 0.5, 0.58, n );
  float wet = mix( sheen, 1.0, puddle );
  // Raindrop rings disturb the surface: a small, moving tilt.
  vec2 rip = vec2( noise3( vec3( xz * 3.0, time * 1.7 ) ), noise3( vec3( xz * 3.0 + 9.0, time * 1.7 ) ) ) - 0.5;
  vec3 nrm = normalize( vec3( rip.x * mix( 0.5, 0.12, puddle ), 1.0, rip.y * mix( 0.5, 0.12, puddle ) ) );
  vec3 v = normalize( vWorld - cameraPosition );
  vec3 r = reflect( v, nrm );
  float cosi = max( dot( -v, nrm ), 0.0 );
  float fres = 0.02 + 0.98 * pow( 1.0 - cosi, 5.0 );
  // March the reflected ray through the beams.
  vec3 acc = vec3( 0.0 );
  float dt = 1.1;
  for ( int i = 0; i < 10; i++ ) {
    vec3 p = vWorld + r * ( 0.3 + ( float( i ) + 0.5 ) * dt );
    acc += lampLight( p, 6.0 ) * dt;
  }
  vec3 col = acc * scatter + skyGlow * smoothstep( 0.0, 0.25, r.y );
  // The floodlight on the ground itself, seen in the wet sand as a smeared glare.
  col += lampLight( vWorld + vec3( 0.0, 0.3, 0.0 ), 2.0 ) * 0.04 * puddle;
  gl_FragColor = vec4( col * fres * wet * strength, 1.0 );
}
`;

export class Puddles {
  readonly object: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(lamps: LampRig, groundAt: (x: number, z: number) => number, area: { x0: number; z0: number; x1: number; z1: number; cellM: number }) {
    const nx = Math.ceil((area.x1 - area.x0) / area.cellM) + 1;
    const nz = Math.ceil((area.z1 - area.z0) / area.cellM) + 1;
    const pos = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = area.x0 + i * area.cellM;
        const z = area.z0 + j * area.cellM;
        pos.set([x, groundAt(x, z) + 0.015, z], (j * nx + i) * 3);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        index.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setIndex(index);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...lamps.uniforms,
        tNoise: { value: noiseTexture() },
        time: { value: 0 },
        scatter: { value: 0.1 },
        skyGlow: { value: new THREE.Color() },
        strength: { value: 1 },
        sheen: { value: 0.25 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.object = new THREE.Mesh(geometry, material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 50;
  }

  update(t: number, s: { scatter: number; skyGlow: THREE.Color; strength: number }): void {
    const u = this.object.material.uniforms;
    u.time!.value = t;
    u.scatter!.value = s.scatter;
    (u.skyGlow!.value as THREE.Color).copy(s.skyGlow);
    u.strength!.value = s.strength;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
