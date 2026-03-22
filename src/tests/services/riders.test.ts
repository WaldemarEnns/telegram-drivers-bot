import { describe, it, expect } from 'vitest';
import pool from '../../db/connection';
import { upsertRider } from '../../services/riders';

describe('riders', () => {
  describe('upsertRider', () => {
    it('inserts a new rider', async () => {
      await upsertRider(88001);
      const { rows } = await pool.query(
        'SELECT telegram_id FROM riders WHERE telegram_id = $1',
        [88001]
      );
      expect(rows).toHaveLength(1);
    });

    it('is idempotent on duplicate telegram_id', async () => {
      await upsertRider(88002);
      await expect(upsertRider(88002)).resolves.not.toThrow();
      const { rows } = await pool.query(
        'SELECT telegram_id FROM riders WHERE telegram_id = $1',
        [88002]
      );
      expect(rows).toHaveLength(1);
    });
  });
});
