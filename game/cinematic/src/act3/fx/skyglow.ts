// A faint glow low in the sky (Titan's night: the thick haze still scatters a little light, and Saturn shines on the
// night side), so the dunes stand as dark shapes against it instead of vanishing into a black sky. A big dome in the
// scene, drawn before everything else, brightest at the horizon; the scene's fog takes the same color so distant
// ground melts into it.
import * as THREE from 'three';

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vec4 w = modelMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 horizon;
uniform vec3 zenith;
uniform vec3 glowDir;
uniform vec3 glow;
varying vec3 vDir;
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize( vDir );
  float h = max( d.y, 0.0 );
  vec3 c = mix( horizon, zenith, pow( h, 0.45 ) );
  c += glow * pow( max( dot( d, glowDir ), 0.0 ), 6.0 ) * ( 1.0 - h );
  gl_FragColor = vec4( c, 1.0 );
}
`;

export class SkyGlow {
  readonly object: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  constructor() {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        horizon: { value: new THREE.Color() },
        zenith: { value: new THREE.Color() },
        glowDir: { value: new THREE.Vector3(1, 0, 0) },
        glow: { value: new THREE.Color() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.object = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), material);
    this.object.frustumCulled = false;
    this.object.renderOrder = -100;
  }

  update(camera: THREE.Camera, horizon: THREE.Color, zenith: THREE.Color, glow: THREE.Color, glowDir: THREE.Vector3): void {
    this.object.position.copy(camera.position);
    const u = this.object.material.uniforms;
    (u.horizon!.value as THREE.Color).copy(horizon);
    (u.zenith!.value as THREE.Color).copy(zenith);
    (u.glow!.value as THREE.Color).copy(glow);
    (u.glowDir!.value as THREE.Vector3).copy(glowDir);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
