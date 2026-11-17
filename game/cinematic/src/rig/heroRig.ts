// The hero rover as an animatable rig (Act 2's wake-up and first drive): the game's model built with its
// opt-in rig (roverModel.ts `rig`), dressed for the film (dress.ts), and posed kinematically: placed on any
// ground function with pitch, roll and per-wheel suspension, wheels rolled by distance, the solar mast
// folded or raised, the camera mast telescoped, the head panned and tilted. No physics: every pose follows
// from the numbers given, so motion blur sub-frames stay smooth.
import * as THREE from 'three';
import { buildRoverModel, roverLook, type RoverRig } from '../../../src/rover/roverModel';
import type { GameData, RoverHandling } from '../../../src/rules/types';
import type { MoonOfflineScene } from '../../../src/world/moonScene';
import { heroRover } from '../lib/heroRover';
import { dressRover, type RoverDress } from './dress';

export interface HeroPose {
  /** Solar mast: 0 folded back flat over the rear deck, 1 upright. */
  panel: number;
  /** Camera mast: 0 retracted into its sleeve, 1 fully raised. */
  mast: number;
  /** Camera head pan about the mast (rad, + turns the lenses toward the rover's left, -z). */
  pan: number;
  /** Camera head tilt (rad, + looks up). */
  tilt: number;
}

export const STOWED: HeroPose = { panel: 0, mast: 0, pan: 1.35, tilt: -0.5 };
export const DEPLOYED: HeroPose = { panel: 1, mast: 1, pan: 0, tilt: 0 };

/** A ground height function (world x, z → y). */
export type GroundFn = (x: number, z: number) => number;

export class HeroRover {
  /** Chassis frame: forward +x, up +y, right +z (as the game's RoverVehicle). */
  readonly object = new THREE.Group();
  readonly wheels: { wheel: THREE.Object3D; spin: THREE.Object3D; corner: THREE.Vector3 }[] = [];
  readonly rig: RoverRig;
  readonly dress: RoverDress;
  readonly handling: RoverHandling;
  private readonly connectY: number;
  private readonly mastTravel = 0.53;
  /** Body centre above the ground with the suspension at rest. */
  readonly rideHeight: number;

