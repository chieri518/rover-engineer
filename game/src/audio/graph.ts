// The bus graph: music and effects buses, a shared reverb, and a master chain with a compressor and a
// limiter. Built on any BaseAudioContext, so the live game and an offline level check use the same mix.
import { BUS, MASTER, REVERB } from './mix';
import { volumeGain } from './tune';

export interface Buses {
  ac: BaseAudioContext;
  /** Mute and the hidden-tab fade act here. */
  master: GainNode;
  music: GainNode;
  effects: GainNode;
  /** Send into the reverb (music and effects send to it at their own levels). */
  musicReverb: GainNode;
  effectsReverb: GainNode;
  /** Shared noise for the synths: white, and brown (deeper). */
  white: AudioBuffer;
  brown: AudioBuffer;
}

/** A decaying stereo noise burst: the impulse response of a soft, long hall. */
function impulse(ac: BaseAudioContext, rng: () => number): AudioBuffer {
  const length = Math.round(ac.sampleRate * REVERB.seconds);
  const buf = ac.createBuffer(2, length, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // A low-passed noise (one-pole) so the tail is dark, not hissy.
    let lp = 0;
    for (let i = 0; i < length; i++) {
      lp += 0.35 * (rng() * 2 - 1 - lp);
      d[i] = lp * (1 - i / length) ** REVERB.decay;
    }
  }
  return buf;
}

function noise(ac: BaseAudioContext, seconds: number, brown: boolean, rng: () => number): AudioBuffer {
  const length = Math.round(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, length, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const w = rng() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  // Fade the ends into each other so the loop has no click.
  const fade = Math.min(length >> 1, Math.round(ac.sampleRate * 0.05));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    const j = length - fade + i;
    d[j] = d[j]! * (1 - k) + d[i]! * k;
  }
  return buf.length > fade ? sliceStart(ac, buf, fade) : buf;
}

/** Drop the first samples (already blended into the end), so the buffer loops seamlessly. */
function sliceStart(ac: BaseAudioContext, buf: AudioBuffer, from: number): AudioBuffer {
  const out = ac.createBuffer(1, buf.length - from, buf.sampleRate);
  out.getChannelData(0).set(buf.getChannelData(0).subarray(from));
  return out;
}

export function buildBuses(ac: BaseAudioContext, rng: () => number = Math.random): Buses {
  const master = ac.createGain();
  master.gain.value = MASTER.gain;
  const comp = ac.createDynamicsCompressor();
  const c = MASTER.compressor;
  comp.threshold.value = c.threshold;
  comp.knee.value = c.knee;
  comp.ratio.value = c.ratio;
  comp.attack.value = c.attack;
  comp.release.value = c.release;
  const lim = ac.createDynamicsCompressor();
  const l = MASTER.limiter;
  lim.threshold.value = l.threshold;
  lim.knee.value = l.knee;
  lim.ratio.value = l.ratio;
  lim.attack.value = l.attack;
  lim.release.value = l.release;
  master.connect(comp).connect(lim).connect(ac.destination);

  // The buses start silent; setVolumes glides them up to the sliders.
  const music = ac.createGain();
  const effects = ac.createGain();
  music.gain.value = 0;
  effects.gain.value = 0;
  music.connect(master);
  effects.connect(master);

  const reverb = ac.createConvolver();
  reverb.normalize = true;
  reverb.buffer = impulse(ac, rng);
  const ret = ac.createGain();
  ret.gain.value = REVERB.return;
  reverb.connect(ret);
  // Sources feed their bus (dry) and a send (wet). Each send's gain carries its bus volume (setVolumes),
  // so one reverb return straight into the master follows both sliders.
  const musicReverb = ac.createGain();
  const effectsReverb = ac.createGain();
  musicReverb.gain.value = 0;
  effectsReverb.gain.value = 0;
  musicReverb.connect(reverb);
  effectsReverb.connect(reverb);
  ret.connect(master);

  return {
    ac,
    master,
    music,
    effects,
    musicReverb,
    effectsReverb,
    white: noise(ac, 2, false, rng),
    brown: noise(ac, 4, true, rng),
  };
}

/** Apply the volume sliders to the buses (and their reverb sends) with a short glide. */
export function setVolumes(b: Buses, music: number, effects: number, at = b.ac.currentTime): void {
  const m = volumeGain(music, BUS.musicMax);
  const e = volumeGain(effects, BUS.effectsMax);
  b.music.gain.setTargetAtTime(m, at, 0.05);
  b.effects.gain.setTargetAtTime(e, at, 0.05);
  b.musicReverb.gain.setTargetAtTime(m * REVERB.musicSend, at, 0.05);
  b.effectsReverb.gain.setTargetAtTime(e * REVERB.effectsSend, at, 0.05);
}
