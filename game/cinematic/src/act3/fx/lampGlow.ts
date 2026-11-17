// A soft glow at each floodlight housing (the lens seen through haze and the camera's own glare), drawn additively
// and depth tested, so it shows wherever a housing peeks out past the rover's body. Bloom spreads it further.
import * as THREE from 'three';
import type { LampRig } from './lamps';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec2 corner;
uniform vec3 center;
uniform float size;
varying vec2 vUv;
void main() {
  vUv = corner;
  vec4 view = viewMatrix * vec4( center, 1.0 );
  view.xy += corner * size;
  view.z += 0.15; // drawn a little toward the camera so the housing's own face does not hide it
  gl_Position = projectionMatrix * view;
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  float d = dot( vUv, vUv );
  if ( d > 1.0 ) discard;
  float g = exp( -d * 9.0 ) * 1.0 + exp( -d * 60.0 ) * 4.0;
  gl_FragColor = vec4( color * g, 1.0 );
}
`;

export class LampGlow {
  readonly object = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly geometry = new THREE.BufferGeometry();

  constructor(private readonly lamps: Pick<LampRig, 'positions'>, color: THREE.ColorRepresentation, size: number) {
    this.geometry.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    for (let i = 0; i < lamps.positions.length; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { center: { value: lamps.positions[i]! }, size: { value: size }, color: { value: new THREE.Color(color) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 400;
      this.mats.push(mat);
      this.object.add(mesh);
    }
    this.base = new THREE.Color(color);
  }

  private readonly base: THREE.Color;

  /** k: lamp level 0..1 (after the lamp rig was updated). */
  update(k: number, gain = 1): void {
    for (const m of this.mats) (m.uniforms.color!.value as THREE.Color).copy(this.base).multiplyScalar(k * gain);
    this.object.visible = k > 0;
    void this.lamps;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.mats) m.dispose();
  }
}

/** Small glowing markers fixed to the rover (status LEDs), in the chassis frame: forward +x, up +y, right +z. */
export class RoverMarkers {
  readonly positions: THREE.Vector3[];
  readonly glow: LampGlow;

  constructor(private readonly local: THREE.Vector3[], color: THREE.ColorRepresentation, size: number) {
    this.positions = local.map(() => new THREE.Vector3());
    this.glow = new LampGlow(this, color, size);
  }

  get object(): THREE.Object3D {
    return this.glow.object;
  }

  update(rover: THREE.Object3D, k: number): void {
    rover.updateMatrixWorld(true);
    this.local.forEach((p, i) => this.positions[i]!.copy(p).applyMatrix4(rover.matrixWorld));
    this.glow.update(k);
  }

  dispose(): void {
    this.glow.dispose();
  }
}
