// The intro's score and sound effects, synthesized offline with the game's own sound engine (src/audio: the
// buses, the hall reverb, the master compressor and limiter, the moods' instruments). Composed as a trailer:
// tension (act 1) -> release as the rocket clears the tower -> space -> the Moon in silence (score only) -> the
// hero's theme from the first wheel touch -> the extremes -> cut to silence on black.
// Every time comes from the cue sheet (cues.ts) at render time; all randomness is seeded, so renders are identical.
// renderScore() returns the whole film, FILM_SECONDS long.
import { seeded } from '../clock';
import { FILM_SECONDS } from '../cues';
import { buildBuses } from '../../../src/audio/graph';
import { BUS, MASTER, REVERB } from '../../../src/audio/mix';
import { act1 } from './act1';
import { act2 } from './act2';
import { act3 } from './act3';
import { master } from './master';
import type { Score } from './synth';
import { filmTimes } from './times';

/** Gain into the final limiter, and its ceiling (true peak): the mux normalizes loudness linearly from here. */
const MASTERING = { drive: 1.35, ceiling: 0.5 };
/** The whole mix into the game's bus chain: low enough that its compressor only rounds off the loudest hits. */
const TRIM = 0.3;

export async function renderScore(sampleRate: number): Promise<AudioBuffer> {
  const ac = new OfflineAudioContext(2, Math.ceil(FILM_SECONDS * sampleRate), sampleRate);
  const rng = seeded(0x5c07e);
  const b = buildBuses(ac, rng);
  // The sliders at 100%, trimmed.
  b.music.gain.value = BUS.musicMax * TRIM;
  b.effects.gain.value = BUS.effectsMax * TRIM;
  b.musicReverb.gain.value = BUS.musicMax * REVERB.musicSend * TRIM;
  b.effectsReverb.gain.value = BUS.effectsMax * REVERB.effectsSend * TRIM;

  const T = filmTimes();
  console.log(`score cues ${JSON.stringify(T)}`);
  const s: Score = { ac, b, rng };
  act1(s, T);
  act2(s, T);
  act3(s, T);
  // Black: everything (the reverb's tail too) cuts to silence.
  b.master.gain.setValueAtTime(MASTER.gain, Math.max(0, T.black - 0.005));
  b.master.gain.linearRampToValueAtTime(0, T.black);

  const out = await ac.startRendering();
  const chans = [out.getChannelData(0), out.getChannelData(1)];
  const { reductionDb } = master(chans, { sampleRate, cutAt: T.black, ...MASTERING });
  console.log(`score master: limiter at most ${reductionDb.toFixed(1)} dB`);
  return out;
}
