// Act 3 · Moon: the rover crests the sunlit rim of Rocky area 1, a small fresh crater whose floor is the game's
// "Rocky area 1 cold patch" (a permanently shadowed cold trap 500 m from the lander), and drives down into the dark.
// Low Sun behind it, a long shadow ahead, the crater pitch black (no air: no light in the shadows); wheel dust arcs
// in the low gravity. The floodlights snap on and light the regolith ahead.
import * as THREE from 'three';
import { ACT3_CUES, ACT3_SHOTS } from './timing';
import { chaseClip, tightShadows } from './chase';
import { smoothstep } from '../lib/ease';
import { lampRig } from './fx/lamps';
import { LampGlow } from './fx/lampGlow';
import { WheelDust } from './fx/wheelDust';
import { Rocks } from './fx/rocks';
import { RoverLight } from './fx/roverLight';

const HEADING = 284; // toward the cold patch's centroid from its drive point (-1030, -210)
const DIR = { x: Math.sin((HEADING * Math.PI) / 180), z: -Math.cos((HEADING * Math.PI) / 180) };
const START_BACK_M = 104;
const DURATION = ACT3_SHOTS.moon.reduce((a, s) => a + s.duration, 0);
const LAMP_COLOR = 0xf4f1ea;
/** Where the crest's shadow begins along the drive (the rover crosses it about 1 s into the shot). */
const TERMINATOR = { x: -949, z: -190 };
const MOON_G = 1.62;
const ROCK_LAYER = 2;

