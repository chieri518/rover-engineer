// A pre-simulated drive. The game's physics steps at 1/60 s, but the film samples time every 1/960 s (motion-blur
// sub-frames): stepping physics per sub-frame would move the rover in 1/60 s jumps. So the whole drive runs once at
// load (fixed steps, scripted input, deterministic) and records the body and wheel transforms per step; at render
// time the rover is posed by interpolating those records at the exact sub-frame time.
import * as THREE from 'three';
import type { MoonOfflineScene } from '../../../src/world/moonScene';
import type { DriveInput, RoverVehicle } from '../../../src/rover/vehicle';

export const STEP = 1 / 60;

/** The vehicle's wheel objects (private in RoverVehicle; read here only to record and replay their transforms). */
interface WheelAccess {
  wheels: THREE.Object3D[];
  wheelSpin: THREE.Object3D[];
}

export interface DriveTrack {
  /** Seconds of track before shot time 0 (the run-up). */
  lead: number;
  /** Track length in steps. */
  steps: number;
  /** Pose the rover (body and wheels) at shot time t (s; may be negative down to -lead). */
  pose(t: number): void;
  /** Interpolated body position and forward (chassis +x) at shot time t. */
  position(t: number, out: THREE.Vector3): THREE.Vector3;
  forward(t: number, out: THREE.Vector3): THREE.Vector3;
  /** Signed forward speed (m/s) at shot time t. */
  speed(t: number): number;
  /** Raw recorded body positions (x, y, z per step), for camera smoothing. */
  readonly pos: Float32Array;
  readonly quat: Float32Array;
}

/**
 * Teleport the rover, settle it, then drive `seconds` of track with `input(t)` (t: shot time, from -lead) and record
 * every step. After this the rover's own physics sync is disabled: the track poses it.
 */
export function recordDrive(
  o: MoonOfflineScene,
  start: { x: number; z: number; headingDeg: number },
  lead: number,
  seconds: number,
  input: (t: number) => DriveInput,
  opts: { speedBoost?: number; settle?: number } = {},
): DriveTrack {
  const rover: RoverVehicle = o.rover;
  const w = rover as unknown as WheelAccess;
  o.teleport(start.x, start.z, start.headingDeg);
  rover.speedBoost = opts.speedBoost ?? 1;
  // A hair over one physics step per call, so the scene's accumulator never rounds a step away.
  const dt = STEP * (1 + 1e-6);
  const settleSteps = Math.round((opts.settle ?? 0.6) / STEP);
  for (let i = 0; i < settleSteps; i++) o.stepPhysics(dt, { throttle: 0, steer: 0, brake: true });
  const steps = Math.ceil((lead + seconds) / STEP) + 3;
  const pos = new Float32Array(steps * 3);
  const quat = new Float32Array(steps * 4);
  const wheel = new Float32Array(steps * 4 * 3); // suspension y, steer, spin per wheel
  const wheelXZ = new Float32Array(4 * 2);
  const speed = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    if (i > 0) o.stepPhysics(dt, input(i * STEP - lead));
    rover.sync();
    const p = rover.object.position;
    const q = rover.object.quaternion;
    pos.set([p.x, p.y, p.z], i * 3);
    quat.set([q.x, q.y, q.z, q.w], i * 4);
    for (let k = 0; k < 4; k++) {
      // Spin angles are unwrapped, so interpolating between steps never takes the long way round.
      let spin = w.wheelSpin[k]!.rotation.z;
      if (i > 0) {
        const prev = wheel[((i - 1) * 4 + k) * 3 + 2]!;
        spin = prev + Math.atan2(Math.sin(spin - prev), Math.cos(spin - prev));
      }
      wheel.set([w.wheels[k]!.position.y, w.wheels[k]!.rotation.y, spin], (i * 4 + k) * 3);
      if (i === 0) wheelXZ.set([w.wheels[k]!.position.x, w.wheels[k]!.position.z], k * 2);
    }
    speed[i] = rover.speed;
  }
  // From here on the track poses the rover; updateView() calls sync(), which must not pull it back to the body.
  rover.sync = () => {};

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const at = (t: number): [number, number] => {
    const s = Math.min(steps - 1.0001, Math.max(0, (t + lead) / STEP));
    const i = Math.floor(s);
    return [i, s - i];
  };
  const lerpQuat = (i: number, k: number, out: THREE.Quaternion) => {
    qa.fromArray(quat, i * 4);
    qb.fromArray(quat, (i + 1) * 4);
    return out.copy(qa).slerp(qb, k);
  };
  const track: DriveTrack = {
    lead,
    steps,
    pos,
    quat,
    pose(t) {
      const [i, k] = at(t);
      const obj = rover.object;
      obj.position.set(
        pos[i * 3]! + (pos[i * 3 + 3]! - pos[i * 3]!) * k,
        pos[i * 3 + 1]! + (pos[i * 3 + 4]! - pos[i * 3 + 1]!) * k,
        pos[i * 3 + 2]! + (pos[i * 3 + 5]! - pos[i * 3 + 2]!) * k,
      );
      lerpQuat(i, k, obj.quaternion);
      for (let n = 0; n < 4; n++) {
        const a = (i * 4 + n) * 3;
        const b = ((i + 1) * 4 + n) * 3;
        const wh = w.wheels[n]!;
        wh.position.set(wheelXZ[n * 2]!, wheel[a]! + (wheel[b]! - wheel[a]!) * k, wheelXZ[n * 2 + 1]!);
        wh.rotation.y = wheel[a + 1]! + (wheel[b + 1]! - wheel[a + 1]!) * k;
        w.wheelSpin[n]!.rotation.z = wheel[a + 2]! + (wheel[b + 2]! - wheel[a + 2]!) * k;
      }
      obj.updateMatrixWorld(true);
    },
    position(t, out) {
      const [i, k] = at(t);
      return out.set(
        pos[i * 3]! + (pos[i * 3 + 3]! - pos[i * 3]!) * k,
        pos[i * 3 + 1]! + (pos[i * 3 + 4]! - pos[i * 3 + 1]!) * k,
        pos[i * 3 + 2]! + (pos[i * 3 + 5]! - pos[i * 3 + 2]!) * k,
      );
    },
    forward(t, out) {
      const [i, k] = at(t);
      return out.set(1, 0, 0).applyQuaternion(lerpQuat(i, k, qa.clone()));
    },
    speed(t) {
      const [i, k] = at(t);
      return speed[i]! + (speed[i + 1]! - speed[i]!) * k;
    },
  };
  return track;
}
