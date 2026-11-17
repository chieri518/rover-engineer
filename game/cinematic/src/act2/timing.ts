// Act 2 · Arrival: shot lengths and the in-shot moments the score hits (seconds from the shot start).
// Owned by the Act 2 track; the score reads these through cues.ts, so keep them true to the picture.
// index.ts animates from these same numbers, so the picture follows any change here.
export const ACT2_SHOTS = [
  { id: 'touchdown', duration: 2.8 },
  { id: 'doors', duration: 2.8 },
  { id: 'wake', duration: 2.6 },
  { id: 'gaze', duration: 2.0 },
  { id: 'tracks', duration: 4.6 },
];

export const ACT2_CUES = {
  /** The hatch starts to swing down (the slow rising tone starts here). */
  hatchStart: { shot: 'doors', t: 0.3 },
  /** The ramp lands on the ground. */
  rampDown: { shot: 'doors', t: 2.2 },
  /** Status lights blink on, one chime each. */
  led1: { shot: 'wake', t: 0.35 },
  led2: { shot: 'wake', t: 0.65 },
  led3: { shot: 'wake', t: 0.95 },
  led4: { shot: 'wake', t: 1.2 },
  /** Solar panel unfolds. */
  panelStart: { shot: 'wake', t: 1.25 },
  /** Mast rises (gentle sweep); the next shot opens on the head as it finishes rising. */
  mastStart: { shot: 'wake', t: 1.9 },
  /** The camera eye lights, then turns to look out of the door (at us). */
  eyeOn: { shot: 'gaze', t: 0.45 },
  eyeTurn: { shot: 'gaze', t: 0.6 },
  /** The first wheel touches the regolith: the main theme begins exactly here. */
  wheelTouch: { shot: 'tracks', t: 1.6 },
};
