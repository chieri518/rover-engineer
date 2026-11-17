// Act 3 · Mars: Jezero crater floor, driving west toward the delta front (the game's Delta viewpoint), while a
// regional dust storm rolls in ahead: a towering wall of dust advances over the floor, dust streams along the
// ground toward the rover, and the light goes brown (the game's own storm look, eased up over the shot).
import * as THREE from 'three';
import { ACT3_SHOTS } from './timing';
import { chaseClip, tightShadows } from './chase';
import { smoothstep } from '../lib/ease';
import { DustStorm } from './fx/storm';
import { WheelDust } from './fx/wheelDust';

const HEADING = 270; // west, toward the delta front
const START = { x: -160, z: -1270 };
const DURATION = ACT3_SHOTS.mars.reduce((a, s) => a + s.duration, 0);
/** Gap between the rover and the storm front (m), from the shot start to its end. */
const GAP = { from: 460, to: 210 };

/** Remove the game's own storm dust (point sprites) from the scene: the clip draws its own. */
function removeGameDust(scene: THREE.Scene): void {
  const found: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.Points && (o.material as THREE.ShaderMaterial).uniforms?.puffM) found.push(o);
  });
  for (const o of found) o.removeFromParent();
}

export const marsClip = chaseClip({
  id: 'mars-chase',
  world: 'mars',
  shots: ACT3_SHOTS.mars,
  start: { ...START, headingDeg: HEADING },
  lead: 2.5,
  drive: () => ({ throttle: 0.5, steer: 0, brake: false }),
  framing: {
    distance: () => 6.2,
    height: () => 1.4,
    lookAhead: () => 10,
    lookHeight: () => 2.1,
    fov: () => 42,
    followY: 0.12,
  },
  prepare(w) {
    w.offline.setSun(150, 14);
    tightShadows(w, 14, 4096, 2);
  },
  setup({ w, track }) {
    const o = w.offline;
    removeGameDust(o.scene);
    const p0 = track.position(0, new THREE.Vector3());
    const p1 = track.position(DURATION, new THREE.Vector3());
    const groundY = w.scene.terrain.heightAt(p0.x, p0.z);
    // The storm travels east (+x), toward the rover. Its front closes from GAP.from to GAP.to ahead of the rover.
    const heightAt = (x: number, z: number) => w.scene.terrain.heightAt(x, z);
    const storm = new DustStorm({
      windDir: { x: 1, z: 0 },
      windSpeed: 18,
      groundY,
      wallTop: 150,
      ground: { heightAt, centerX: p0.x - 300, centerZ: p0.z, sizeM: 1400, cellM: 5 },
    });
    // Wheel dust: fine Mars dust kicked up by the wheels and carried off by the storm's wind (toward the camera).
    const h = w.data.tuning.rover;
    const dust = new WheelDust(track, heightAt, null, {
      rate: 700,
      fullSpeed: 8,
      gravity: 3.71,
      drag: 1.6,
      wind: [9, 0, 0],
      up: [0.3, 1.8],
      keep: [0.3, 0.9],
      spread: 0.5,
      size: [0.02, 0.07],
      life: [1.0, 2.2],
      albedo: 0x7a5a44,
      opacity: 0.22,
      growth: 2.2,
      lampGain: 0,
      wheelBase: h.wheelBaseM,
      wheelTrack: h.wheelTrackM,
      rideHeight: 0,
      from: -2,
      to: DURATION + 0.1,
    });
    o.scene.add(storm.object, dust.object);
    const dustAmbient = new THREE.Color();
    const dustSun = new THREE.Color();
    const frontAt = (t: number) => {
      const k = t / DURATION;
      return p0.x + (p1.x - p0.x) * k - (GAP.from + (GAP.to - GAP.from) * k);
    };
    const sunDir = new THREE.Vector3();
    const sun = new THREE.Color();
    const hemi = o.skyLight as THREE.HemisphereLight;
    let k = 0;
    return {
      update(_f, t) {
        k = smoothstep(-0.5, DURATION + 0.3, t);
        o.holdStorm(0.12 + 0.7 * k);
        return {
          exposure: 1.05,
          contrast: 1.06,
          saturation: 1.0 - 0.15 * k,
          tint: [1.0, 0.97 - 0.03 * k, 0.92 - 0.08 * k],
          lift: 0.012 + 0.02 * k,
          liftColor: [1, 0.72, 0.5],
          bloomStrength: 0.25,
          vignette: 0.3 + 0.1 * k,
        };
      },
      afterView(_f, t) {
        sunDir.copy(o.sunLight.position).sub(o.sunLight.target.position).normalize();
        sun.copy(o.sunLight.color).multiplyScalar(o.sunLight.intensity);
        dustAmbient.copy(hemi.color).multiplyScalar(0.8);
        dust.update(t, { sun: dustSun.copy(sun).multiplyScalar(0.6), ambient: dustAmbient });
        storm.update(o.camera, t, { frontS: frontAt(t), groundDust: 0.02 + 0.12 * k, airDust: 0.0015 * k, wallDensity: 0.06 }, { sunDir, sun, sky: hemi.color, bounce: hemi.groundColor });
      },
      dispose() {
        storm.dispose();
        dust.dispose();
      },
    };
  },
});
