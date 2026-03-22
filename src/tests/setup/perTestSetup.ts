import { beforeEach, afterAll } from 'vitest';
import pool from '../../db/connection';

beforeEach(async () => {
  // Truncate in FK-safe order; RESTART IDENTITY resets SERIAL sequences so
  // auto-generated id values start from 1 in every test.
  await pool.query('TRUNCATE TABLE referrals, riders, drivers RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
