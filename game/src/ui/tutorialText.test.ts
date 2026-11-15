import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import type { Instrument } from '../rules/types';
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
    const drive = (...instruments: Instrument[]) =>
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

  it('has a line for each of the six instruments, keyed in bay order', () => {
    const all: Instrument[] = ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'];
    const pages = tutorialPages('drive', data, { mission: 'moon', instruments: all });
    const text = pages.flatMap((p) => p.paragraphs).join('\n');
    for (const [i, name] of ['Camera', 'Drill', 'Neutron spectrometer', 'X-ray spectrometer', 'Seismometer station', 'Laser retroreflector'].entries()) {
      expect(text).toContain(`${name}: `);
      expect(text).toMatch(new RegExp(`${name}: [^\\n]*\\b${i + 1}\\b`));
    }
  });

  it('covers the bay, the review and the notebook, and announces no relationship', () => {
    const join = (id: 'design' | 'drive') =>
      tutorialPages(id, data, { mission: 'moon', instruments: ['camera', 'drill', 'neutron', 'xray', 'seismometer', 'reflector'] })
        .flatMap((p) => [p.title, ...p.paragraphs]).join('\n');
    const design = join('design');
    expect(design).toContain('mounting point');
    expect(design).toContain('No instruments');
    expect(design).toContain('pre-launch review');
    expect(design).toMatch(/energy/i);
    const drive = join('drive');
    expect(drive).toContain('engineering notebook');
    expect(drive).toMatch(/\bN\b/);
    expect(drive).toMatch(/pauses/);
    for (const text of [design, drive]) {
      expect(text).not.toMatch(/noise|noisy|quiet|slow(ly|s) .*cold|sharper|colder detector|drive away/i);
    }
  });
});
