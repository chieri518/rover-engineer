import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { tutorialPages } from './tutorialText';

const data = loadGameData();

describe('tutorial text', () => {
  it('fills every placeholder on both tutorials', () => {
    for (const id of ['design', 'drive'] as const) {
      const pages = tutorialPages(id, data, { mission: 'moon', instrument: 'camera' });
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) for (const s of [p.title, ...p.paragraphs]) expect(s).not.toMatch(/\{\w+\}/);
    }
  });

  it('takes numbers from the game data and shows only the equipped instrument', () => {
    const drive = (instrument: 'camera' | 'drill') =>
      tutorialPages('drive', data, { mission: 'moon', instrument }).flatMap((p) => p.paragraphs).join('\n');
    expect(drive('camera')).toContain(`${data.tuning.ground.maxSlopeDegrees}°`);
    expect(drive('camera')).toContain(data.text.tutorial.drive.at(-1)!.instrument!.camera!);
    expect(drive('camera')).not.toContain(data.text.tutorial.drive.at(-1)!.instrument!.drill!);
    expect(drive('drill')).toContain(data.text.tutorial.drive.at(-1)!.instrument!.drill!);
    const design = tutorialPages('design', data, { mission: 'moon', instrument: null }).flatMap((p) => p.paragraphs).join('\n');
    for (const tier of data.tiers.tiers) expect(design).toContain(`${tier.massLimit} kg`);
  });
});
