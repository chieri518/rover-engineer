import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { buildLeads, buildSites, type SurveyFeatures } from '../rules/survey';
import { resolveSites } from '../rules/sites';
import terrain from '../../public/terrain/terrain.json';
import { briefingLines, hudLeadLine, kmText } from './surveyText';

const data = loadGameData();
const leads = buildLeads(buildSites(terrain.features as unknown as SurveyFeatures, data.tuning.milestones, data.text.survey.shadowedCraterName, resolveSites(data.sites.sites, terrain.features as never)), data.tuning.survey);

describe('survey text', () => {
  it('writes km without a trailing zero', () => {
    expect(kmText(3)).toBe('3');
    expect(kmText(0.30000000000000004)).toBe('0.3');
    expect(kmText(2.5)).toBe('2.5');
  });

  it('briefs each lead as a rough direction and distance from the lander', () => {
    const lines = briefingLines(leads, terrain.landing.local, data);
    expect(lines).toHaveLength(4);
    for (const l of lines) expect(l).not.toMatch(/\{\w+\}/);
    expect(lines.join('\n')).toContain('Permanent shadow: about 3 km north.');
    expect(lines.join('\n')).toContain('Boulder field: about 0.3 km west-northwest.');
    expect(lines.join('\n')).toContain('Layered wall exposure: about 0.7 km south-southwest.');
    expect(lines.join('\n')).toContain('Young crater: about 0.5 km east-northeast.');
  });

  it('numbers the live lines under the map', () => {
    expect(hudLeadLine(leads[2]!, 2, terrain.landing.local, data)).toBe('3. Permanent shadow: 3 km N');
  });
});
