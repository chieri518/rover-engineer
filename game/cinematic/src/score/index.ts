// The intro's score and sound effects, synthesized offline (placeholder until the score track writes it): a soft
// tone at every cue so the sync can be checked. renderScore() must return the whole film, FILM_SECONDS long.
import { CUES, FILM_SECONDS } from '../cues';

export async function renderScore(sampleRate: number): Promise<AudioBuffer> {
  const ac = new OfflineAudioContext(2, Math.ceil(FILM_SECONDS * sampleRate), sampleRate);
  for (const at of Object.values(CUES)) {
    const osc = new OscillatorNode(ac, { type: 'sine', frequency: 440 });
    const g = new GainNode(ac, { gain: 0 });
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.2, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.4);
    osc.connect(g).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.5);
  }
  return ac.startRendering();
}
