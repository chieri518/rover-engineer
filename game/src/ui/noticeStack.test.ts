import { describe, expect, it } from 'vitest';
import { worldGameData } from '../gameData';
import { noticeNeeded, staleNotices } from './noticeStack';

describe('the notice stack shows one copy of a sentence', () => {
  const noLights = worldGameData('mars').text.night!.noLights;

  it('a notice repeating a standing warning is not posted (the Mars dusk notice without lights)', () => {
    expect(noticeNeeded(noLights, [noLights])).toBe(false);
    expect(noticeNeeded(noLights, [])).toBe(true);
    expect(noticeNeeded('Dawn.', [noLights])).toBe(true);
  });

  it('a standing warning absorbs a notice already showing its words', () => {
    expect(staleNotices(['Quake.', noLights], [noLights])).toEqual([1]);
    expect(staleNotices(['Quake.', noLights], [])).toEqual([]);
  });

  it('a repeated notice replaces its earlier copy instead of stacking', () => {
    expect(staleNotices(['Quake.', 'Dust storm.'], [], 'Quake.')).toEqual([0]);
    expect(staleNotices(['Quake.', 'Dust storm.'], [], 'Dawn.')).toEqual([]);
  });
});
