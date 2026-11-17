// Act 1 · Leaving Earth: shot lengths and the in-shot moments the score hits (seconds from the shot start).
// Owned by the Act 1 track; the score reads these through cues.ts, so keep them true to the picture.
export const ACT1_SHOTS = [
  { id: 'ignition', duration: 4 },
  { id: 'liftoff', duration: 5 },
  { id: 'orbit', duration: 3 },
];

export const ACT1_CUES = {
  /** Engines light: the flame blooms out. */
  ignition: { shot: 'ignition', t: 2.6 },
  /** The rocket clears the tower: the score's first big chord. */
  clearTower: { shot: 'liftoff', t: 3.2 },
  /** Stage separation: a soft thump. */
  separation: { shot: 'orbit', t: 1.6 },
};
