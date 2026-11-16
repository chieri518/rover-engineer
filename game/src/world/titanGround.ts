// titan-fx: ground. Titan's ground visuals in one place for the scene (moonScene.ts): the ice pebbles around the
// rover (titanPebbles.ts) and the sand ripples in the ground shader (titanRipples.ts). Presentation only; the
// scene calls this on Titan alone, so the Moon and Mars are untouched. Dev hook: __titanGround.pebbles(), showPebbles(on), showRipples(on).
import type * as THREE from 'three';
import type { Tuning } from '../rules/types';
import type { WorldId } from '../worlds';
import type { MoonLightUniforms } from './lunarLighting';
import { loadTerrainMasks } from './terrainMasks';
import { TitanPebbles } from './titanPebbles';
import { disableTitanRipples, enableTitanRipples, titanRippleUniforms } from './titanRipples';

export interface TitanGround {
  /** Each frame, with the rover's position: rebuilds the pebble field when the rover has moved far enough. */
  update(pos: { x: number; z: number }): void;
  dispose(): void;
}

export async function startTitanGround(o: {
  scene: THREE.Scene;
  uniforms: MoonLightUniforms;
  tuning: Tuning;
  world: WorldId;
  landing: { x: number; z: number };
  groundAt: (x: number, z: number) => number;
}): Promise<TitanGround> {
  const look = o.tuning.look;
  const masks = await loadTerrainMasks(o.tuning, o.world, []); // cached: the mission screen loaded it already (Titan has no sites.json sites)
  if (look?.ripples && masks.softMask) enableTitanRipples(masks.softMask, look.ripples);
  const pebbles = look?.pebbles
    ? new TitanPebbles(o.uniforms, look.pebbles, o.landing, o.groundAt, (x, z) => masks.softnessAt(x, z, o.tuning.ground))
    : null;
  if (pebbles) {
    pebbles.update(o.landing.x, o.landing.z);
    o.scene.add(pebbles.object);
  }
  if (import.meta.env.DEV) {
    // Dev only: pebble count, and switches for before/after screenshots.
    (window as unknown as { __titanGround?: unknown }).__titanGround = {
      pebbles: () => pebbles?.count ?? 0,
      showPebbles: (on: boolean) => { if (pebbles) pebbles.object.visible = on; },
      showRipples: (on: boolean) => { titanRippleUniforms.titanSoftRect.value.w = on && titanRippleUniforms.titanSoftMask.value ? 1 : 0; },
    };
  }
  return {
    update(pos) {
      pebbles?.update(pos.x, pos.z);
    },
    dispose() {
      disableTitanRipples();
      if (pebbles) {
        pebbles.object.removeFromParent();
        pebbles.dispose();
      }
      if (import.meta.env.DEV) delete (window as unknown as { __titanGround?: unknown }).__titanGround;
    },
  };
}
