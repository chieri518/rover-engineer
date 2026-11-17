// Act 2 · Arrival: shot lengths and the in-shot moments the score hits (seconds from the shot start).
// Owned by the Act 2 track; the score reads these through cues.ts, so keep them true to the picture.
export const ACT2_SHOTS = [
  { id: 'touchdown', duration: 3 },
  { id: 'doors', duration: 3 },
  { id: 'wake', duration: 4 },
  { id: 'tracks', duration: 4 },
];

export const ACT2_CUES = {
  /** The hatch starts to swing down (the slow rising tone starts here). */
  hatchStart: { shot: 'doors', t: 0.4 },
  /** The ramp lands on the ground. */
  rampDown: { shot: 'doors', t: 2.4 },
  /** Status lights blink on, one chime each. */
  led1: { shot: 'wake', t: 0.4 },
  led2: { shot: 'wake', t: 0.7 },
  led3: { shot: 'wake', t: 1.0 },
  /** Solar panel unfolds. */
  panelStart: { shot: 'wake', t: 1.3 },
  /** Mast rises (gentle sweep) and the camera eye lights, then turns to the door. */
  mastStart: { shot: 'wake', t: 2.0 },
  eyeOn: { shot: 'wake', t: 3.0 },
  /** The first wheel touches the regolith: the main theme begins exactly here. */
  wheelTouch: { shot: 'tracks', t: 1.6 },
};
