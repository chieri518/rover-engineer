// Floodlight beams in a hazy, rainy (or dusty) atmosphere: a slice volume (volume.ts) whose medium is a thin haze
// with drifting rain curtains, lit by the two floodlight housings (lamps.ts) and faintly by the night sky. The
// scene's depth buffer cuts the beams at the ground, the rover and anything else in their way.
import * as THREE from 'three';
import { SliceVolume, type SliceVolumeOptions } from './volume';
import { LAMP_GLSL, type LampRig } from './lamps';

const MEDIUM = /* glsl */ `
${LAMP_GLSL}
uniform float time;
uniform float haze;       // base extinction (per m)
uniform float curtains;   // extra extinction in the drifting rain curtains (per m)
uniform vec2 drift;       // m/s the curtains drift with the wind
uniform float fallMps;
uniform vec3 ambient;     // night sky light on the haze (linear)
uniform float scatter;    // share of the lamp light the haze sends back toward the camera
void medium( vec3 p, vec3 rd, float dist, out vec3 L, out float ext ) {
  vec3 q = p - vec3( drift.x * time, -fallMps * time, drift.y * time );
  float n = noise3( q * vec3( 0.22, 0.06, 0.22 ) );
  float m = noise3( q * vec3( 0.9, 0.25, 0.9 ) + 7.3 );
  ext = haze + curtains * smoothstep( 0.35, 0.8, n ) * ( 0.6 + 0.8 * m );
  L = lampLight( p, 4.0 ) * scatter + ambient;
}
`;

export class Beams {
  readonly volume: SliceVolume;

  constructor(lamps: LampRig, opts: { count?: number; far?: number; ground?: SliceVolumeOptions['ground'] }) {
    this.volume = new SliceVolume({
      count: opts.count ?? 36,
      near: 0.5,
      far: opts.far ?? 140,
      samples: 2,
      medium: MEDIUM,
      ground: opts.ground,
      uniforms: {
        ...lamps.uniforms,
        time: { value: 0 },
        haze: { value: 0.01 },
        curtains: { value: 0.03 },
        drift: { value: new THREE.Vector2(0.6, 0.2) },
        fallMps: { value: 3 },
        ambient: { value: new THREE.Color() },
        scatter: { value: 0.25 },
      },
    });
  }

  get object(): THREE.Object3D {
    return this.volume.group;
  }

  update(camera: THREE.PerspectiveCamera, t: number, s: { haze: number; curtains: number; ambient: THREE.Color; scatter: number }): void {
    const u = this.volume.uniforms;
    u.time!.value = t;
    u.haze!.value = s.haze;
    u.curtains!.value = s.curtains;
    (u.ambient!.value as THREE.Color).copy(s.ambient);
    u.scatter!.value = s.scatter;
    this.volume.update(camera, t);
  }

  dispose(): void {
    this.volume.dispose();
  }
}
