import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import config from './config';
import migrate from './db/migrate';
import { loadDriver, adminOnly } from './middleware/auth';
import { registerDriverHandlers } from './handlers/driver';
import { registerRiderHandlers } from './handlers/rider';
import { registerAdminHandlers } from './handlers/admin';
import { roleSelectionKeyboard, driverMenuKeyboard } from './handlers/keyboards';
import { findDriverByReferralCode } from './services/referral';
import { updateDriverLocation } from './services/location';
import { startBackgroundJobs } from './services/jobs';
import type { BotContext, SessionData } from './types';

export type { BotContext };

async function main(): Promise<void> {
  await migrate();

  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  // 1. Session — required by conversations plugin
  bot.use(
    session<SessionData, BotContext>({
      initial: (): SessionData => ({ referredBy: null }),
    })
  );

  // 2. Conversations plugin
  bot.use(conversations<BotContext>());

  // 3. Load driver on every update
  bot.use(loadDriver);

  // 4. Register driver handlers (includes createConversation + status/profile buttons)
  registerDriverHandlers(bot);

  // 5. /start — handles deep links and returning drivers
  bot.command('start', async (ctx) => {
    const payload = ctx.match;
    if (payload?.startsWith('ref_')) {
      const code = payload.replace('ref_', '');
      const referrer = await findDriverByReferralCode(code);
      if (referrer) {
        ctx.session.referredBy = referrer.id;
      }
    }

    if (ctx.driver) {
      await ctx.reply(`Welcome back, ${ctx.driver.name}! 👋`, {
        reply_markup: driverMenuKeyboard,
      });
      return;
    }

    await ctx.reply(
      'Welcome to TaxiBot! 🚕\n\nAre you a driver or a rider?',
      { reply_markup: roleSelectionKeyboard }
    );
  });

  // 6. Rider handlers (role selection hears + find drivers flow)
  registerRiderHandlers(bot);

  // 7. Admin commands
  registerAdminHandlers(bot, adminOnly);

  // 8. Live location updates from drivers (edited_message — outside any conversation)
  bot.on('edited_message:location', async (ctx) => {
    if (!ctx.driver || !ctx.driver.is_approved || !ctx.driver.is_enabled) return;
    const { latitude, longitude } = ctx.editedMessage.location;
    await updateDriverLocation(ctx.from.id, longitude, latitude);
  });

  // 9. Global error handler — individual failures must not crash the bot
  bot.catch((err) => {
    console.error('Handler error:', err.error);
    const ctx = err.ctx;
    ctx.reply('Something went wrong. Please try again.').catch(() => {});
  });

  startBackgroundJobs(bot.api);
  console.log('Bot starting...');
  await bot.start();
  console.log('Bot started.');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
