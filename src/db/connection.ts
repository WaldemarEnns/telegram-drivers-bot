import { Pool } from 'pg';
import config from '../config';

const pool = new Pool({ connectionString: config.DATABASE_URL });

pool.on('error', (_err) => {
  // Idle client error — log and continue, do not crash
});

export default pool;
