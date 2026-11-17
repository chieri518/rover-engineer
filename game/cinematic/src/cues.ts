// The cue sheet for the score: shot boundaries and the in-shot moments from each act's timing.ts, as film times
// (seconds from the start). Pure data (no three, no scenes), so the score can use it without loading the picture.
import { ACT1_CUES, ACT1_SHOTS } from './act1/timing';
import { ACT2_CUES, ACT2_SHOTS } from './act2/timing';
import { ACT3_CUES, ACT3_SHOTS } from './act3/timing';

interface CueRef {
  shot: string;
  t: number;
}

const SHOT_LIST = [...ACT1_SHOTS, ...ACT2_SHOTS, ...ACT3_SHOTS.moon, ...ACT3_SHOTS.mars, ...ACT3_SHOTS.titan];

/** Film time where each shot starts, and its length. */
export const SHOTS: Record<string, { start: number; duration: number }> = {};
let t = 0;
for (const s of SHOT_LIST) {
  SHOTS[s.id] = { start: t, duration: s.duration };
  t += s.duration;
}

/** Film length in seconds. */
export const FILM_SECONDS = t;

function resolve<K extends string>(cues: Record<K, CueRef>): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of Object.keys(cues) as K[]) {
    const c = cues[k];
    const shot = SHOTS[c.shot];
    if (!shot) throw new Error(`cue ${k}: unknown shot ${c.shot}`);
    out[k] = shot.start + c.t;
  }
  return out;
}

/** Every cue as a film time (seconds). */
export const CUES = { ...resolve(ACT1_CUES), ...resolve(ACT2_CUES), ...resolve(ACT3_CUES) };
