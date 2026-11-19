// Act 3 · Survive the extremes: shot lengths and the in-shot moments the score hits (seconds from the shot start).
// Owned by the Act 3 track; the score reads these through cues.ts, so keep them true to the picture.
export const ACT3_SHOTS = {
  // The crater runs on past the floodlights (three beats more) so the Moon's music can finish its phrase and
  // return to the lone tone of the dark before Mars.
  moon: [{ id: 'moon-crater', duration: 5.4 }],
  mars: [{ id: 'mars-storm', duration: 3 }],
  // Black from 4.6 s; the last 1.9 s let the final chord and the rain die away into silence.
  titan: [{ id: 'titan-rain', duration: 6.5 }],
};

export const ACT3_CUES = {
  /** Moon: the rover crests the rim and the ground around it drops into the crater's black shadow (the single tone). */
  moonDark: { shot: 'moon-crater', t: 1.2 },
  /** Moon: the floodlights snap on in the dark (a hit). */
  floodlights: { shot: 'moon-crater', t: 2.0 },
  /** Titan: the floodlights die (a short stutter); they are the last thing visible. */
  lightsOut: { shot: 'titan-rain', t: 3.8 },
  /** Titan: fully black; the last chord and the rain die away from here to the end of the film. */
  black: { shot: 'titan-rain', t: 4.6 },
};
