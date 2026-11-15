import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { tutorialPages } from './tutorialText';

const data = loadGameData();

describe('tutorial text', () => {
  it('fills every placeholder on both tutorials', () => {
    for (const id of ['design', 'drive'] as const) {
      const pages = tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill'] });
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) for (const s of [p.title, ...p.paragraphs]) expect(s).not.toMatch(/\{\w+\}/);
    }
  });

  it('takes numbers from the game data and shows only the instruments carried, with their bay keys', () => {
    const drive = (...instruments: ('camera' | 'drill')[]) =>
      tutorialPages('drive', data, { mission: 'moon', instruments }).flatMap((p) => p.paragraphs).join('\n');
    expect(drive('camera')).toContain(`${data.tuning.ground.maxSlopeDegrees}°`);
    expect(drive('camera')).toContain(`at least ${data.tuning.milestones.earthPhotoMinDistanceM} m from the lander`);
    expect(drive('camera')).toContain('Camera: 1 ');
    expect(drive('camera')).not.toContain('Drill:');
    expect(drive('drill')).toContain(`at least ${data.tuning.milestones.sampleSpacingM} m from the lander and from each other`);
    expect(drive('drill', 'camera')).toContain('press 1 ');
    expect(drive('drill', 'camera')).toContain('Camera: 2 ');
    expect(drive()).not.toMatch(/Camera:|Drill:/);
    const design = tutorialPages('design', data, { mission: 'moon', instruments: [] }).flatMap((p) => p.paragraphs).join('\n');
    for (const tier of data.tiers.tiers) expect(design).toContain(`${tier.massLimit} kg`);
  });
});
