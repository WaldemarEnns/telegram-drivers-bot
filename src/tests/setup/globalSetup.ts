import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// These run in the main Vitest process, NOT in the worker — use standalone pools,
// not the singleton from src/db/connection.ts (which doesn't exist here).
const ADMIN_URL = 'postgresql://taxibot:taxibot_dev_password@localhost:5432/taxi_bot';
const TEST_URL = 'postgresql://taxibot:taxibot_dev_password@localhost:5432/taxi_bot_test';

export async function setup(): Promise<void> {
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  try {
    const { rows } = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = 'taxi_bot_test'`
    );
    if (!rows.length) {
      // CREATE DATABASE cannot run inside a transaction; pool.query() auto-commits DDL
      await adminPool.query('CREATE DATABASE taxi_bot_test OWNER taxibot');
    }
  } finally {
    await adminPool.end();
  }

  const testPool = new Pool({ connectionString: TEST_URL });
  try {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'src/db/migrations.sql'),
      'utf8'
    );
    await testPool.query(sql);
  } finally {
    await testPool.end();
  }
}
