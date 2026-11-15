// Rapier start-up check. Phase 2 adds the heightfield collider and the rover vehicle.
import RAPIER from '@dimforge/rapier3d-compat';

let ready: Promise<void> | null = null;

export async function initPhysics(gravity: number): Promise<{ version: string; restY: number }> {
  ready ??= RAPIER.init();
  await ready;
  const world = new RAPIER.World({ x: 0, y: -gravity, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3, 0));
  world.createCollider(RAPIER.ColliderDesc.ball(0.5), body);
  for (let i = 0; i < 600; i++) world.step();
  const restY = body.translation().y;
  world.free();
  return { version: RAPIER.version(), restY };
}
