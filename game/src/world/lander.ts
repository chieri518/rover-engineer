// The lander that delivered the rover: a landmark at the landing point, with the ramp the rover
// drove down. Built from three.js primitives; a fixed collider keeps the rover from driving through it.
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';

type Rapier = typeof RAPIER;

const BODY_RADIUS_M = 1.7;
const BODY_HEIGHT_M = 1.3;
const DECK_HEIGHT_M = 1.5; // bottom of the body above the ground
const LEG_SPREAD_M = 2.6;
const BEHIND_ROVER_M = 5.5; // lander center, behind the rover's start...
const LEFT_OF_ROVER_M = 5.5; // ...and to its left, so the chase camera (7 m behind) is not inside it and its legs stay out of the start view
const RAMP_RUN_M = 3.4; // horizontal reach of the ramp from the deck edge to its foot
const RAMP_WIDTH_M = 1.1;
const RAMP_PLATE_M = 0.06; // plate thickness
const RAMP_RAIL_M = 0.14; // side rail height above the plate

export class Lander {
  readonly object = new THREE.Group();
  private readonly body: RAPIER.RigidBody;

  /**
   * Place the lander behind and to the left of a rover that starts at (x, z) facing an azimuth
   * (terrain.json convention: azimuth az points along (sin az, 0, −cos az)), with its ramp reaching
   * down on the side away from the rover. (A ramp toward the rover crossed the start view just below
   * the chase camera and read as floating bars.)
   */
  constructor(
    private readonly world: RAPIER.World,
    rapier: Rapier,
    start: { x: number; z: number; headingDeg: number },
    groundAt: (x: number, z: number) => number,
  ) {
    const az = (start.headingDeg * Math.PI) / 180;
    const fx = Math.sin(az);
    const fz = -Math.cos(az);
    // Right of the heading is azimuth + 90°: (cos az, sin az).
    const cx = start.x - fx * BEHIND_ROVER_M - Math.cos(az) * LEFT_OF_ROVER_M;
    const cz = start.z - fz * BEHIND_ROVER_M - Math.sin(az) * LEFT_OF_ROVER_M;
    // The ramp points left of the rover's heading, away from the rover and the chase camera.
    const dx = -Math.cos(az);
    const dz = -Math.sin(az);
    // Stand on the lowest footpad so no leg floats above the slope.
    let ground = Infinity;
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) * (Math.PI / 2);
      ground = Math.min(ground, groundAt(cx + Math.cos(a) * LEG_SPREAD_M, cz + Math.sin(a) * LEG_SPREAD_M));
    }
    this.object.position.set(cx, ground, cz);
    // Local +x points at the rover.
    this.object.rotation.y = Math.atan2(-dz, dx);
    const footR = BODY_RADIUS_M + RAMP_RUN_M;
    this.build(groundAt(cx + dx * footR, cz + dz * footR) - ground);

    this.body = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(cx, ground + DECK_HEIGHT_M / 2 + 0.6, cz));
    world.createCollider(rapier.ColliderDesc.cylinder(DECK_HEIGHT_M / 2 + 0.6, BODY_RADIUS_M), this.body);
  }

  /** rampFootY: ground height at the ramp's foot, relative to the lander's base. */
  private build(rampFootY: number): void {
    const foil = new THREE.MeshLambertMaterial({ color: 0xc69a3e });
    const white = new THREE.MeshLambertMaterial({ color: 0xe4e1d8 });
    const metal = new THREE.MeshLambertMaterial({ color: 0x9a9ea4 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2c2e31 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.object.add(mesh);
      return mesh;
    };

    // Body: an octagonal stage wrapped in gold foil, a white top deck, tanks and an antenna.
    add(new THREE.CylinderGeometry(BODY_RADIUS_M, BODY_RADIUS_M, BODY_HEIGHT_M, 8), foil, 0, DECK_HEIGHT_M + BODY_HEIGHT_M / 2, 0);
    add(new THREE.CylinderGeometry(BODY_RADIUS_M + 0.05, BODY_RADIUS_M + 0.05, 0.08, 8), white, 0, DECK_HEIGHT_M + BODY_HEIGHT_M, 0);
    for (const [x, z] of [[-0.6, -0.6], [-0.6, 0.6]] as const) {
      add(new THREE.SphereGeometry(0.42, 16, 10), white, x, DECK_HEIGHT_M + BODY_HEIGHT_M + 0.3, z);
    }
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), metal, -1.0, DECK_HEIGHT_M + BODY_HEIGHT_M + 0.55, 0);
    const dish = add(new THREE.CylinderGeometry(0.35, 0.05, 0.12, 16, 1, true), white, -0.95, DECK_HEIGHT_M + BODY_HEIGHT_M + 1.1, 0);
    dish.rotation.z = 0.9;
    (dish.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
    // Solar panel on one side.
    const panel = add(new THREE.BoxGeometry(0.04, 1.0, 1.6), new THREE.MeshLambertMaterial({ color: 0x1d2a4a }), 0, DECK_HEIGHT_M + BODY_HEIGHT_M / 2, -BODY_RADIUS_M - 0.05);
    panel.rotation.y = Math.PI / 2;
    // Engine bell underneath.
    add(new THREE.CylinderGeometry(0.25, 0.55, 0.7, 16, 1, true), dark, 0, DECK_HEIGHT_M - 0.3, 0);

    // Four legs with footpads.
    const legLen = Math.hypot(LEG_SPREAD_M - BODY_RADIUS_M * 0.8, DECK_HEIGHT_M + 0.2);
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) * (Math.PI / 2);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r0 = BODY_RADIUS_M * 0.8;
      const mid = (r0 + LEG_SPREAD_M) / 2;
      const leg = add(new THREE.CylinderGeometry(0.06, 0.06, legLen, 8), metal, c * mid, (DECK_HEIGHT_M + 0.2) / 2, s * mid);
      // Tilt the leg outward from vertical toward its footpad.
      leg.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(c * (r0 - LEG_SPREAD_M), DECK_HEIGHT_M + 0.2, s * (r0 - LEG_SPREAD_M)).normalize(),
      );
      add(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 12), metal, c * LEG_SPREAD_M, 0.04, s * LEG_SPREAD_M);
    }

    // The deployment ramp: a plate with low side rails, from the deck edge down to the ground ahead.
    // The plate's underside meets the deck at the top and rests on the ground at the foot.
    const topX = BODY_RADIUS_M;
    const topY = DECK_HEIGHT_M + RAMP_PLATE_M / 2;
    const footX = BODY_RADIUS_M + RAMP_RUN_M;
    const footY = rampFootY + RAMP_PLATE_M / 2;
    const length = Math.hypot(footX - topX, topY - footY);
    const tilt = -Math.atan2(topY - footY, footX - topX);
    const ramp = new THREE.Group();
    ramp.position.set((topX + footX) / 2, (topY + footY) / 2, 0);
    ramp.rotation.z = tilt;
    this.object.add(ramp);
    const part = (geometry: THREE.BufferGeometry, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, metal);
      mesh.position.set(0, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      ramp.add(mesh);
    };
    part(new THREE.BoxGeometry(length, RAMP_PLATE_M, RAMP_WIDTH_M), 0, 0);
    for (const side of [-1, 1]) {
      part(new THREE.BoxGeometry(length, RAMP_RAIL_M, 0.06), (RAMP_PLATE_M + RAMP_RAIL_M) / 2, side * (RAMP_WIDTH_M / 2 - 0.03));
    }
  }

  dispose(): void {
    this.world.removeRigidBody(this.body);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        geometries.add(obj.geometry);
        materials.add(obj.material as THREE.Material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
