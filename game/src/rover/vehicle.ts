// The rover: a Rapier ray-cast vehicle (box body, four wheels) with a model shaped by its parts (roverModel.ts).
// Per-build inputs (mass, top speed, grip) come in as RoverParams, built from the parts by
// rules/drive.ts; handling shared by every build comes from tuning.rover.
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { RoverParams } from '../rules/drive';
import type { Part, RoverHandling } from '../rules/types';
import { buildRoverModel, roverLook } from './roverModel';

type Rapier = typeof RAPIER;

export interface DriveInput {
  throttle: number; // −1 (reverse) .. 1 (forward)
  steer: number; // −1 (right) .. 1 (left)
  brake: boolean;
}

const DEG = Math.PI / 180;
const SPEED_BAND = 0.25; // m/s: engine force fades in over this much speed error
const UP = new THREE.Vector3(0, 1, 0);

/** Chassis frame: forward +x, up +y, right +z (Rapier's default vehicle axes). */
export class RoverVehicle {
  readonly object = new THREE.Group();
  private readonly body: RAPIER.RigidBody;
  private readonly controller: RAPIER.DynamicRayCastVehicleController;
  private readonly wheels: THREE.Object3D[] = [];
  private readonly wheelSpin: THREE.Object3D[] = [];
  private readonly collider: RAPIER.Collider;
  private readonly connectY: number;
  private modelObjects: THREE.Object3D[] = []; // the model's own children of `object` (floodlights etc. stay)
  private steer = 0;
  private input: DriveInput = { throttle: 0, steer: 0, brake: false };
  /** Multiplies the top speed (development shortcut only). */
  speedBoost = 1;
  /** Multiplies the top speed: soft ground and wheel slip slow the rover (set by the mission systems). */
  speedFactor = 1;
  /** Extra downward acceleration applied in the last update while wheels were off the ground (m/s²). */
  airDownAccel = 0;
  private readonly gravity: number;

  constructor(
    private readonly world: RAPIER.World,
    rapier: Rapier,
    private params: RoverParams,
    private readonly handling: RoverHandling,
    start: { x: number; y: number; z: number; headingDeg: number },
    parts: Part[] = [],
  ) {
    const h = handling;
    this.gravity = -world.gravity.y;
    const { lengthM: l, widthM: w, heightM: ht } = h.body;
    this.connectY = -ht / 2 + 0.12;
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setAngularDamping(h.angularDamping)
        .setGravityScale(h.gravityScale)
        .setCanSleep(false),
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.cuboid(l / 2, ht / 2, w / 2)
        .setMassProperties(...this.massProperties(params.massKg))
        .setFriction(0.6),
      this.body,
    );

    this.controller = world.createVehicleController(this.body);
    const connectY = this.connectY;
    const corners: [number, number][] = [
      [h.wheelBaseM / 2, h.wheelTrackM / 2],
      [h.wheelBaseM / 2, -h.wheelTrackM / 2],
      [-h.wheelBaseM / 2, h.wheelTrackM / 2],
      [-h.wheelBaseM / 2, -h.wheelTrackM / 2],
    ];
    corners.forEach(([x, z]) => {
      this.controller.addWheel({ x, y: connectY, z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, h.suspension.restLengthM, h.wheelRadiusM);
    });
    this.applyHandling();
    this.setParams(params);
    this.buildModel(connectY, parts);
    this.teleport(start.x, start.y, start.z, start.headingDeg);
  }

