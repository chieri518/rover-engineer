// Rover-only light for the chase clips: the motivated light a camera crew would see on a vehicle that the game's
// lights alone leave as a black cutout. A key-like rim (e.g. floodlight spill bouncing back from the lit ground
// ahead, or the low Sun grazing an edge) as a real direct light in the rover's physically based materials (so it
// gives specular edge highlights), and a soft bounce from the ground below plus a fill from the camera side, as
// extra indirect light. It touches only the dressed rover's materials (MeshStandard/Physical under the rover), never
// the terrain or anything else.
import * as THREE from 'three';

const PARS = /* glsl */ `
uniform vec3 act3RimDir;     // world direction toward the rim light
uniform vec3 act3RimColor;   // linear, intensity folded in
uniform vec3 act3Bounce;     // light from below (ground bounce), linear
uniform vec3 act3FillDir;
uniform vec3 act3Fill;       // soft fill from act3FillDir, linear
`;

const LIGHT = /* glsl */ `
{
  IncidentLight act3L;
  act3L.direction = normalize( ( viewMatrix * vec4( act3RimDir, 0.0 ) ).xyz );
  act3L.color = act3RimColor;
  act3L.visible = true;
  RE_Direct( act3L, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  vec3 nW = inverseTransformDirection( geometryNormal, viewMatrix );
  float below = clamp( 0.5 - 0.5 * nW.y, 0.0, 1.0 );
  float fill = clamp( 0.5 + 0.5 * dot( nW, act3FillDir ), 0.0, 1.0 );
  reflectedLight.indirectDiffuse += ( act3Bounce * below + act3Fill * fill * fill ) * BRDF_Lambert( material.diffuseColor );
}
`;

export class RoverLight {
  readonly uniforms = {
    act3RimDir: { value: new THREE.Vector3(0, 1, 0) },
    act3RimColor: { value: new THREE.Color(0, 0, 0) },
    act3Bounce: { value: new THREE.Color(0, 0, 0) },
    act3FillDir: { value: new THREE.Vector3(0, 1, 0) },
    act3Fill: { value: new THREE.Color(0, 0, 0) },
  };

  /** Patch every physically based material under the rover (call before the first render). */
  constructor(rover: THREE.Object3D) {
    const seen = new Set<THREE.Material>();
    rover.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!(m instanceof THREE.MeshStandardMaterial) || seen.has(m)) return;
      seen.add(m);
      const prev = m.onBeforeCompile.bind(m);
      m.onBeforeCompile = (shader, renderer) => {
        prev(shader, renderer);
        Object.assign(shader.uniforms, this.uniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${PARS}`)
          .replace('#include <lights_fragment_end>', `${LIGHT}\n#include <lights_fragment_end>`);
      };
      const prevKey = m.customProgramCacheKey.bind(m);
      m.customProgramCacheKey = () => `act3light|${prevKey()}`;
      m.needsUpdate = true;
    });
  }

  set(s: { rimDir?: THREE.Vector3; rim?: THREE.Color; bounce?: THREE.Color; fillDir?: THREE.Vector3; fill?: THREE.Color }): void {
    const u = this.uniforms;
    if (s.rimDir) u.act3RimDir.value.copy(s.rimDir).normalize();
    if (s.rim) u.act3RimColor.value.copy(s.rim);
    if (s.bounce) u.act3Bounce.value.copy(s.bounce);
    if (s.fillDir) u.act3FillDir.value.copy(s.fillDir).normalize();
    if (s.fill) u.act3Fill.value.copy(s.fill);
  }
}
