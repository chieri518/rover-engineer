import { describe, expect, it } from 'vitest';
import { loadGameData } from '../gameData';
import { instrumentSources, relationshipSources } from './creditsScreen';

const moon = loadGameData('moon');
const mars = loadGameData('mars');

describe('credits per world (Mars step 8)', () => {
  it('the Moon lists every instrument fact (the four new Moon instruments) and only the Moon relationships', () => {
    const names = instrumentSources(moon, moon).map(([name]) => name);
    expect(names).toEqual(['Neutron spectrometer', 'X-ray spectrometer', 'Seismometer station', 'Laser retroreflector']);
    const sources = relationshipSources(moon);
    for (const r of moon.relationships.relationships.filter((x) => x.world === 'mars')) expect(sources).not.toContain(r.source);
    expect(sources.length).toBeGreaterThan(0);
  });

  it('Mars lists its own instrument facts (the four new ones and the X-ray), not the Moon facts again', () => {
    const list = instrumentSources(mars, moon);
    const names = list.map(([name]) => name);
    for (const name of ['Weather mast', 'Ground-penetrating radar', 'Laser spectrometer', 'Organics spectrometer', 'X-ray spectrometer']) expect(names).toContain(name);
    const moonSources = new Set(instrumentSources(moon, moon).map(([, s]) => s));
    for (const [, source] of list) expect(moonSources.has(source)).toBe(false);
  });

  it('Mars lists the sources behind its four lessons, and no Moon one', () => {
    const sources = relationshipSources(mars);
    const marsRel = mars.relationships.relationships.filter((r) => r.world === 'mars');
    expect(marsRel.length).toBe(4);
    for (const r of marsRel) expect(sources).toContain(r.source);
    for (const r of mars.relationships.relationships.filter((x) => x.world === 'moon')) expect(sources).not.toContain(r.source);
  });

  it('Mars credits its new parts by their names, and has its own placed-by-design note', () => {
    const c = mars.text.credits;
    const partNames = new Set(mars.parts.parts.map((p) => p.name));
    expect(c.partEntries?.length).toBeGreaterThan(0);
    for (const e of c.partEntries ?? []) {
      expect(partNames.has(e.label), e.label).toBe(true);
      expect(e.citation?.length ?? 0, e.label).toBeGreaterThan(10);
      // Lesson-blind: the RTG says nothing about neutrons, the arrays nothing about dust, the arm nothing about slopes.
      expect(`${e.text} ${e.citation}`, e.label).not.toMatch(/neutron|dust|slope|level|steep/i);
    }
    expect(moon.text.credits.partEntries).toBeUndefined();
    expect(c.generated).not.toBe(moon.text.credits.generated);
    expect(c.generated).toMatch(/flood boulder/);
  });
});
