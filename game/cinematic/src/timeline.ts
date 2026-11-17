// The shot system. The film is a list of sequences (one per act); a sequence owns its scene and a list of shots
// that play back to back. The driver (main.ts) loads a sequence before its first shot, asks it for the camera and
// look at every sub-frame time, lets it draw, and disposes it after its last shot.
//
// Contract for sequences (read this before writing one):
//  - update() is called with times that only increase (several times per output frame: the sub-frames of the
//    motion-blur shutter). Everything visible must follow from those times: no wall clock, no frame counting.
//    Use f.t / f.seqT for animation and f.dt for stateful simulations (particles), which may be tiny (one sub-frame)
//    or bigger (preview). Math.random is seeded per sequence; performance.now() is the virtual clock.
//  - When a render starts in the middle of a sequence, the driver first "pre-rolls" update() from the sequence
//    start in 1/30 s steps without drawing, so stateful effects arrive in the right state.
//  - render() draws linear HDR (no tone mapping; renderer.toneMapping is ignored on render targets) into the
//    target, which the driver has cleared. Don't call camera.updateProjectionMatrix() in render(): the driver has
//    jittered the projection (anti-aliasing, depth of field). Set fov/near/far in update().
//  - The camera's aspect is ctx.width / ctx.height; set it in update() if you make your own camera.
import type * as THREE from 'three';
import type { PostParams } from './post';

export interface RenderSettings {
  /** Output size (the video). */
  width: number;
  height: number;
  /** Internal resolution = output × ss (supersampling). */
  ss: number;
  fps: number;
  /** Sub-frames per output frame (motion blur, DOF, AA). 1 in preview. */
  subframes: number;
  /** Shutter as a share of the frame interval (0.5: the film-standard 180° shutter). */
  shutter: number;
  /** 'preview': quick and rough (sequences may lower particle counts or shadow sizes); 'final': everything. */
  quality: 'preview' | 'final';
}

export interface SequenceContext {
  renderer: THREE.WebGLRenderer;
  /** Internal render size (the size of the target render() draws into). */
  width: number;
  height: number;
  settings: RenderSettings;
}

export interface ShotTiming {
  id: string;
  /** Seconds. */
  duration: number;
}

export interface FrameState {
  /** Which shot of the sequence, and seconds since its start. */
  shot: string;
  t: number;
  /** Seconds since the sequence start. */
  seqT: number;
  /** Seconds since the film start. */
  filmT: number;
  /** Seconds since the previous update() of this sequence (0 on the first). */
  dt: number;
}

export interface FrameView {
  camera: THREE.PerspectiveCamera;
  post?: Partial<PostParams>;
}

export interface SequenceInstance {
  update(f: FrameState): FrameView;
  render(target: THREE.WebGLRenderTarget, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

export interface SequenceDef {
  id: string;
  shots: ShotTiming[];
  load(ctx: SequenceContext): Promise<SequenceInstance>;
}

export interface PlacedShot {
  sequence: SequenceDef;
  seqIndex: number;
  shot: ShotTiming;
  /** Film time of the shot's start, and of its sequence's start. */
  start: number;
  seqStart: number;
}

export interface Film {
  sequences: SequenceDef[];
  shots: PlacedShot[];
  duration: number;
}

export function buildFilm(sequences: SequenceDef[]): Film {
  const shots: PlacedShot[] = [];
  let t = 0;
  sequences.forEach((sequence, seqIndex) => {
    const seqStart = t;
    for (const shot of sequence.shots) {
      shots.push({ sequence, seqIndex, shot, start: t, seqStart });
      t += shot.duration;
    }
  });
  return { sequences, shots, duration: t };
}

/** The shot playing at film time t (the last one for t at or past the end). */
export function shotAt(film: Film, t: number): PlacedShot {
  for (const s of film.shots) if (t < s.start + s.shot.duration) return s;
  return film.shots[film.shots.length - 1]!;
}
