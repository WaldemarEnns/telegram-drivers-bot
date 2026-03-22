import pool from '../db/connection';

export async function upsertRider(telegramId: number): Promise<void> {
  await pool.query(
    `INSERT INTO riders (telegram_id) VALUES ($1) ON CONFLICT (telegram_id) DO NOTHING`,
    [telegramId]
  );
}
