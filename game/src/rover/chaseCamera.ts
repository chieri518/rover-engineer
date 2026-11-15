// Chase camera: behind and above the rover, following its heading (not its pitch or roll), smoothed.
import * as THREE from 'three';

const DISTANCE_M = 7;
const HEIGHT_M = 2.6;
const LOOK_AHEAD_M = 3;
const LOOK_HEIGHT_M = 0.8;
const FOLLOW_RATE = 3; // per second: higher = stiffer follow
const MIN_CLEARANCE_M = 0.8;

export class ChaseCamera {
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpWant = new THREE.Vector3();
  private readonly tmpLook = new THREE.Vector3();

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly groundAt: (x: number, z: number) => number,
  ) {}

  /** Jump straight to the rover (after a teleport). */
  reset(): void {
    this.initialized = false;
  }

  update(dt: number, roverPos: THREE.Vector3, roverForward: THREE.Vector3): void {
    const f = this.tmpForward.set(roverForward.x, 0, roverForward.z);
    if (f.lengthSq() < 1e-6) f.set(1, 0, 0);
    f.normalize();
    const want = this.tmpWant.copy(roverPos).addScaledVector(f, -DISTANCE_M);
    want.y += HEIGHT_M;
    const lookAt = this.tmpLook.copy(roverPos).addScaledVector(f, LOOK_AHEAD_M);
    lookAt.y += LOOK_HEIGHT_M;

    if (!this.initialized) {
      this.pos.copy(want);
      this.look.copy(lookAt);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      this.pos.lerp(want, k);
      this.look.lerp(lookAt, Math.min(1, k * 2));
    }
    const ground = this.groundAt(this.pos.x, this.pos.z) + MIN_CLEARANCE_M;
    if (this.pos.y < ground) this.pos.y = ground;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
