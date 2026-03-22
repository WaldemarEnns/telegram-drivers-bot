import type { NextFunction } from 'grammy';
import config from '../config';
import { findByTelegramId } from '../services/drivers';
import type { BotContext } from '../types';

export async function loadDriver(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    ctx.driver = await findByTelegramId(telegramId);
  } else {
    ctx.driver = null;
  }
  return next();
}

export async function adminOnly(ctx: BotContext, next: NextFunction): Promise<void> {
  if (!ctx.from || !config.ADMIN_IDS.includes(ctx.from.id)) {
    await ctx.reply('Not authorized.');
    return;
  }
  return next();
}
