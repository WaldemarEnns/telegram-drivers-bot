import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Api } from 'grammy';
import pool from '../../db/connection';
import { resetExpiredDrivers, sendExpiryReminders } from '../../services/jobs';
import { approve } from '../../services/drivers';
import { updateDriverLocation } from '../../services/location';
import { createTestDriver } from '../helpers/factories';
import { server, sentMessages } from '../setup/mswHandlers';

// Real grammy Api instance whose HTTP calls MSW intercepts
const api = new Api('test:FAKE_TOKEN_FOR_MSW');

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
beforeEach(() => { sentMessages.length = 0; });

describe('resetExpiredDrivers', () => {
  it('sets expired available drivers to offline and notifies them', async () => {
    const d = await createTestDriver();
    await approve(d.id);
    await pool.query(
      `UPDATE drivers
       SET status = 'available',
           location_updated_at = NOW() - INTERVAL '2 hours'
       WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await resetExpiredDrivers(api);

    const { rows } = await pool.query(
      'SELECT status FROM drivers WHERE telegram_id = $1',
      [d.telegram_id]
    );
    expect(rows[0].status).toBe('offline');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].chat_id).toBe(d.telegram_id);
    expect(sentMessages[0].text).toContain('expired');
  });

  it('does not touch drivers with a recent location update', async () => {
    const d = await createTestDriver();
    await approve(d.id);
    await updateDriverLocation(d.telegram_id, 8.2039, 48.8589);
    await pool.query(
      `UPDATE drivers SET status = 'available' WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await resetExpiredDrivers(api);

    const { rows } = await pool.query(
      'SELECT status FROM drivers WHERE telegram_id = $1',
      [d.telegram_id]
    );
    expect(rows[0].status).toBe('available');
    expect(sentMessages).toHaveLength(0);
  });

  it('does not affect offline drivers', async () => {
    const d = await createTestDriver();
    await pool.query(
      `UPDATE drivers SET location_updated_at = NOW() - INTERVAL '2 hours' WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await resetExpiredDrivers(api);
    expect(sentMessages).toHaveLength(0);
  });

  it('handles multiple expired drivers in one run', async () => {
    for (let i = 0; i < 3; i++) {
      const d = await createTestDriver();
      await approve(d.id);
      await pool.query(
        `UPDATE drivers
         SET status = 'available',
             location_updated_at = NOW() - INTERVAL '2 hours'
         WHERE telegram_id = $1`,
        [d.telegram_id]
      );
    }

    await resetExpiredDrivers(api);
    expect(sentMessages).toHaveLength(3);
  });
});

describe('sendExpiryReminders', () => {
  it('notifies available drivers in the 6h30m–7h30m window', async () => {
    const d = await createTestDriver();
    await approve(d.id);
    await pool.query(
      `UPDATE drivers
       SET status = 'available',
           location_share_started_at = NOW() - INTERVAL '7 hours'
       WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await sendExpiryReminders(api);

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].chat_id).toBe(d.telegram_id);
    expect(sentMessages[0].text).toContain('expire');
  });

  it('does not notify drivers outside the reminder window', async () => {
    const d = await createTestDriver();
    await approve(d.id);
    // 5 hours ago — too early to remind
    await pool.query(
      `UPDATE drivers
       SET status = 'available',
           location_share_started_at = NOW() - INTERVAL '5 hours'
       WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await sendExpiryReminders(api);
    expect(sentMessages).toHaveLength(0);
  });

  it('does not notify offline drivers', async () => {
    const d = await createTestDriver();
    await pool.query(
      `UPDATE drivers
       SET status = 'offline',
           location_share_started_at = NOW() - INTERVAL '7 hours'
       WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await sendExpiryReminders(api);
    expect(sentMessages).toHaveLength(0);
  });

  it('does not notify drivers past the reminder window', async () => {
    const d = await createTestDriver();
    await approve(d.id);
    await pool.query(
      `UPDATE drivers
       SET status = 'available',
           location_share_started_at = NOW() - INTERVAL '8 hours 30 minutes'
       WHERE telegram_id = $1`,
      [d.telegram_id]
    );

    await sendExpiryReminders(api);
    expect(sentMessages).toHaveLength(0);
  });
});
