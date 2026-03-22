import type { Bot } from 'grammy';
import type { BotContext } from '../types';
import {
  vehicleFilterKeyboard,
  riderMenuKeyboard,
  formatDriverCard,
} from './keyboards';
import { findNearbyDrivers } from '../services/location';
import { upsertRider } from '../services/riders';
import type { VehicleType } from '../services/drivers';

const pendingLocations = new Map<number, { latitude: number; longitude: number }>();

async function searchAndReply(
  ctx: BotContext,
  longitude: number,
  latitude: number,
  vehicleType: VehicleType | null
): Promise<void> {
  const drivers = await findNearbyDrivers(longitude, latitude, vehicleType);

  if (!drivers.length) {
    await ctx.reply('No drivers found nearby. Try again later.', {
      reply_markup: riderMenuKeyboard,
    });
    return;
  }

  const label = vehicleType ? vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1) : 'All';
  const cards = drivers.map((d, i) => formatDriverCard(d, i + 1)).join('\n\n');
  await ctx.reply(`Drivers near you *(${label})*:\n\n${cards}`, {
    parse_mode: 'Markdown',
    reply_markup: vehicleFilterKeyboard,
    link_preview_options: { is_disabled: true },
  });
}

export function registerRiderHandlers(bot: Bot<BotContext>): void {
  bot.hears('🙋 I am a Rider', async (ctx) => {
    if (ctx.from) await upsertRider(ctx.from.id);
    await ctx.reply('Welcome! Use the button below to find nearby drivers.', {
      reply_markup: riderMenuKeyboard,
    });
  });

  bot.hears('🔍 Find Drivers', async (ctx) => {
    await ctx.reply(
      'Tap the 📎 attachment icon → *Location* → *Send Your Current Location*.',
      { parse_mode: 'Markdown', reply_markup: riderMenuKeyboard }
    );
  });

  // Rider location — search all types immediately, show filter buttons with results
  bot.on('message:location', async (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    pendingLocations.set(ctx.from.id, { latitude, longitude });
    await searchAndReply(ctx, longitude, latitude, null);
  });

  // Filter buttons re-search using stored location
  bot.callbackQuery(/^filter:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const loc = pendingLocations.get(ctx.from.id);
    if (!loc) {
      await ctx.reply(
        'Location expired. Tap 📎 → Location to share your position again.',
        { reply_markup: riderMenuKeyboard }
      );
      return;
    }
    const filter = ctx.match[1];
    const vehicleType: VehicleType | null = filter === 'all' ? null : (filter as VehicleType);
    await searchAndReply(ctx, loc.longitude, loc.latitude, vehicleType);
  });
}
