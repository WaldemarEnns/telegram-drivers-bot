import crypto from 'crypto';
import pool from '../db/connection';

export function generateCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

export async function createReferral(
  referrerDriverId: number,
  referredDriverId: number
): Promise<void> {
  await pool.query(
    `INSERT INTO referrals (referrer_driver_id, referred_driver_id)
     VALUES ($1, $2)
     ON CONFLICT (referred_driver_id) DO NOTHING`,
    [referrerDriverId, referredDriverId]
  );
}

export async function getReferralCount(driverId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) FROM referrals WHERE referrer_driver_id = $1',
    [driverId]
  );
  return parseInt(rows[0].count, 10);
}

export async function findDriverByReferralCode(
  code: string
): Promise<{ id: number } | null> {
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM drivers WHERE referral_code = $1',
    [code]
  );
  return rows[0] ?? null;
}

export function getInviteLink(referralCode: string, botUsername: string): string {
  return `https://t.me/${botUsername}?start=ref_${referralCode}`;
}
