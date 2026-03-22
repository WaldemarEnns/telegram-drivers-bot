import { describe, it, expect } from 'vitest';
import {
  generateCode,
  createReferral,
  getReferralCount,
  findDriverByReferralCode,
  getInviteLink,
} from '../../services/referral';
import { createTestDriver } from '../helpers/factories';

describe('referral', () => {
  describe('generateCode (pure)', () => {
    it('returns an 8-character hex string', () => {
      expect(generateCode()).toMatch(/^[0-9a-f]{8}$/);
    });

    it('generates unique codes on successive calls', () => {
      const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
      expect(codes.size).toBe(50);
    });
  });

  describe('getInviteLink (pure)', () => {
    it('constructs the correct deep link URL', () => {
      expect(getInviteLink('abc12345', 'mytaxibot')).toBe(
        'https://t.me/mytaxibot?start=ref_abc12345'
      );
    });
  });

  describe('findDriverByReferralCode', () => {
    it('returns null for an unknown code', async () => {
      expect(await findDriverByReferralCode('nosuchcode')).toBeNull();
    });

    it('returns the driver id for a known code', async () => {
      const d = await createTestDriver({ referralCode: 'findme01' });
      expect((await findDriverByReferralCode('findme01'))?.id).toBe(d.id);
    });
  });

  describe('createReferral', () => {
    it('creates a referral record', async () => {
      const referrer = await createTestDriver();
      const referred = await createTestDriver();
      await createReferral(referrer.id, referred.id);
      expect(await getReferralCount(referrer.id)).toBe(1);
    });

    it('is idempotent — second referrer for the same referred driver is silently ignored', async () => {
      const r1 = await createTestDriver();
      const r2 = await createTestDriver();
      const referred = await createTestDriver();
      await createReferral(r1.id, referred.id);
      await expect(createReferral(r2.id, referred.id)).resolves.not.toThrow();
      // The first referrer keeps the credit; the second gets none
      expect(await getReferralCount(r1.id)).toBe(1);
      expect(await getReferralCount(r2.id)).toBe(0);
    });
  });

  describe('getReferralCount', () => {
    it('returns 0 for a driver with no referrals', async () => {
      const d = await createTestDriver();
      expect(await getReferralCount(d.id)).toBe(0);
    });

    it('counts multiple referred drivers correctly', async () => {
      const referrer = await createTestDriver();
      const r1 = await createTestDriver();
      const r2 = await createTestDriver();
      await createReferral(referrer.id, r1.id);
      await createReferral(referrer.id, r2.id);
      expect(await getReferralCount(referrer.id)).toBe(2);
    });
  });
});
