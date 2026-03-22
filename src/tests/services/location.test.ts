import { describe, it, expect } from 'vitest';
import pool from '../../db/connection';
import { updateDriverLocation, findNearbyDrivers } from '../../services/location';
import { approve, disable, updateStatus } from '../../services/drivers';
import { createTestDriver } from '../helpers/factories';

// Rastatt, Germany — matches the dev seed data
const LNG = 8.2039;
const LAT = 48.8589;

async function seedAvailableDriver(
  lng = LNG,
  lat = LAT,
  overrides: Parameters<typeof createTestDriver>[0] = {}
) {
  const d = await createTestDriver(overrides);
  await approve(d.id);
  await updateStatus(d.telegram_id, 'available');
  await updateDriverLocation(d.telegram_id, lng, lat);
  return d;
}

describe('location', () => {
  describe('updateDriverLocation', () => {
    it('sets location_updated_at', async () => {
      const d = await createTestDriver();
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      const { rows } = await pool.query(
        'SELECT location_updated_at FROM drivers WHERE telegram_id = $1',
        [d.telegram_id]
      );
      expect(rows[0].location_updated_at).not.toBeNull();
    });

    it('sets location_share_started_at when isInitial = true', async () => {
      const d = await createTestDriver();
      await updateDriverLocation(d.telegram_id, LNG, LAT, true);
      const { rows } = await pool.query(
        'SELECT location_share_started_at FROM drivers WHERE telegram_id = $1',
        [d.telegram_id]
      );
      expect(rows[0].location_share_started_at).not.toBeNull();
    });

    it('does not set location_share_started_at by default', async () => {
      const d = await createTestDriver();
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      const { rows } = await pool.query(
        'SELECT location_share_started_at FROM drivers WHERE telegram_id = $1',
        [d.telegram_id]
      );
      expect(rows[0].location_share_started_at).toBeNull();
    });
  });

  describe('findNearbyDrivers', () => {
    it('returns a nearby available approved driver', async () => {
      await seedAvailableDriver();
      const results = await findNearbyDrivers(LNG, LAT, null);
      expect(results).toHaveLength(1);
      expect(results[0].distance_m).toBeLessThanOrEqual(10);
    });

    it('excludes drivers beyond the search radius', async () => {
      // Frankfurt — ~80 km from Rastatt, well outside the 10 km radius
      await seedAvailableDriver(8.6821, 50.1109);
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('excludes unapproved drivers', async () => {
      const d = await createTestDriver();
      await updateStatus(d.telegram_id, 'available');
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      // NOT approved
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('excludes disabled drivers', async () => {
      const d = await createTestDriver();
      await approve(d.id);
      await updateStatus(d.telegram_id, 'available');
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      await disable(d.id);
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('excludes offline drivers', async () => {
      const d = await createTestDriver();
      await approve(d.id);
      // status stays 'offline' by default
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('excludes busy drivers', async () => {
      const d = await createTestDriver();
      await approve(d.id);
      await updateStatus(d.telegram_id, 'busy');
      await updateDriverLocation(d.telegram_id, LNG, LAT);
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('excludes drivers with stale location', async () => {
      const d = await createTestDriver();
      await approve(d.id);
      await pool.query(
        `UPDATE drivers
         SET status = 'available',
             location = ST_MakePoint($1, $2)::geography,
             location_updated_at = NOW() - INTERVAL '2 hours'
         WHERE telegram_id = $3`,
        [LNG, LAT, d.telegram_id]
      );
      // LOCATION_EXPIRY_HOURS=1 in test env; 2 hours old should be excluded
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(0);
    });

    it('filters by vehicle type', async () => {
      await seedAvailableDriver(LNG, LAT, { vehicleType: 'tuk' });
      await seedAvailableDriver(LNG + 0.001, LAT, { vehicleType: 'van' });
      const tuks = await findNearbyDrivers(LNG, LAT, 'tuk');
      expect(tuks).toHaveLength(1);
      expect(tuks[0].vehicle_type).toBe('tuk');
    });

    it('returns all types when vehicleType is null', async () => {
      await seedAvailableDriver(LNG, LAT, { vehicleType: 'car' });
      await seedAvailableDriver(LNG + 0.001, LAT, { vehicleType: 'van' });
      expect(await findNearbyDrivers(LNG, LAT, null)).toHaveLength(2);
    });

    it('sorts results by distance ascending', async () => {
      await seedAvailableDriver(LNG + 0.02, LAT); // further east
      await seedAvailableDriver(LNG, LAT);         // same point as query
      const results = await findNearbyDrivers(LNG, LAT, null);
      expect(results[0].distance_m).toBeLessThanOrEqual(results[1].distance_m);
    });

    it('returns distance_m as a number', async () => {
      await seedAvailableDriver();
      const results = await findNearbyDrivers(LNG, LAT, null);
      expect(Number.isFinite(results[0].distance_m)).toBe(true);
    });
  });
});
