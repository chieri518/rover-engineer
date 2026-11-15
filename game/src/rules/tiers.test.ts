import { describe, expect, it } from 'vitest';
import { ticketTier } from './tiers';
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
