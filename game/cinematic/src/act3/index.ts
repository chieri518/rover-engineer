// Act 3 · Survive the extremes (placeholder until the Act 3 track builds it): a plain chase view of the game's
// real worlds, which also checks the offline world hook in src/world/moonScene.ts.
import * as THREE from 'three';
import type { SequenceDef, ShotTiming } from '../timeline';
import type { WorldId } from '../../../src/worlds';
import { startWorld } from '../lib/world';
import { ACT3_SHOTS } from './timing';

function chase(id: string, world: WorldId, shots: ShotTiming[], storm: number): SequenceDef {
  return {
    id,
    shots,
    async load(ctx) {
      const w = await startWorld(world, ctx);
      const o = w.offline;
      o.holdStorm(storm);
      // Use the world's own camera: its sky, rain and clouds follow it in updateView().
      const camera = o.camera;
      camera.fov = 50;
      camera.updateProjectionMatrix();
      const fwd = new THREE.Vector3();
      return {
        update(f) {
          o.stepPhysics(f.dt, { throttle: 1, steer: 0, brake: false });
          const p = o.rover.position;
          o.rover.forward(fwd);
          camera.position.set(p.x - fwd.x * 7, p.y + 2.5, p.z - fwd.z * 7);
          camera.lookAt(p.x + fwd.x * 4, p.y + 0.8, p.z + fwd.z * 4);
          o.updateView(f.dt);
          return { camera };
        },
        render(target) {
          o.draw(target);
        },
        dispose() {
          w.scene.dispose();
        },
      };
    },
  };
}

export const act3: SequenceDef[] = [
  chase('moon-chase', 'moon', ACT3_SHOTS.moon, 0),
  chase('mars-chase', 'mars', ACT3_SHOTS.mars, 0.6),
  chase('titan-chase', 'titan', ACT3_SHOTS.titan, 0.8),
];
