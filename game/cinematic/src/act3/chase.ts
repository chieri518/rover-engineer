// The shared frame of Act 3's three clips: start the game's real world, dress the rover, pre-simulate its drive,
// and each sub-frame pose the rover and the chase camera at the exact time, let the world update its view, and
// hand over to the clip's own effects and grade.
import * as THREE from 'three';
import type { FrameState, FrameView, SequenceContext, SequenceDef, SequenceInstance, ShotTiming } from '../timeline';
import type { WorldId } from '../../../src/worlds';
import type { DriveInput } from '../../../src/rover/vehicle';
import { startWorld, type CinematicWorld } from '../lib/world';
import { recordDrive, type DriveTrack } from './track';
import { chaseRig, type ChaseFraming, type ChaseRig } from './rig';
import { dress } from './dress';

export interface ChaseClip {
  /** Per sub-frame, after the rover and camera are placed and before the world updates its view. */
  update(f: FrameState, t: number): FrameView['post'];
  /** After the world's view update (effects that follow the camera). */
  afterView?(f: FrameState, t: number): void;
  /** Draw (default: the world). */
  render?(target: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera): void;
  dispose?(): void;
}

export interface ClipSetup {
  w: CinematicWorld;
  track: DriveTrack;
  rig: ChaseRig;
  ctx: SequenceContext;
}

export interface ChaseClipDef {
  id: string;
  world: WorldId;
  shots: ShotTiming[];
  start: { x: number; z: number; headingDeg: number };
  /** Run-up before shot time 0 (s), so the rover is at speed and the camera settled. */
  lead: number;
  speedBoost?: number;
  drive: (t: number) => DriveInput;
  framing: ChaseFraming;
  /** Before the drive is recorded (Sun, storm, lights...). */
  prepare?(w: CinematicWorld, ctx: SequenceContext): void;
  setup(s: ClipSetup): Promise<ChaseClip> | ChaseClip;
}

/** Sharper rover shadows: a tight, high-resolution shadow map around the rover. */
export function tightShadows(w: CinematicWorld, halfM: number, size: number, radius = 1): void {
  const s = w.offline.sunLight.shadow;
  s.mapSize.set(size, size);
  s.map?.dispose();
  s.map = null;
  Object.assign(s.camera, { left: -halfM, right: halfM, top: halfM, bottom: -halfM });
  s.camera.updateProjectionMatrix();
  s.radius = radius;
  s.bias = -0.0002;
  s.normalBias = 0.01;
}

export function chaseClip(def: ChaseClipDef): SequenceDef {
  const duration = def.shots.reduce((a, s) => a + s.duration, 0);
  return {
    id: def.id,
    shots: def.shots,
    async load(ctx): Promise<SequenceInstance> {
      const w = await startWorld(def.world, ctx);
      const o = w.offline;
      def.prepare?.(w, ctx);
      o.updateView(0); // place the Sun (and its light) for the clip before dressing the rover
      const dressed = dress(w, ctx);
      const track = recordDrive(o, def.start, def.lead, duration + 0.5, def.drive, { speedBoost: def.speedBoost });
      const rig = chaseRig(track, (x, z) => w.scene.terrain.heightAt(x, z), def.framing);
      const clip = await def.setup({ w, track, rig, ctx });
      const camera = o.camera;
      camera.aspect = ctx.width / ctx.height;
      return {
        update(f) {
          const t = f.seqT;
          track.pose(t);
          rig.place(t, camera);
          const post = clip.update(f, t);
          o.updateView(f.dt);
          clip.afterView?.(f, t);
          return { camera, post };
        },
        render(target, cam) {
          if (clip.render) clip.render(target, cam);
          else o.draw(target);
        },
        dispose() {
          clip.dispose?.();
          dressed.dispose();
          w.scene.dispose();
        },
      };
    },
  };
}
