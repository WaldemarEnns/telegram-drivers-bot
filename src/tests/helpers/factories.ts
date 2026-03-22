import { create } from '../../services/drivers';
import type { CreateDriverInput } from '../../services/drivers';

// seq is module-scoped; resets per test file (Vitest isolates module registries
// between files). This guarantees unique telegram_ids within each file.
let seq = 0;

export function buildDriverInput(overrides: Partial<CreateDriverInput> = {}): CreateDriverInput {
  seq++;
  return {
    telegramId: 10000 + seq,
    name: `Driver ${seq}`,
    phone: `+123456${String(seq).padStart(5, '0')}`,
    vehicleType: 'car',
    seats: 4,
    vehicleNumber: `T${String(seq).padStart(4, '0')}`,
    referralCode: `t${String(seq).padStart(7, '0')}`,
    referredBy: null,
    ...overrides,
  };
}

export async function createTestDriver(overrides: Partial<CreateDriverInput> = {}) {
  return create(buildDriverInput(overrides));
}
