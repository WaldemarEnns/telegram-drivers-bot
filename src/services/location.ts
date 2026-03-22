import pool from '../db/connection';
import config from '../config';
import type { VehicleType } from './drivers';

export interface NearbyDriver {
  id: number;
  name: string;
  phone: string;
  vehicle_type: VehicleType;
  seats: number;
  vehicle_number: string;
  distance_m: number;
}

export async function updateDriverLocation(
  telegramId: number,
  longitude: number,
  latitude: number,
  isInitial = false
): Promise<void> {
  await pool.query(
    `UPDATE drivers
     SET location = ST_MakePoint($1, $2)::geography,
         location_updated_at = NOW()
         ${isInitial ? ', location_share_started_at = NOW()' : ''}
     WHERE telegram_id = $3`,
    [longitude, latitude, telegramId]
  );
}

export async function findNearbyDrivers(
  longitude: number,
  latitude: number,
  vehicleType: VehicleType | null
): Promise<NearbyDriver[]> {
  const { rows } = await pool.query<NearbyDriver>(
    `SELECT
       d.id, d.name, d.phone, d.vehicle_type, d.seats, d.vehicle_number,
       ROUND(ST_Distance(
         d.location,
         ST_MakePoint($1, $2)::geography
       )::numeric, 0)::float8 AS distance_m
     FROM drivers d
     WHERE d.status = 'available'
       AND d.is_approved = true
       AND d.is_enabled = true
       AND d.location IS NOT NULL
       AND d.location_updated_at > NOW() - INTERVAL '${config.LOCATION_EXPIRY_HOURS} hours'
       AND ST_DWithin(d.location, ST_MakePoint($1, $2)::geography, $3)
       AND ($4::vehicle_type IS NULL OR d.vehicle_type = $4::vehicle_type)
     ORDER BY distance_m ASC
     LIMIT $5`,
    [longitude, latitude, config.SEARCH_RADIUS_M, vehicleType, config.MAX_RESULTS]
  );
  return rows;
}
