import fs from 'fs';
import path from 'path';
import pool from './connection';

async function migrate(): Promise<void> {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
  await pool.query(sql);
}

export default migrate;
