// Act 3 · Survive the extremes: shot lengths and the in-shot moments the score hits (seconds from the shot start).
// Owned by the Act 3 track; the score reads these through cues.ts, so keep them true to the picture.
export const ACT3_SHOTS = {
  moon: [{ id: 'moon-crater', duration: 3 }],
  mars: [{ id: 'mars-storm', duration: 3 }],
  titan: [{ id: 'titan-rain', duration: 5 }],
};

export const ACT3_CUES = {
  /** Moon: the floodlights snap on in the dark (a hit). */
  floodlights: { shot: 'moon-crater', t: 1.4 },
  /** Titan: the floodlights are the last thing visible; then black, and the last chord cuts. */
  lightsOut: { shot: 'titan-rain', t: 3.8 },
  black: { shot: 'titan-rain', t: 4.6 },
};
