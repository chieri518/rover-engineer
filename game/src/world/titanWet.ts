// titan-fx: rain. Wet ground on Titan (presentation only). While the methane rain falls, the ground darkens and
// gains a faint sheen: the hazy sky reflected at grazing angles and a glint toward the Sun and the floodlights.
// After the rain it dries over a few minutes of mission time. Cassini saw a large area darken after the 2010
// equatorial storm, most likely from rain (Turtle et al. 2011). Numbers: tuning.look.wet.
//
// - stepWetness(): the pure wetness stepper (wets fast toward the rain intensity, dries slowly).
// - TITAN_WET_PARS / TITAN_WET_GROUND: GLSL for lunarLighting.ts (uniform declarations; the ground color chunk).
// - titanWetUniforms: the shared uniforms object those chunks read, assigned to Titan materials.
// - TitanWet: the scene's per-frame updater (wetness from mission time and rain, Sun and floodlight glints).
import * as THREE from 'three';
import type { TitanWetTuning } from '../rules/titanTypes';

/** Next wetness (0..1) after `dtS` mission seconds of rain at `rain` (0..1): wets toward it, dries linearly. */
export function stepWetness(wet: number, rain: number, dtS: number, t: Pick<TitanWetTuning, 'wetTauS' | 'dryS'>): number {
  const r = Math.min(1, Math.max(0, rain));
  const dt = Math.max(0, dtS);
  if (r > wet) return wet + (r - wet) * (1 - Math.exp(-dt / Math.max(t.wetTauS, 1e-6)));
  return Math.max(r, wet - dt / Math.max(t.dryS, 1e-6));
}

/** Uniform declarations (in TITAN_PARS: before GROUND_PARS, so no moonNoise here). */
export const TITAN_WET_PARS = /* glsl */ `
uniform float titanWet;
uniform vec4 titanWetLook;      // darken, sky sheen, Sun glint, floodlight glint
uniform vec3 titanWetShape;     // shininess, fresnel0, 1 / patch size (1/m)
uniform vec3 titanWetSunDir;    // world, toward the Sun
uniform vec3 titanWetSun;       // Sun color x intensity (linear)
uniform vec3 titanWetSky;       // the sky at the horizon (linear), reflected at grazing angles
uniform vec3 titanWetLampPos;   // world
uniform vec3 titanWetLampDir;   // world, along the beam
uniform vec3 titanWetLamp;      // floodlight color x intensity (0 when off)
uniform vec4 titanWetLampCone;  // cos outer, cos inner, range (m), decay
`;

/**
 * Ground color chunk, at the end of the MOON_TITAN block in GROUND_COLOR (wp, moonBump, moonNoise, diffuseColor in scope).
 * Darkens the albedo and adds the sheen as emitted light, so it is lit as a reflection, not by the scene lights.
 */
export const TITAN_WET_GROUND = /* glsl */ `
if ( titanWet > 0.001 ) {
  // Patches: hollows and flats hold more liquid than the rest.
  float wetPatch = smoothstep( -0.35, 0.35, moonNoise( wp * titanWetShape.z ).x + 0.25 * moonNoise( wp * titanWetShape.z * 3.1 ).x );
  float wetK = titanWet * ( 0.65 + 0.35 * wetPatch );
  diffuseColor.rgb *= mix( 1.0, titanWetLook.x, wetK );
  vec3 wetN = inverseTransformDirection( normalize( vNormal ), viewMatrix );
  wetN = normalize( wetN - vec3( moonBump.y, 0.0, moonBump.z ) );
  vec3 wetV = normalize( cameraPosition - vMoonWorld );
  vec3 wetR = reflect( - wetV, wetN );
  float wetF = titanWetShape.y + ( 1.0 - titanWetShape.y ) * pow( 1.0 - saturate( dot( wetN, wetV ) ), 5.0 );
  vec3 wetSheen = titanWetLook.y * wetF * titanWetSky;
  wetSheen += titanWetLook.z * wetF * pow( saturate( dot( wetR, titanWetSunDir ) ), titanWetShape.x ) * titanWetSun;
  vec3 wetL = titanWetLampPos - vMoonWorld;
  float wetD = length( wetL );
  wetL /= max( wetD, 1e-3 );
  float wetCone = smoothstep( titanWetLampCone.x, titanWetLampCone.y, dot( - wetL, titanWetLampDir ) );
  float wetFall = pow( saturate( 1.0 - wetD / titanWetLampCone.z ), titanWetLampCone.w ) / max( wetD, 1.0 );
  wetSheen += titanWetLook.w * wetF * wetCone * wetFall * pow( saturate( dot( wetR, wetL ) ), titanWetShape.x ) * titanWetLamp;
  totalEmissiveRadiance += wetSheen * wetK * ( 0.6 + 0.4 * wetPatch );
}
`;

