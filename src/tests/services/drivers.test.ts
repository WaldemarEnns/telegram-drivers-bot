import { describe, it, expect } from 'vitest';
import {
  create,
  findByTelegramId,
  findById,
  updateStatus,
  approve,
  disable,
  enable,
  updateDriver,
  getAll,
} from '../../services/drivers';
import { buildDriverInput, createTestDriver } from '../helpers/factories';

describe('drivers', () => {
  describe('create', () => {
    it('creates a driver with correct defaults', async () => {
      const driver = await createTestDriver();
      expect(driver.status).toBe('offline');
      expect(driver.is_approved).toBe(false);
      expect(driver.is_enabled).toBe(true);
      expect(driver.location).toBeNull();
      expect(driver.location_updated_at).toBeNull();
    });

    it('rejects duplicate telegram_id', async () => {
      const input = buildDriverInput({ telegramId: 99001 });
      await create(input);
      await expect(create({ ...input, referralCode: 'uniqueref' })).rejects.toThrow();
    });

    it('rejects duplicate referral_code', async () => {
      const input = buildDriverInput({ referralCode: 'dupcode1' });
      await create(input);
      await expect(create({ ...input, telegramId: input.telegramId + 1 })).rejects.toThrow();
    });
  });

  describe('findByTelegramId', () => {
    it('returns null for unknown id', async () => {
      expect(await findByTelegramId(1)).toBeNull();
    });

    it('returns the driver when found', async () => {
      const d = await createTestDriver();
      const found = await findByTelegramId(d.telegram_id);
      expect(found?.id).toBe(d.id);
      expect(found?.name).toBe(d.name);
    });
  });

  describe('findById', () => {
    it('returns null for unknown id', async () => {
      expect(await findById(99999)).toBeNull();
    });

    it('returns driver by numeric id', async () => {
      const d = await createTestDriver();
      expect((await findById(d.id))?.telegram_id).toBe(d.telegram_id);
    });
  });

  describe('updateStatus', () => {
    it('changes driver status', async () => {
      const d = await createTestDriver();
      await updateStatus(d.telegram_id, 'available');
      expect((await findByTelegramId(d.telegram_id))?.status).toBe('available');
    });

    it('is a no-op for unknown telegram_id', async () => {
      await expect(updateStatus(0, 'available')).resolves.not.toThrow();
    });
  });

  describe('approve', () => {
    it('sets is_approved = true', async () => {
      const d = await createTestDriver();
      expect((await approve(d.id))?.is_approved).toBe(true);
    });

    it('returns null for unknown id', async () => {
      expect(await approve(99999)).toBeNull();
    });
  });

  describe('disable', () => {
    it('sets is_enabled = false and forces status to offline', async () => {
      const d = await createTestDriver();
      await updateStatus(d.telegram_id, 'available');
      const result = await disable(d.id);
      expect(result?.is_enabled).toBe(false);
      expect(result?.status).toBe('offline');
    });

    it('returns null for unknown id', async () => {
      expect(await disable(99999)).toBeNull();
    });
  });

  describe('enable', () => {
    it('sets is_enabled = true', async () => {
      const d = await createTestDriver();
      await disable(d.id);
      expect((await enable(d.id))?.is_enabled).toBe(true);
    });

    it('returns null for unknown id', async () => {
      expect(await enable(99999)).toBeNull();
    });
  });

  describe('updateDriver', () => {
    it('updates only the supplied fields', async () => {
      const d = await createTestDriver({ name: 'Old Name' });
      const updated = await updateDriver(d.telegram_id, { name: 'New Name' });
      expect(updated?.name).toBe('New Name');
      expect(updated?.phone).toBe(d.phone);
    });

    it('returns null when no fields are provided', async () => {
      const d = await createTestDriver();
      expect(await updateDriver(d.telegram_id, {})).toBeNull();
    });

    it('returns null for unknown telegram_id', async () => {
      expect(await updateDriver(0, { name: 'X' })).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns empty array when no drivers exist', async () => {
      expect(await getAll()).toHaveLength(0);
    });

    it('returns all drivers ordered by id ascending', async () => {
      await createTestDriver();
      await createTestDriver();
      const all = await getAll();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBeLessThan(all[1].id);
    });
  });
});