  constructor(data: GameData, opts: { offline?: MoonOfflineScene; envMap?: THREE.Texture | null } = {}) {
    const h = (this.handling = data.tuning.rover);
    const hero = heroRover(data);
    this.connectY = -h.body.heightM / 2 + 0.12;
    this.rideHeight = h.body.heightM / 2 - 0.12 + h.suspension.restLengthM + h.wheelRadiusM;
    const model = buildRoverModel(h, this.connectY, roverLook(hero.parts), { rig: true });
    this.rig = model.rig ?? {};
    this.object.add(model.body);
    const corners: [number, number][] = [
      [h.wheelBaseM / 2, h.wheelTrackM / 2],
      [h.wheelBaseM / 2, -h.wheelTrackM / 2],
      [-h.wheelBaseM / 2, h.wheelTrackM / 2],
      [-h.wheelBaseM / 2, -h.wheelTrackM / 2],
    ];
    model.wheels.forEach(({ wheel, spin }, i) => {
      const [x, z] = corners[i]!;
      wheel.position.set(x, this.connectY - h.suspension.restLengthM, z);
      this.object.add(wheel);
      this.wheels.push({ wheel, spin, corner: new THREE.Vector3(x, this.connectY, z) });
    });
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.receiveShadow = true;
    });
    this.dress = dressRover(this.object, { handling: h, offline: opts.offline, envMap: opts.envMap });
    // The eye: a glowing aperture ring inside each stereo lens and the centre lens, behind dark glass.
    const tilt = this.rig.cameraTilt;
    if (tilt) {
      const ring = new THREE.RingGeometry(0.0085, 0.0158, 48).rotateY(Math.PI / 2);
      const small = new THREE.RingGeometry(0.0035, 0.0068, 32).rotateY(Math.PI / 2);
      this.eyeGeos.push(ring, small);
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(ring, this.irisMat);
        m.position.set(0.1146, 0, s * 0.11);
        tilt.add(m);
      }
      const c = new THREE.Mesh(small, this.irisMat);
      c.position.set(0.0996, 0.01, 0);
      tilt.add(c);
    }
    this.setPose(STOWED);
  }

  private readonly irisMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private readonly eyeGeos: THREE.BufferGeometry[] = [];

  /** The camera eye: 0 dark, 1 lit (aperture rings glow, a faint glow in the glass, a little light spill). */
  setEye(k: number): void {
    this.irisMat.color.setRGB(0.35, 0.85, 1.0).multiplyScalar(3.2 * Math.max(0, k));
    this.dress.setEye(0.12 * k);
    if (this.dress.lights.eye) this.dress.lights.eye.intensity = 0.12 * Math.max(0, k);
  }

  setPose(p: Partial<HeroPose>): void {
    const r = this.rig;
    if (p.panel !== undefined && r.solarPanel) r.solarPanel.rotation.z = (Math.PI / 2) * (1 - p.panel);
    if (p.mast !== undefined && r.cameraMast) r.cameraMast.position.y = this.rigBase('cameraMast') - this.mastTravel * (1 - p.mast);
    if (p.pan !== undefined && r.cameraPan) r.cameraPan.rotation.y = p.pan;
    if (p.tilt !== undefined && r.cameraTilt) r.cameraTilt.rotation.z = p.tilt;
  }

  private readonly bases = new Map<string, number>();
  private rigBase(part: 'cameraMast'): number {
    let b = this.bases.get(part);
    if (b === undefined) {
      b = this.rig[part]?.position.y ?? 0;
      this.bases.set(part, b);
    }
    return b;
  }

  /** Roll every wheel to this distance travelled (m). */
  setWheelRoll(distance: number): void {
    const a = -distance / this.handling.wheelRadiusM;
    for (const w of this.wheels) w.spin.rotation.z = a;
  }

  /**
   * Stand on the ground at (x, z) facing `yaw` (rotation about +y; 0 faces +x): pitch and roll from the four
   * wheel contacts, each wheel's suspension reaching down to its own ground height.
   */
  placeOnGround(x: number, z: number, yaw: number, ground: GroundFn): void {
    const h = this.handling;
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const heights = this.wheels.map(({ corner }) => {
      const p = new THREE.Vector3(corner.x, 0, corner.z).applyQuaternion(qYaw);
      return ground(x + p.x, z + p.z);
    });
    const [fr, fl, rr, rl] = heights as [number, number, number, number];
    const pitch = Math.atan2((fr + fl) / 2 - (rr + rl) / 2, h.wheelBaseM);
    const roll = -Math.atan2((fr + rr) / 2 - (fl + rl) / 2, h.wheelTrackM);
    const q = qYaw
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll));
    const mean = (fr + fl + rr + rl) / 4;
    this.object.position.set(x, mean + this.rideHeight, z);
    this.object.quaternion.copy(q);
    this.object.updateMatrixWorld(true);
    // Each wheel: suspension length so the tyre meets its ground.
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const rest = h.suspension.restLengthM;
    const travel = h.suspension.maxTravelM;
    this.wheels.forEach(({ wheel, corner }, i) => {
      const conn = corner.clone().applyQuaternion(q).add(this.object.position);
      const len = (conn.y - (heights[i]! + h.wheelRadiusM)) / Math.max(0.5, up.y);
      const clamped = Math.min(rest + travel * 0.6, Math.max(rest - travel * 0.6, len));
      wheel.position.y = this.connectY - clamped;
    });
  }

  dispose(): void {
    this.dress.dispose();
    this.irisMat.dispose();
    for (const g of this.eyeGeos) g.dispose();
    this.object.removeFromParent();
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
