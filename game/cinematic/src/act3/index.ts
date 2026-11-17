// Act 3 · Survive the extremes: three chase-camera clips of the hero rover on the game's real worlds.
// Moon: into a permanently shadowed crater, the floodlights snap on. Mars: Jezero, a dust storm rolls in.
// Titan: night, methane rain, floodlight beams, then black (the film's end).
import type { SequenceDef } from '../timeline';
import { moonClip } from './moon';
import { marsClip } from './mars';
import { titanClip } from './titan';

export const act3: SequenceDef[] = [moonClip, marsClip, titanClip];
