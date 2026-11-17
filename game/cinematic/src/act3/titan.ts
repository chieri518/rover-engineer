// Act 3 · Titan: night in the Shangri-La dune field, the landing corridor between Dune 1 and Dune 2. Methane rain,
// the floodlight beams through it; the night closes in until the lights are the last thing visible, then they go
// out and the film cuts to black.
import * as THREE from 'three';
import { ACT3_CUES, ACT3_SHOTS } from './timing';
import { chaseClip, tightShadows } from './chase';
import { smoothstep } from '../lib/ease';
import { lampRig } from './fx/lamps';
import { Beams } from './fx/beams';
import { Rain } from './fx/rain';
import { SkyGlow } from './fx/skyglow';
import { Splashes } from './fx/splashes';

const HEADING = 45; // north-east across the landing corridor, Dune 1 rising ahead-left
const START = { x: -1480, z: -1085 };
const LAMP_COLOR = 0xffe2c0;

/** The game's own rain drops and floodlight cones (shader-material objects): the clip draws its own. */
function removeGameRainAndBeams(scene: THREE.Scene, rover: THREE.Object3D): void {
  const found: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m?.uniforms?.pxPerM && m.uniforms.stretch) found.push(o); // TitanRaindrops
  });
  scene.traverse((o) => {
    // The ice pebbles around the landing (Huygens-like): under the floodlights at night they read as polka dots.
    if (o instanceof THREE.InstancedMesh && (o.material as THREE.MeshLambertMaterial).color?.getHexString() === 'bdb7ad') found.push(o);
  });
  rover.traverse((o) => {
    if ((o as THREE.Mesh).material instanceof THREE.ShaderMaterial) found.push(o); // TitanBeams' cones, halo, glints
  });
  for (const o of found) o.removeFromParent();
}

export const titanClip = chaseClip({
  id: 'titan-chase',
  world: 'titan',
  shots: ACT3_SHOTS.titan,
  start: { ...START, headingDeg: HEADING },
  lead: 2.5,
  drive: () => ({ throttle: 0.45, steer: 0, brake: false }),
  framing: {
    distance: (t) => 6.6 + 3.5 * smoothstep(0.3, 5, t),
    height: (t) => 2.5 + 0.6 * smoothstep(0.3, 5, t),
    side: () => 1.4,
    lookAhead: () => 12,
    lookHeight: () => 0,
    fov: () => 40,
    followY: 0.15,
  },
  prepare(w) {
    w.offline.setSun(250, -25);
    w.offline.holdStorm(0.9);
    tightShadows(w, 14, 4096, 2);
  },
  setup({ w, track }) {
    const o = w.offline;
    removeGameRainAndBeams(o.scene, o.rover.object);
    const lamps = lampRig(w.data.tuning.rover, { color: LAMP_COLOR, intensity: 60, angleRad: 0.24, penumbra: 0.45, rangeM: 45, dropM: 0.8, toeOutDeg: 5, core: 0.6 });
    const p0 = track.position(0, new THREE.Vector3());
    const heightAt = (x: number, z: number) => w.scene.terrain.heightAt(x, z);
    const ground = { heightAt, centerX: p0.x, centerZ: p0.z, sizeM: 360, cellM: 2 };
    const beams = new Beams(lamps, { ground });
    const splashes = new Splashes(lamps, ground, { count: 9000, boxM: 34, life: 0.09, gain: 1.2 });
    const sky = new SkyGlow();
    const rain = new Rain(lamps, { stretch: 5, count: 80000, boxM: 26, fallMps: 5, wind: [0.8, 0.3], radiusMm: [1.5, 4.5], drawScale: 1.6, lampGain: 5, minPx: 1.2 });
    o.scene.add(sky.object, beams.object, rain.object, splashes.object);
    const hemi = o.skyLight as THREE.HemisphereLight;
    const ambient = new THREE.Color();
    const dark = new THREE.Color();
    const horizon = new THREE.Color();
    const zenith = new THREE.Color();
    const glow = new THREE.Color();
    const glowDir = new THREE.Vector3(-0.6, 0, -0.8).normalize(); // Saturn's side of the sky, ahead-left
    const out = ACT3_CUES.lightsOut.t;
    const black = ACT3_CUES.black.t;
    let lamp = 1;
    let night = 1;
    return {
      update(_f, t) {
        // The lights die with a short stutter at lightsOut.
        lamp = t < out ? 1 : t < out + 0.05 ? 0.15 : t < out + 0.09 ? 0.6 : 0;
        o.setLamp(lamp);
        lamps.update(o.rover.object, lamp);
        night = 1 - smoothstep(1.8, out - 0.1, t); // the night closes in: only the lights stay
        return {
          exposure: 2.4,
          contrast: 1.08,
          saturation: 0.9,
          tint: [1.0, 0.96, 0.9],
          lift: 0.006,
          liftColor: [0.55, 0.75, 1.0],
          bloomStrength: 0.45,
          bloomThreshold: 0.9,
          bloomRadius: 0.6,
          vignette: 0.45,
          fade: 1 - smoothstep(out + 0.1, black, t),
        };
      },
      afterView(_f, t) {
        hemi.color.multiplyScalar(0.6 + 2.5 * night);
        hemi.groundColor.multiplyScalar(0.6 + 2.5 * night);
        horizon.setRGB(0.06, 0.04, 0.025).multiplyScalar(0.05 + 0.95 * night);
        zenith.setRGB(0.006, 0.006, 0.008).multiplyScalar(night);
        glow.setRGB(0.05, 0.03, 0.015).multiplyScalar(night);
        sky.update(o.camera, horizon, zenith, glow, glowDir);
        const fog = o.scene.fog as THREE.FogExp2;
        fog.color.copy(horizon);
        fog.density = Math.min(fog.density, 0.0028); // thinner than the game's rain haze: the dunes stay in view
        ambient.copy(horizon).multiplyScalar(0.6);
        beams.update(o.camera, t, { haze: 0.02, curtains: 0.06, ambient, scatter: 1.2 });
        rain.update(o.camera, t, dark.copy(horizon).multiplyScalar(0.8), 1);
        splashes.update(o.camera, t);
      },
      dispose() {
        beams.dispose();
        rain.dispose();
        sky.dispose();
        splashes.dispose();
      },
    };
  },
});
