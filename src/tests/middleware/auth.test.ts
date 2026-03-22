import { describe, it, expect, vi } from 'vitest';
import { loadDriver, adminOnly } from '../../middleware/auth';
import { createTestDriver } from '../helpers/factories';
import type { BotContext } from '../../types';

function makeCtx(fromId: number | undefined) {
  return {
    from: fromId !== undefined ? ({ id: fromId } as { id: number }) : undefined,
    driver: null as BotContext['driver'],
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('loadDriver', () => {
  it('sets ctx.driver to null when ctx.from is absent', async () => {
    const ctx = makeCtx(undefined);
    const next = vi.fn().mockResolvedValue(undefined);
    await loadDriver(ctx as unknown as BotContext, next);
    expect(ctx.driver).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets ctx.driver to null for an unknown telegram_id', async () => {
    const ctx = makeCtx(1);
    const next = vi.fn().mockResolvedValue(undefined);
    await loadDriver(ctx as unknown as BotContext, next);
    expect(ctx.driver).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it('populates ctx.driver for a known driver', async () => {
    const d = await createTestDriver();
    const ctx = makeCtx(d.telegram_id);
    const next = vi.fn().mockResolvedValue(undefined);
    await loadDriver(ctx as unknown as BotContext, next);
    expect(ctx.driver?.id).toBe(d.id);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('adminOnly', () => {
  // ADMIN_IDS is set to '999' in vitest.config.ts env

  it('calls next for a known admin id', async () => {
    const ctx = makeCtx(999);
    const next = vi.fn().mockResolvedValue(undefined);
    await adminOnly(ctx as unknown as BotContext, next);
    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('replies "Not authorized." and blocks next for a non-admin', async () => {
    const ctx = makeCtx(1234);
    const next = vi.fn();
    await adminOnly(ctx as unknown as BotContext, next);
    expect(ctx.reply).toHaveBeenCalledWith('Not authorized.');
    expect(next).not.toHaveBeenCalled();
  });

  it('replies "Not authorized." when ctx.from is absent', async () => {
    const ctx = makeCtx(undefined);
    const next = vi.fn();
    await adminOnly(ctx as unknown as BotContext, next);
    expect(ctx.reply).toHaveBeenCalledWith('Not authorized.');
    expect(next).not.toHaveBeenCalled();
  });
});