  /** Apply the shared handling (suspension, gravity scale). Called once; again after a development retune. */
  applyHandling(): void {
    const h = this.handling;
    this.body.setGravityScale(h.gravityScale, true);
    this.body.setAngularDamping(h.angularDamping);
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelSuspensionRestLength(i, h.suspension.restLengthM);
      this.controller.setWheelSuspensionStiffness(i, h.suspension.stiffness);
      this.controller.setWheelSuspensionCompression(i, h.suspension.compression);
      this.controller.setWheelSuspensionRelaxation(i, h.suspension.relaxation);
      this.controller.setWheelMaxSuspensionTravel(i, h.suspension.maxTravelM);
      this.controller.setWheelMaxSuspensionForce(i, 1e6);
      this.controller.setWheelSideFrictionStiffness(i, h.sideFrictionStiffness);
    }
  }

  private massProperties(m: number): [number, { x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number; w: number }] {
    const h = this.handling;
    const { lengthM: l, widthM: w, heightM: ht } = h.body;
    return [
      m,
      { x: 0, y: -h.centerOfMassDropM, z: 0 },
      { x: (m * (ht * ht + w * w)) / 12, y: (m * (l * l + w * w)) / 12, z: (m * (l * l + ht * ht)) / 12 },
      { x: 0, y: 0, z: 0, w: 1 },
    ];
  }

  /** Change the build at runtime (e.g. a deployed instrument leaves the rover): new mass, speed and grip, and a model of the remaining parts. */
  setBuild(params: RoverParams, parts: Part[]): void {
    this.setParams(params);
    this.collider.setMassProperties(...this.massProperties(params.massKg));
    this.disposeModel();
    this.buildModel(this.connectY, parts);
    this.sync();
  }

  /** Change the per-build inputs (Phase 3: from the selected parts). */
  setParams(params: RoverParams): void {
    this.params = params;
    for (let i = 0; i < 4; i++) this.controller.setWheelFrictionSlip(i, params.grip * this.handling.gripToFrictionSlip);
  }

  setInput(input: DriveInput): void {
    this.input = input;
  }

  /** Place the rover upright on the ground at (x, groundY, z), facing an azimuth (terrain.json convention). */
  teleport(x: number, groundY: number, z: number, headingDeg: number): void {
    const h = this.handling;
    const rideHeight = h.body.heightM / 2 - 0.12 + h.suspension.restLengthM + h.wheelRadiusM;
    // Chassis forward is +x; azimuth az points along (sin az, 0, −cos az): yaw = 90° − az.
    const q = new THREE.Quaternion().setFromAxisAngle(UP, (90 - headingDeg) * DEG);
    this.body.setTranslation({ x, y: groundY + rideHeight + 0.05, z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.sync();
  }

  /** Signed forward speed in m/s. */
  get speed(): number {
    return this.controller.currentVehicleSpeed();
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  /** Linear velocity of the body in m/s. */
  velocity(target = new THREE.Vector3()): THREE.Vector3 {
    const v = this.body.linvel();
    return target.set(v.x, v.y, v.z);
  }

  /** Unit up vector of the chassis in the world. */
  up(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(0, 1, 0).applyQuaternion(this.object.quaternion);
  }

  /** Slow the body by a factor (0..1 kept per call): a hard stop the drive brakes alone cannot make downhill. */
  damp(keep: number): void {
    const v = this.body.linvel();
    this.body.setLinvel({ x: v.x * keep, y: v.y, z: v.z * keep }, true);
  }

  /** Roll the rover about its forward axis (development helper for testing rollover). */
  tipOver(rollDeg: number): void {
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rollDeg * DEG));
    const t = this.body.translation();
    this.body.setTranslation({ x: t.x, y: t.y + 1, z: t.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.sync();
  }

  /** How many wheels touch the ground. */
  get wheelsInContact(): number {
    let n = 0;
    for (let i = 0; i < 4; i++) if (this.controller.wheelIsInContact(i)) n++;
    return n;
  }

  /** Unit forward vector in the world (the chassis +x). */
  forward(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(1, 0, 0).applyQuaternion(this.object.quaternion);
  }

  /** Apply the driver's input and run the vehicle controller. Call before each world.step(). */
  update(dt: number): void {
    const h = this.handling;
    const { throttle, steer, brake } = this.input;
    const v = this.speed;
    const m = this.params.massKg;
    const top = this.params.topSpeed * this.speedBoost * this.speedFactor;

    let engine = 0;
    let brakeForce = 0;
    const reversingDirection = throttle !== 0 && Math.sign(throttle) !== Math.sign(v) && Math.abs(v) > 0.3;
    if (brake || reversingDirection) {
      brakeForce = m * h.brakeDecelMps2;
    } else if (throttle !== 0) {
      const target = throttle > 0 ? top * throttle : top * h.reverseSpeedFactor * throttle;
      const err = Math.max(-1, Math.min(1, (target - v) / SPEED_BAND));
      engine = m * h.accelerationMps2 * err;
      // Downhill the drive motors hold the rover at its top speed instead of letting it run away.
      const over = Math.abs(v) - Math.abs(target);
      if (over > 0 && Math.sign(v) === Math.sign(target)) brakeForce = m * h.brakeDecelMps2 * Math.min(1, over / SPEED_BAND);
    } else {
      brakeForce = m * h.brakeDecelMps2; // no input: the drive motors hold the rover
    }

    // Steer toward the input. At speed the lock shrinks so a full turn stays within the lateral
    // acceleration limit (turn radius ≈ wheelbase / tan(steer), lateral acceleration = v² / radius).
    const maxSteer = Math.min(h.maxSteerDeg * DEG, Math.atan((h.wheelBaseM * h.maxLateralAccelMps2) / Math.max(v * v, 1e-6)));
    const targetSteer = steer * maxSteer;
    const rate = h.steerRateDegPerSecond * DEG * dt;
    this.steer += Math.max(-rate, Math.min(rate, targetSteer - this.steer));

    // Wheels off the ground: pull the body down harder, so a hop over a bump stays as short as it would
    // be for a real rover at real speed (time runs ×4, so a true time-lapse scales accelerations by ×16).
    // On the ground gravity stays at gravityScale, so slopes, grip and climbing are unchanged.
    const off = 4 - this.wheelsInContact; // contacts from the last controller update
    this.airDownAccel = Math.max(0, (h.airGravityScale - h.gravityScale) * this.gravity * (off / 4));
    if (this.airDownAccel > 0) this.body.applyImpulse({ x: 0, y: -m * this.airDownAccel * dt, z: 0 }, true);

    for (let i = 0; i < 4; i++) {
      this.controller.setWheelEngineForce(i, engine / 4);
      // Rapier's brake is a per-step impulse limit.
      this.controller.setWheelBrake(i, (brakeForce / 4) * dt);
    }
    this.controller.setWheelSteering(0, this.steer);
    this.controller.setWheelSteering(1, this.steer);
    this.controller.updateVehicle(dt);
  }

  /** Copy the physics state to the model. Call after world.step(). */
  sync(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.object.position.set(t.x, t.y, t.z);
    this.object.quaternion.set(r.x, r.y, r.z, r.w);
    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i]!;
      const conn = this.controller.wheelChassisConnectionPointCs(i);
      const len = this.controller.wheelSuspensionLength(i) ?? this.handling.suspension.restLengthM;
      if (conn) wheel.position.set(conn.x, conn.y - len, conn.z);
      wheel.rotation.y = this.controller.wheelSteering(i) ?? 0;
      this.wheelSpin[i]!.rotation.z = -(this.controller.wheelRotation(i) ?? 0);
    }
  }

  private buildModel(connectY: number, parts: Part[]): void {
    const model = buildRoverModel(this.handling, connectY, roverLook(parts));
    this.object.add(model.body);
    this.modelObjects = [model.body];
    for (const { wheel, spin } of model.wheels) {
      this.object.add(wheel);
      this.modelObjects.push(wheel);
      this.wheels.push(wheel);
      this.wheelSpin.push(spin);
    }
  }

  /** Remove the model's meshes (not the floodlights) and free them. */
  private disposeModel(): void {
    for (const obj of this.modelObjects) {
      obj.removeFromParent();
      freeObject(obj);
    }
    this.modelObjects = [];
    this.wheels.length = 0;
    this.wheelSpin.length = 0;
  }

  dispose(): void {
    this.world.removeRigidBody(this.body);
    freeObject(this.object);
  }
}

function freeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.MeshLambertMaterial>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      geometries.add(obj.geometry);
      materials.add(obj.material as THREE.MeshLambertMaterial);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
}
