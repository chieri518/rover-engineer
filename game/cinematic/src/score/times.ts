// The film times the score hits, read from the cue sheet at render time (never hard-coded), so the score follows
// the acts when they move a cue or change a shot length. Act boundaries come from each act's shot list, so a shot
// renamed or added inside an act does not break the score.
import { CUES, FILM_SECONDS, SHOTS } from '../cues';
import { ACT2_SHOTS } from '../act2/timing';
import { ACT3_SHOTS } from '../act3/timing';

export interface Times {
  ignition: number;
  clearTower: number;
  separation: number;
  /** Act 2 starts (touchdown on the Moon): from here until Mars there is no diegetic sound. */
  moon: number;
  hatchStart: number;
  rampDown: number;
  /** One chime per status light (led1, led2, ... in order; any number of them). */
  leds: number[];
  panelStart: number;
  mastStart: number;
  eyeOn: number;
  wheelTouch: number;
  /** Act 3 shots: Moon crater, Mars storm, Titan rain. */
  crater: number;
  floodlights: number;
  mars: number;
  titan: number;
  lightsOut: number;
  /** Everything cuts to silence here. */
  black: number;
  film: number;
}

function shotStart(id: string | undefined, fallback: number): number {
  return (id === undefined ? undefined : SHOTS[id]?.start) ?? fallback;
}

export function filmTimes(): Times {
  const c = CUES;
  const leds = Object.entries(c as Record<string, number>)
    .filter(([k]) => /^led\d+$/.test(k))
    .sort(([a], [b]) => Number(a.slice(3)) - Number(b.slice(3)))
    .map(([, v]) => v);
  const crater = shotStart(ACT3_SHOTS.moon[0]?.id, c.floodlights - 1.4);
  const titan = shotStart(ACT3_SHOTS.titan[0]?.id, c.lightsOut - 3.8);
  return {
    ignition: c.ignition,
    clearTower: c.clearTower,
    separation: c.separation,
    moon: shotStart(ACT2_SHOTS[0]?.id, c.hatchStart - 3.4),
    hatchStart: c.hatchStart,
    rampDown: c.rampDown,
    leds,
    panelStart: c.panelStart,
    mastStart: c.mastStart,
    eyeOn: c.eyeOn,
    wheelTouch: c.wheelTouch,
    crater,
    floodlights: c.floodlights,
    mars: shotStart(ACT3_SHOTS.mars[0]?.id, (crater + titan) / 2),
    titan,
    lightsOut: c.lightsOut,
    black: Math.min(c.black, FILM_SECONDS),
    film: FILM_SECONDS,
  };
}
