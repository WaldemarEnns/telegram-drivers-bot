import pool from '../db/connection';

export type VehicleType = 'car' | 'tuk' | 'van' | 'suv';
export type DriverStatus = 'available' | 'busy' | 'offline';

export interface Driver {
  id: number;
  telegram_id: number;
  name: string;
  phone: string;
  vehicle_type: VehicleType;
  seats: number;
  vehicle_number: string;
  status: DriverStatus;
  location: unknown;
  location_updated_at: Date | null;
  is_approved: boolean;
  is_enabled: boolean;
  referral_code: string;
  referred_by: number | null;
  created_at: Date;
}

export interface CreateDriverInput {
  telegramId: number;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  seats: number;
  vehicleNumber: string;
  referralCode: string;
  referredBy: number | null;
}

export async function create(input: CreateDriverInput): Promise<Driver> {
  const { rows } = await pool.query<Driver>(
    `INSERT INTO drivers (telegram_id, name, phone, vehicle_type, seats, vehicle_number, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.telegramId,
      input.name,
      input.phone,
      input.vehicleType,
      input.seats,
      input.vehicleNumber,
      input.referralCode,
      input.referredBy,
    ]
  );
  return rows[0];
}

export async function findByTelegramId(telegramId: number): Promise<Driver | null> {
  const { rows } = await pool.query<Driver>(
    'SELECT * FROM drivers WHERE telegram_id = $1',
    [telegramId]
  );
  return rows[0] ?? null;
}

export async function findById(id: number): Promise<Driver | null> {
  const { rows } = await pool.query<Driver>(
    'SELECT * FROM drivers WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function updateStatus(telegramId: number, status: DriverStatus): Promise<void> {
  await pool.query(
    'UPDATE drivers SET status = $1 WHERE telegram_id = $2',
    [status, telegramId]
  );
}

export async function approve(driverId: number): Promise<Driver | null> {
  const { rows } = await pool.query<Driver>(
    'UPDATE drivers SET is_approved = true WHERE id = $1 RETURNING *',
    [driverId]
  );
  return rows[0] ?? null;
}

export async function disable(driverId: number): Promise<Driver | null> {
  const { rows } = await pool.query<Driver>(
    "UPDATE drivers SET is_enabled = false, status = 'offline' WHERE id = $1 RETURNING *",
    [driverId]
  );
  return rows[0] ?? null;
}

export async function enable(driverId: number): Promise<Driver | null> {
  const { rows } = await pool.query<Driver>(
    'UPDATE drivers SET is_enabled = true WHERE id = $1 RETURNING *',
    [driverId]
  );
  return rows[0] ?? null;
}

export interface DriverUpdate {
  name?: string;
  phone?: string;
  vehicle_type?: VehicleType;
  seats?: number;
  vehicle_number?: string;
}

export async function updateDriver(telegramId: number, fields: DriverUpdate): Promise<Driver | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fields.name !== undefined)           { setClauses.push(`name = $${idx++}`);           values.push(fields.name); }
  if (fields.phone !== undefined)          { setClauses.push(`phone = $${idx++}`);          values.push(fields.phone); }
  if (fields.vehicle_type !== undefined)   { setClauses.push(`vehicle_type = $${idx++}`);   values.push(fields.vehicle_type); }
  if (fields.seats !== undefined)          { setClauses.push(`seats = $${idx++}`);          values.push(fields.seats); }
  if (fields.vehicle_number !== undefined) { setClauses.push(`vehicle_number = $${idx++}`); values.push(fields.vehicle_number); }

  if (!setClauses.length) return null;
  values.push(telegramId);

  const { rows } = await pool.query<Driver>(
    `UPDATE drivers SET ${setClauses.join(', ')} WHERE telegram_id = $${idx} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function getAll(): Promise<Driver[]> {
  const { rows } = await pool.query<Driver>(
    'SELECT id, telegram_id, name, status, is_approved, is_enabled, vehicle_type FROM drivers ORDER BY id'
  );
  return rows;
}