/** Shared by every Titan material (only the ground's color chunk reads them). */
export const titanWetUniforms = {
  titanWet: { value: 0 },
  titanWetLook: { value: new THREE.Vector4(1, 0, 0, 0) },
  titanWetShape: { value: new THREE.Vector3(40, 0.04, 0.2) },
  titanWetSunDir: { value: new THREE.Vector3(0, 1, 0) },
  titanWetSun: { value: new THREE.Color(0, 0, 0) },
  titanWetSky: { value: new THREE.Color(0, 0, 0) },
  titanWetLampPos: { value: new THREE.Vector3() },
  titanWetLampDir: { value: new THREE.Vector3(1, 0, 0) },
  titanWetLamp: { value: new THREE.Color(0, 0, 0) },
  titanWetLampCone: { value: new THREE.Vector4(0.8, 0.9, 30, 1) },
};

type RGB = readonly [number, number, number];
const lampWorld = new THREE.Vector3();
const lampTarget = new THREE.Vector3();

/** Steps the wetness from the mission clock and the rain, and feeds the Sun and floodlight to the sheen. */
export class TitanWet {
  wetness = 0;
  private last: number | null = null;
  /** Development: hold the wetness at a value (null: follow the rain). */
  hold: number | null = null;

  constructor(private readonly t: TitanWetTuning) {
    const u = titanWetUniforms;
    u.titanWet.value = 0;
    u.titanWetLook.value.set(t.darken, t.sky, t.sun, t.lamp);
    u.titanWetShape.value.set(t.shininess, t.fresnel0, 1 / Math.max(t.patchM, 0.1));
    if (import.meta.env?.DEV) (window as unknown as { __titanWet?: TitanWet }).__titanWet = this;
  }

  /**
   * Once per frame: mission seconds (the wetness follows mission time, so sleep and jumps dry it too), rain 0..1,
   * the Sun light, the look's horizon sky, and the floodlight (null if none).
   */
  update(seconds: number, rain: number, sun: THREE.DirectionalLight, look: { horizon: RGB } | null, lamp: THREE.SpotLight | null): void {
    const dt = this.last === null || seconds < this.last ? 0 : seconds - this.last;
    this.last = seconds;
    this.wetness = this.hold ?? stepWetness(this.wetness, rain, dt, this.t);
    const u = titanWetUniforms;
    u.titanWet.value = this.wetness;
    if (this.wetness <= 0.001) return;
    u.titanWetSunDir.value.subVectors(sun.position, sun.target.position).normalize();
    u.titanWetSun.value.copy(sun.color).multiplyScalar(sun.intensity);
    if (look) u.titanWetSky.value.setRGB(look.horizon[0], look.horizon[1], look.horizon[2]);
    if (lamp && lamp.intensity > 0) {
      lamp.getWorldPosition(lampWorld);
      lamp.target.getWorldPosition(lampTarget);
      u.titanWetLampPos.value.copy(lampWorld);
      u.titanWetLampDir.value.subVectors(lampTarget, lampWorld).normalize();
      u.titanWetLamp.value.copy(lamp.color).multiplyScalar(lamp.intensity);
      u.titanWetLampCone.value.set(Math.cos(lamp.angle), Math.cos(lamp.angle * (1 - lamp.penumbra)), lamp.distance || 50, lamp.decay);
    } else {
      u.titanWetLamp.value.setRGB(0, 0, 0);
    }
  }

  dispose(): void {
    titanWetUniforms.titanWet.value = 0;
    if (import.meta.env?.DEV) delete (window as unknown as { __titanWet?: TitanWet }).__titanWet;
  }
}
