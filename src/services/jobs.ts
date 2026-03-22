import type { Api } from 'grammy';
import pool from '../db/connection';
import config from '../config';

const JOB_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface AffectedDriver {
  telegram_id: number;
  name: string;
}

export async function resetExpiredDrivers(api: Api): Promise<void> {
  const { rows } = await pool.query<AffectedDriver>(
    `UPDATE drivers
     SET status = 'offline'
     WHERE status = 'available'
       AND location_updated_at < NOW() - INTERVAL '${config.LOCATION_EXPIRY_HOURS} hours'
     RETURNING telegram_id, name`
  );

  for (const driver of rows) {
    await api
      .sendMessage(
        driver.telegram_id,
        '🔴 Your live location has expired and you have been set to Offline.\n\nTap 🟢 Go Online and share your live location again to become visible to riders.'
      )
      .catch(() => {});
  }
}

export async function sendExpiryReminders(api: Api): Promise<void> {
  // Remind drivers whose live location was started between 6h30m and 7h30m ago
  // (i.e. ~1 hour before Telegram's 8h live location window ends)
  const { rows } = await pool.query<AffectedDriver>(
    `SELECT telegram_id, name FROM drivers
     WHERE status = 'available'
       AND location_share_started_at IS NOT NULL
       AND location_share_started_at < NOW() - INTERVAL '6 hours 30 minutes'
       AND location_share_started_at > NOW() - INTERVAL '7 hours 30 minutes'`
  );

  for (const driver of rows) {
    await api
      .sendMessage(
        driver.telegram_id,
        '⚠️ Your live location will expire in about 1 hour.\n\nTo stay visible to riders, tap 🟢 Go Online again and re-share your live location before it runs out.'
      )
      .catch(() => {});
  }
}

export function startBackgroundJobs(api: Api): void {
  const run = async () => {
    await resetExpiredDrivers(api).catch(() => {});
    await sendExpiryReminders(api).catch(() => {});
  };

  setInterval(run, JOB_INTERVAL_MS);
}
