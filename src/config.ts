import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const config = Object.freeze({
  BOT_TOKEN: requireEnv('BOT_TOKEN'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  ADMIN_IDS: requireEnv('ADMIN_IDS')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id)),
  SEARCH_RADIUS_M: (parseFloat(process.env.SEARCH_RADIUS_KM ?? '10') || 10) * 1000,
  MAX_RESULTS: parseInt(process.env.MAX_RESULTS ?? '10') || 10,
  LOCATION_EXPIRY_HOURS: parseInt(process.env.LOCATION_EXPIRY_HOURS ?? '1') || 1,
});

export default config;
