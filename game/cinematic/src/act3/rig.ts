// The chase camera for Act 3, purely a function of time: behind and a little above the rover, following a smoothed
// copy of its recorded track (critically damped, so it lags gently through bumps and turns), with a soft handheld
// sway. Everything is precomputed per physics step and read back with Catmull-Rom interpolation, so sub-frames move
// smoothly.
import * as THREE from 'three';
import { shake } from '../lib/ease';
import { STEP, type DriveTrack } from './track';

export interface ChaseFraming {
  /** Metres behind the rover (along its smoothed heading), above it, and to its side (+: right of the heading). */
  distance: (t: number) => number;
  height: (t: number) => number;
  side?: (t: number) => number;
  /** Look target: metres ahead of the rover and above its body centre. */
  lookAhead: (t: number) => number;
  lookHeight: (t: number) => number;
  /** Vertical field of view (deg). */
  fov: (t: number) => number;
  /** Handheld sway: position (m) and angle (deg) amplitudes. */
  shakeM?: number;
  shakeDeg?: number;
  seed?: number;
  /** Time constants (s) of the critically damped follow: position across the ground, height, heading. */
  followXZ?: number;
  followY?: number;
  followHeading?: number;
  /** Lowest camera height above the ground (m). */
  clearance?: number;
}

/** Two cascaded one-pole filters (a critically damped response) over a strided series, in place into `out`. */
function damp(src: Float32Array, out: Float32Array, stride: number, comp: number, tc: number, n: number) {
  const a = 1 - Math.exp(-STEP / Math.max(tc, 1e-4));
  let s1 = src[comp]!;
  let s2 = s1;
  for (let i = 0; i < n; i++) {
    const v = src[i * stride + comp]!;
    s1 += (v - s1) * a;
    s2 += (s1 - s2) * a;
    out[i * stride + comp] = s2;
  }
}

function catmull(arr: Float32Array, stride: number, comp: number, i: number, k: number, n: number): number {
  const g = (j: number) => arr[Math.min(n - 1, Math.max(0, j)) * stride + comp]!;
  const p0 = g(i - 1);
  const p1 = g(i);
  const p2 = g(i + 1);
  const p3 = g(i + 2);
  const k2 = k * k;
  const k3 = k2 * k;
  return 0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3);
}

export interface ChaseRig {
  /** Place the camera for shot time t (and set its fov). */
  place(t: number, camera: THREE.PerspectiveCamera): void;
  /** The smoothed heading (unit, horizontal) at time t. */
  heading(t: number, out: THREE.Vector3): THREE.Vector3;
}

export function chaseRig(track: DriveTrack, groundAt: (x: number, z: number) => number, f: ChaseFraming): ChaseRig {
  const n = track.steps;
  // Heading: the chassis forward, flattened.
  const fwdRaw = new Float32Array(n * 3);
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    q.fromArray(track.quat, i * 4);
    v.set(1, 0, 0).applyQuaternion(q);
    v.y = 0;
    v.normalize();
    fwdRaw.set([v.x, 0, v.z], i * 3);
  }
  const pos = new Float32Array(n * 3);
  const fwd = new Float32Array(n * 3);
  damp(track.pos, pos, 3, 0, f.followXZ ?? 0.06, n);
  damp(track.pos, pos, 3, 1, f.followY ?? 0.3, n);
  damp(track.pos, pos, 3, 2, f.followXZ ?? 0.06, n);
  damp(fwdRaw, fwd, 3, 0, f.followHeading ?? 0.45, n);
  damp(fwdRaw, fwd, 3, 2, f.followHeading ?? 0.45, n);

  const at = (t: number): [number, number] => {
    const s = Math.min(n - 1.0001, Math.max(0, (t + track.lead) / STEP));
    const i = Math.floor(s);
    return [i, s - i];
  };
  const anchor = new THREE.Vector3();
  const head = new THREE.Vector3();
  const right = new THREE.Vector3();
  const look = new THREE.Vector3();
  const seed = f.seed ?? 11;
  const heading = (t: number, out: THREE.Vector3) => {
    const [i, k] = at(t);
    out.set(catmull(fwd, 3, 0, i, k, n), 0, catmull(fwd, 3, 2, i, k, n));
    return out.normalize();
  };
  return {
    heading,
    place(t, camera) {
      const [i, k] = at(t);
      anchor.set(catmull(pos, 3, 0, i, k, n), catmull(pos, 3, 1, i, k, n), catmull(pos, 3, 2, i, k, n));
      heading(t, head);
      right.set(-head.z, 0, head.x);
      const d = f.distance(t);
      const side = f.side?.(t) ?? 0;
      const sm = f.shakeM ?? 0.03;
      camera.position
        .copy(anchor)
        .addScaledVector(head, -d)
        .addScaledVector(right, side + shake(t, seed, 0.9) * sm);
      camera.position.y += f.height(t) + shake(t, seed + 1, 0.8) * sm;
      // Keep above the ground (a soft floor, so the camera never kinks).
      const floor = groundAt(camera.position.x, camera.position.z) + (f.clearance ?? 0.45);
      const below = floor - camera.position.y;
      camera.position.y += below <= -0.3 ? 0 : below < 0.3 ? ((below + 0.3) * (below + 0.3)) / 1.2 : below;
      look.copy(anchor).addScaledVector(head, f.lookAhead(t));
      look.y += f.lookHeight(t);
      camera.lookAt(look);
      const sd = ((f.shakeDeg ?? 0.25) * Math.PI) / 180;
      camera.rotateX(shake(t, seed + 2, 0.7) * sd);
      camera.rotateY(shake(t, seed + 3, 0.6) * sd);
      camera.rotateZ(shake(t, seed + 4, 0.5) * sd * 0.6);
      camera.fov = f.fov(t);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    },
  };
}
