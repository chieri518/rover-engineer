// The laser spectrometer's target marker (Mars step 6a, flagged in step 4a): a small bright cone hovering
// point-down over what the laser would read now (a boulder's top, or the delta cliff's foot), turning and
// bobbing so it catches the eye. The mission sets it each frame (scene.setLaserTarget).
import * as THREE from 'three';

// Presentation settings, not game rules.
const COLOR = 0xff5a2a;
const RADIUS_M = 0.22;
const LENGTH_M = 0.55;
const HOVER_M = 0.45; // gap between the cone's tip and the target's top
const BOB_M = 0.12;
const BOB_PER_S = 0.9;
const SPIN_RAD_PER_S = 2.5;

export class LaserMarker {
  readonly object: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  private time = 0;
  private topY = 0;

  constructor() {
    const geometry = new THREE.ConeGeometry(RADIUS_M, LENGTH_M, 4);
    geometry.rotateX(Math.PI); // tip down
    geometry.translate(0, LENGTH_M / 2, 0); // tip at the object's origin
    this.object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: COLOR, fog: false }));
    this.object.visible = false;
  }

  /** Show the marker above a point whose top is at `topY` (world y), or hide it (null). */
  set(target: { x: number; z: number; topY: number } | null): void {
    this.object.visible = target !== null;
    if (!target) return;
    this.topY = target.topY;
    this.object.position.x = target.x;
    this.object.position.z = target.z;
    this.place();
  }

  /** Turn and bob; `dt` real seconds. */
  update(dt: number): void {
    if (!this.object.visible) return;
    this.time += dt;
    this.object.rotation.y += SPIN_RAD_PER_S * dt;
    this.place();
  }

  private place(): void {
    this.object.position.y = this.topY + HOVER_M + BOB_M * (0.5 + 0.5 * Math.sin(2 * Math.PI * BOB_PER_S * this.time));
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.object.removeFromParent();
  }
}
