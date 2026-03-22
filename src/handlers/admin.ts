import type { Bot, MiddlewareFn } from 'grammy';
import type { BotContext } from '../types';
import { getAll, approve, disable, enable, findById } from '../services/drivers';

export function registerAdminHandlers(
  bot: Bot<BotContext>,
  adminOnly: MiddlewareFn<BotContext>
): void {
  bot.command('admin_help', adminOnly, async (ctx) => {
    await ctx.reply(
      '*Admin Commands*\n\n' +
        '/admin\\_drivers — List all registered drivers\n' +
        '/approve <id> — Approve a driver\n' +
        '/disable <id> — Disable a driver\n' +
        '/enable <id> — Re-enable a driver\n' +
        '/broadcast <message> — Send message to all drivers',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('admin_drivers', adminOnly, async (ctx) => {
    const drivers = await getAll();
    if (!drivers.length) {
      await ctx.reply('No drivers registered yet.');
      return;
    }
    const lines = drivers.map((d) => {
      const approved = d.is_approved ? '✅' : '⏳';
      const enabled = d.is_enabled ? '' : ' 🚫';
      const vehicle = d.vehicle_type.toUpperCase();
      return `[${d.id}] ${d.name} | ${vehicle} | ${d.status} | ${approved}${enabled}`;
    });
    await ctx.reply(`*Registered Drivers (${drivers.length})*\n\n` + lines.join('\n'), {
      parse_mode: 'Markdown',
    });
  });

  bot.command('approve', adminOnly, async (ctx) => {
    const id = parseInt(ctx.match ?? '', 10);
    if (isNaN(id)) {
      await ctx.reply('Usage: /approve <driver_id>');
      return;
    }
    const driver = await approve(id);
    if (!driver) {
      await ctx.reply(`Driver with ID ${id} not found.`);
      return;
    }
    await ctx.reply(`✅ Driver ${driver.name} (ID: ${id}) approved.`);
    await ctx.api
      .sendMessage(
        driver.telegram_id,
        '✅ Your driver account has been approved! You can now go online.'
      )
      .catch(() => {});
  });

  bot.command('disable', adminOnly, async (ctx) => {
    const id = parseInt(ctx.match ?? '', 10);
    if (isNaN(id)) {
      await ctx.reply('Usage: /disable <driver_id>');
      return;
    }
    const driver = await disable(id);
    if (!driver) {
      await ctx.reply(`Driver with ID ${id} not found.`);
      return;
    }
    await ctx.reply(`🚫 Driver ${driver.name} (ID: ${id}) disabled.`);
    await ctx.api
      .sendMessage(driver.telegram_id, '🚫 Your driver account has been disabled.')
      .catch(() => {});
  });

  bot.command('enable', adminOnly, async (ctx) => {
    const id = parseInt(ctx.match ?? '', 10);
    if (isNaN(id)) {
      await ctx.reply('Usage: /enable <driver_id>');
      return;
    }
    const driver = await enable(id);
    if (!driver) {
      await ctx.reply(`Driver with ID ${id} not found.`);
      return;
    }
    await ctx.reply(`✅ Driver ${driver.name} (ID: ${id}) re-enabled.`);
    await ctx.api
      .sendMessage(driver.telegram_id, '✅ Your driver account has been re-enabled.')
      .catch(() => {});
  });

  bot.command('broadcast', adminOnly, async (ctx) => {
    const message = ctx.match?.trim();
    if (!message) {
      await ctx.reply('Usage: /broadcast <message>');
      return;
    }
    const drivers = await getAll();
    if (!drivers.length) {
      await ctx.reply('No drivers to broadcast to.');
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const d of drivers) {
      try {
        await ctx.api.sendMessage(d.telegram_id, message);
        ok++;
      } catch {
        fail++;
      }
    }
    await ctx.reply(`📢 Broadcast complete.\nDelivered: ${ok} | Failed: ${fail}`);
  });
}

// Keep findById available for potential future use — suppress unused import warning
void findById;
