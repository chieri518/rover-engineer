// The film times the score hits, read from the cue sheet at render time (never hard-coded), so the score follows
// the acts when they move a cue or change a shot length. Act boundaries come from each act's shot list, so a shot
// renamed or added inside an act does not break the score.
import { CUES, FILM_SECONDS, SHOTS } from '../cues';
import { ACT2_SHOTS } from '../act2/timing';
import { ACT3_SHOTS } from '../act3/timing';

export interface Times {
  /** The igniter sparks start (before ignition). */
  sparks: number;
  ignition: number;
  /** The hold-downs release and the rocket starts to rise. */
  liftoff: number;
  clearTower: number;
  separation: number;
  /** The upper stage lights (in vacuum: no sound, a musical swell only). */
  upperIgnition: number;
  /** Act 2 starts (touchdown on the Moon): from here until Mars there is no diegetic sound. */
  moon: number;
  hatchStart: number;
  rampDown: number;
  /** One chime per status light (led1, led2, ... in order; any number of them). */
  leds: number[];
  panelStart: number;
  mastStart: number;
  eyeOn: number;
  /** The camera head turns toward the door. */
  eyeTurn: number;
  wheelTouch: number;
  /** Act 3 shots: Moon crater, Mars storm, Titan rain. */
  crater: number;
  /** The ground drops into the crater's shadow: the music drops to a single tone. */
  moonDark: number;
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
  const c = CUES as typeof CUES & Partial<Record<'sparks' | 'liftoff' | 'upperIgnition' | 'eyeTurn' | 'moonDark', number>>;
  const leds = Object.entries(c as Record<string, number>)
    .filter(([k]) => /^led\d+$/.test(k))
    .sort(([a], [b]) => Number(a.slice(3)) - Number(b.slice(3)))
    .map(([, v]) => v);
  const crater = shotStart(ACT3_SHOTS.moon[0]?.id, c.floodlights - 1.4);
  const titan = shotStart(ACT3_SHOTS.titan[0]?.id, c.lightsOut - 3.8);
  return {
    sparks: c.sparks ?? Math.max(0, c.ignition - 1.6),
    ignition: c.ignition,
    liftoff: c.liftoff ?? (c.ignition + c.clearTower) / 2,
    clearTower: c.clearTower,
    separation: c.separation,
    upperIgnition: c.upperIgnition ?? c.separation + 0.7,
    moon: shotStart(ACT2_SHOTS[0]?.id, c.hatchStart - 3.4),
    hatchStart: c.hatchStart,
    rampDown: c.rampDown,
    leds,
    panelStart: c.panelStart,
    mastStart: c.mastStart,
    eyeOn: c.eyeOn,
    eyeTurn: c.eyeTurn ?? c.eyeOn + 0.15,
    wheelTouch: c.wheelTouch,
    crater,
    moonDark: Math.min(c.moonDark ?? crater, c.floodlights - 0.3),
    floodlights: c.floodlights,
    mars: shotStart(ACT3_SHOTS.mars[0]?.id, (crater + titan) / 2),
    titan,
    lightsOut: c.lightsOut,
    black: Math.min(c.black, FILM_SECONDS),
    film: FILM_SECONDS,
  };
}
