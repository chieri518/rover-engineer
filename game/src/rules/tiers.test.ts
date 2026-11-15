import { describe, expect, it } from 'vitest';
import { explainTier, ticketTier } from './tiers';
import { testTiers } from './testData';

describe('ticket tier', () => {
  it('picks the smallest tier that fits', () => {
    expect(ticketTier(50, 15, testTiers)?.id).toBe('small');
    expect(ticketTier(70, 22, testTiers)?.id).toBe('medium');
    expect(ticketTier(95, 27, testTiers)?.id).toBe('large');
  });

  it('includes the limit itself', () => {
    expect(ticketTier(60, 20, testTiers)?.id).toBe('small');
  });

  it('moves up a tier when either mass or size exceeds the limit', () => {
    expect(ticketTier(61, 10, testTiers)?.id).toBe('medium'); // mass only
    expect(ticketTier(40, 21, testTiers)?.id).toBe('medium'); // size only
    expect(ticketTier(40, 25, testTiers)?.id).toBe('large');
  });

  it('returns null over the top tier: the rover cannot launch', () => {
    expect(ticketTier(101, 10, testTiers)).toBeNull();
    expect(ticketTier(50, 29, testTiers)).toBeNull();
  });
});

describe('tier explanation', () => {
  it('fits the smallest tier with nothing exceeded', () => {
    const e = explainTier(50, 15, testTiers);
    expect(e.tier?.id).toBe('small');
    expect(e.exceeded).toBeNull();
    expect(e.saving).toBe(0);
    expect(e.fits.map((f) => f.fits)).toEqual([true, true, true]);
  });

  it('names the limit that pushed the rover up a tier, and the saving from trimming', () => {
    const byMass = explainTier(70, 10, testTiers); // over Small on mass only
    expect(byMass.tier?.id).toBe('medium');
    expect(byMass.exceeded?.tier.id).toBe('small');
    expect(byMass.exceeded).toMatchObject({ massOver: 10, sizeOver: 0 });
    expect(byMass.saving).toBe(160 - 80);

    const bySize = explainTier(70, 26, testTiers); // over Medium on size only (Small on both)
    expect(bySize.tier?.id).toBe('large');
    expect(bySize.exceeded).toMatchObject({ massOver: 0, sizeOver: 2 });
    expect(bySize.exceeded?.tier.id).toBe('medium');
  });

  it('explains a rover over the top tier with the top tier limits', () => {
    const e = explainTier(110, 30, testTiers);
    expect(e.tier).toBeNull();
    expect(e.exceeded?.tier.id).toBe('large');
    expect(e.exceeded).toMatchObject({ massOver: 10, sizeOver: 2 });
    expect(e.saving).toBe(0);
  });

  it('agrees with ticketTier', () => {
    for (const [m, s] of [[60, 20], [61, 20], [80, 24], [81, 1], [100, 28], [101, 28]] as const) {
      expect(explainTier(m, s, testTiers).tier).toBe(ticketTier(m, s, testTiers));
    }
  });
});