export const moonClip = chaseClip({
  id: 'moon-chase',
  world: 'moon',
  shots: ACT3_SHOTS.moon,
  start: { x: -1030 - DIR.x * START_BACK_M, z: -210 - DIR.z * START_BACK_M, headingDeg: HEADING },
  lead: 2.5,
  drive: () => ({ throttle: 0.55, steer: 0, brake: false }),
  // An operator's chase: low, off to the rover's right, easing in and across as the rover tips over the rim.
  framing: {
    distance: (t) => 5.6 - 0.8 * smoothstep(0, DURATION, t),
    height: (t) => 1.15 + 0.25 * smoothstep(1.0, DURATION, t),
    side: (t) => 1.25 - 0.75 * smoothstep(0, DURATION, t),
    lookAhead: () => 9,
    lookHeight: (t) => 0.45 - 0.35 * smoothstep(1.0, DURATION, t),
    fov: () => 40,
    followY: 0.12,
    shakeM: 0.025,
  },
  prepare(w) {
    w.offline.setSun(HEADING + 180 - 35, 2.2);
    tightShadows(w, 14, 4096);
    w.offline.skyLight.intensity = 0.05; // no air: shadows on the Moon are nearly black
  },
  setup({ w, track }) {
    const o = w.offline;
    const h = w.data.tuning.rover;
    const groundAt = (x: number, z: number) => w.scene.terrain.heightAt(x, z);
    // The game's floodlight (one SpotLight at the front): a wider, softer pool that fades with distance instead of
    // ending in a hard edge, casting shadows (rocks throw long shadows into the dark). Moved just ahead of the drill
    // tower, so the tower does not shadow the middle of the pool.
    const lamp = o.lamp!;
    Object.assign(lamp, { angle: 0.8, penumbra: 1, decay: 1.3, distance: 80 });
    lamp.position.x += 0.32;
    lamp.target.position.x += 0.32;
    lamp.castShadow = true;
    lamp.shadow.camera.layers.set(ROCK_LAYER); // only the rocks shadow the floodlight (not the rover's own parts)
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 0.2;
    lamp.shadow.camera.far = 70;
    lamp.shadow.bias = -0.0004;
    lamp.shadow.normalBias = 0.02;
    lamp.shadow.radius = 2;
    const rocks = new Rocks(o, track, groundAt, { from: -0.5, to: DURATION, count: 1800, halfWidthM: 14, aheadM: 30, color: 0x8e8a83, sizeM: [0.025, 0.3], layer: ROCK_LAYER, sunLine: new THREE.Vector4(DIR.x, DIR.z, -(TERMINATOR.x * DIR.x + TERMINATOR.z * DIR.z) - 4, 2.5) });
    const light = new RoverLight(o.rover.object);
    const lamps = lampRig(h, { color: LAMP_COLOR, intensity: 40, angleRad: 0.55, penumbra: 0.5, rangeM: 45, dropM: 1.2, toeOutDeg: 4 });
    const glow = new LampGlow(lamps, LAMP_COLOR, 0.32);
    const dust = new WheelDust(track, groundAt, lamps, {
      rate: 900,
      fullSpeed: 9,
      gravity: MOON_G,
      drag: 0,
      wind: [0, 0, 0],
      up: [0.3, 1.5],
      keep: [0.55, 0.95],
      spread: 0.35,
      size: [0.004, 0.012],
      life: [0.7, 1.3],
      albedo: 0x9a968e,
      opacity: 0.85,
      lampGain: 0.25,
      wheelBase: h.wheelBaseM,
      wheelTrack: h.wheelTrackM,
      rideHeight: 0,
      from: -1.5,
      to: DURATION + 0.1,
    });
    o.scene.add(glow.object, dust.object, rocks.object);
    const fwd = new THREE.Vector3();
    const rimDir = new THREE.Vector3();
    const rim = new THREE.Color();
    const bounce = new THREE.Color();
    const fill = new THREE.Color();
    const fillDir = new THREE.Vector3();
    const snap = ACT3_CUES.floodlights.t;
    const sunColor = new THREE.Color();
    const ambient = new THREE.Color(0.004, 0.004, 0.005);
    const sTerm = TERMINATOR.x * DIR.x + TERMINATOR.z * DIR.z;
    const shadowLine = new THREE.Vector4(DIR.x, DIR.z, -sTerm, 1.5); // the Sun reaches grains short of the crest's shadow
    const mid = new THREE.Vector3();
    return {
      update(_f, t) {
        // The floodlights strike: a hard snap with a quick stutter, settling at full.
        const a = t - snap;
        const k = a < 0 ? 0 : a < 0.035 ? 1.15 : a < 0.07 ? 0.35 : a < 0.11 ? 1.05 : 1;
        o.setLamp(0.5 * k);
        // Light on the rover: while the regolith around it is sunlit, a bounce from below; in the dark, the pool of
        // floodlight ahead throws light back onto its front edges (a rim from ahead and above), with a little bounce,
        // and a faint cool fill from behind (Earthshine) keeps the shapes.
        o.rover.forward(fwd);
        fwd.y = 0;
        fwd.normalize();
        const sunGround = 1 - smoothstep(0.9, 1.4, t);
        rimDir.set(fwd.x * 0.9 + fwd.z * 0.45, 0.75, fwd.z * 0.9 - fwd.x * 0.45);
        rim.setRGB(1, 0.97, 0.92).multiplyScalar(2.2 * k);
        bounce.setRGB(0.9, 0.88, 0.85).multiplyScalar(0.55 * sunGround + 0.35 * k);
        fillDir.set(-fwd.x, 0.5, -fwd.z);
        fill.setRGB(0.55, 0.65, 0.85).multiplyScalar(0.3);
        light.set({ rimDir, rim, bounce, fillDir, fill });
        lamps.update(o.rover.object, k);
        glow.update(k, 1.0);
        // A flare streak at the snap, from between the housings.
        mid.copy(lamps.positions[0]!).add(lamps.positions[1]!).multiplyScalar(0.5).project(o.camera);
        const flare = a < 0 ? 0 : 0.25 + 1.1 * Math.exp(-a * 8);
        return {
          exposure: 1.0,
          contrast: 1.12,
          saturation: 0.92,
          tint: [0.98, 1.0, 1.03],
          lift: 0.0,
          bloomStrength: 0.4,
          bloomThreshold: 1.0,
          vignette: 0.35,
          flare: flare > 0 ? { x: mid.x, y: mid.y, intensity: flare, color: [1, 0.97, 0.9] } : null,
        };
      },
      afterView(_f, t) {
        sunColor.copy(o.sunLight.color).multiplyScalar(o.sunLight.intensity * 0.35);
        dust.update(t, { sun: sunColor, ambient, shadowLine });
      },
      dispose() {
        glow.dispose();
        dust.dispose();
        rocks.dispose();
      },
    };
  },
});
