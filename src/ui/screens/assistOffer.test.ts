import { describe, expect, it } from 'vitest';
import { shouldOfferAssist } from './death.ts';

describe('the Assist offer (06 §5.4)', () => {
  const s = (deaths: number, stage1Cleared = false, assistOffered = false) => ({ stats: { deaths }, progress: { stage1Cleared, assistOffered } });
  it('shows at the 5th death before the Great Boar was ever beaten, once', () => {
    expect(shouldOfferAssist(s(4))).toBe(false); expect(shouldOfferAssist(s(5))).toBe(true);
    expect(shouldOfferAssist(s(9, true))).toBe(false); expect(shouldOfferAssist(s(9, false, true))).toBe(false);
  });
});
