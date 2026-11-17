// The rover's two floodlight housings as light sources for Act 3's effects (beams in the haze, rain and dust that
// catch the light, lens glow): positions and aim follow the posed rover every sub-frame. The housings sit where the
// game's model draws them (lampMounts, the same layout as roverModel.ts), aimed like the game's SpotLight (slightly
// down) with a small toe-out each, so the two beams part a little.
import * as THREE from 'three';
import { lampMounts } from '../../../../src/world/titanBeams';
import type { RoverHandling } from '../../../../src/rules/types';

export interface LampRig {
  readonly uniforms: {
    lampPos: THREE.IUniform<THREE.Vector3[]>;
    lampDir: THREE.IUniform<THREE.Vector3[]>;
    /** Linear color × intensity (0 when off). */
    lampColor: THREE.IUniform<THREE.Color>;
    /** cos(outer), cos(inner), range (m), core share. */
    lampCone: THREE.IUniform<THREE.Vector4>;
  };
  /** Follow the rover's object (after it is posed); k: 0 off .. 1 full. */
  update(rover: THREE.Object3D, k: number): void;
  /** World positions of the two housings (valid after update). */
  readonly positions: THREE.Vector3[];
}

/** GLSL: `vec3 lampLight( vec3 p, float r0 )`, the floodlights' irradiance at p (both housings, cone, 1/d², range fade). */
export const LAMP_GLSL = /* glsl */ `
uniform vec3 lampPos[ 2 ];
uniform vec3 lampDir[ 2 ];
uniform vec3 lampColor;
uniform vec4 lampCone;
// r0: distances below it count as r0 (keeps the light near the housing from blowing out a halo).
vec3 lampLight( vec3 p, float r0 ) {
  vec3 sum = vec3( 0.0 );
  for ( int i = 0; i < 2; i++ ) {
    vec3 d = p - lampPos[ i ];
    float r = length( d );
    float c = dot( d / max( r, 1e-4 ), lampDir[ i ] );
    float cone = smoothstep( lampCone.x, lampCone.y, c );
    float core = smoothstep( mix( lampCone.x, lampCone.y, 0.6 ), 1.0, c );
    float fall = 1.0 - smoothstep( lampCone.z * 0.55, lampCone.z, r );
    sum += lampColor * ( cone * ( 1.0 - lampCone.w ) + core * lampCone.w ) * fall / max( r * r, r0 * r0 );
  }
  return sum;
}
`;

export function lampRig(handling: RoverHandling, opts: { color: THREE.ColorRepresentation; intensity: number; angleRad: number; penumbra: number; rangeM: number; dropM: number; toeOutDeg: number; core?: number }): LampRig {
  const mounts = lampMounts(handling.body);
  const aims = mounts.map((_m, i) => {
    const toe = ((i === 0 ? -1 : 1) * opts.toeOutDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(toe), -opts.dropM / 10, Math.sin(toe)).normalize();
  });
  const positions = [new THREE.Vector3(), new THREE.Vector3()];
  const dirs = [new THREE.Vector3(), new THREE.Vector3()];
  const base = new THREE.Color(opts.color);
  const uniforms = {
    lampPos: { value: positions },
    lampDir: { value: dirs },
    lampColor: { value: new THREE.Color() },
    lampCone: { value: new THREE.Vector4(Math.cos(opts.angleRad), Math.cos(opts.angleRad * (1 - opts.penumbra)), opts.rangeM, opts.core ?? 0.5) },
  };
  return {
    uniforms,
    positions,
    update(rover, k) {
      rover.updateMatrixWorld(true);
      const q = rover.getWorldQuaternion(new THREE.Quaternion());
      for (let i = 0; i < 2; i++) {
        positions[i]!.copy(mounts[i]!).applyMatrix4(rover.matrixWorld);
        dirs[i]!.copy(aims[i]!).applyQuaternion(q);
      }
      uniforms.lampColor.value.copy(base).multiplyScalar(opts.intensity * Math.max(0, k));
    },
  };
}
