import { createConversation } from '@grammyjs/conversations';
import type { Conversation } from '@grammyjs/conversations';
import type { BotContext } from '../types';
import {
  driverMenuKeyboard,
  requestLiveLocationKeyboard,
  vehicleTypeKeyboard,
  formatDriverProfile,
} from './keyboards';
import { create, updateStatus } from '../services/drivers';
import { updateDriverLocation } from '../services/location';
import { generateCode, createReferral, getReferralCount, getInviteLink } from '../services/referral';
import type { VehicleType } from '../services/drivers';
import type { Bot } from 'grammy';

type DriverConversation = Conversation<BotContext>;

async function registerDriverConversation(
  conversation: DriverConversation,
  ctx: BotContext
): Promise<void> {
  // Step 1: Name
  await ctx.reply('What is your full name?');
  const nameCtx = await conversation.wait();
  const name = nameCtx.message?.text?.trim();
  if (!name) {
    await ctx.reply('Registration cancelled. Send /start to try again.');
    return;
  }

  // Step 2: Phone
  await ctx.reply('Enter your phone number with country code (e.g. +94771234567):');
  const phoneCtx = await conversation.wait();
  const phone = phoneCtx.message?.text?.trim();
  if (!phone || !/^\+\d{7,15}$/.test(phone)) {
    await ctx.reply(
      'Invalid phone number. Must start with + followed by 7–15 digits.\nSend /start to try again.'
    );
    return;
  }

  // Step 3: Vehicle type
  await ctx.reply('Select your vehicle type:', { reply_markup: vehicleTypeKeyboard });
  const vtypeCtx = await conversation.waitFor('callback_query:data');
  await vtypeCtx.answerCallbackQuery();
  const vehicleType = vtypeCtx.callbackQuery.data.replace('vtype:', '') as VehicleType;

  // Step 4: Seats
  await ctx.reply('How many seats does your vehicle have? (1–20)');
  const seatsCtx = await conversation.wait();
  const seatsRaw = seatsCtx.message?.text?.trim();
  const seats = parseInt(seatsRaw ?? '', 10);
  if (isNaN(seats) || seats < 1 || seats > 20) {
    await ctx.reply('Invalid seat count. Must be a number between 1 and 20.\nSend /start to try again.');
    return;
  }

  // Step 5: Plate number
  await ctx.reply('Enter your vehicle plate number:');
  const plateCtx = await conversation.wait();
  const vehicleNumber = plateCtx.message?.text?.trim();
  if (!vehicleNumber) {
    await ctx.reply('Registration cancelled. Send /start to try again.');
    return;
  }

  // Capture referredBy before external calls (session data)
  const referredBy = ctx.session.referredBy;

  // Save to database
  const referralCode = generateCode();
  const driver = await conversation.external(() =>
    create({
      telegramId: ctx.from!.id,
      name,
      phone,
      vehicleType,
      seats,
      vehicleNumber,
      referralCode,
      referredBy,
    })
  );

  // Track referral
  if (referredBy) {
    await conversation.external(() => createReferral(referredBy, driver.id));
  }

  await ctx.reply(
    '✅ Registration complete!\n\nYour profile is pending admin approval. You will be notified once approved.',
    { reply_markup: driverMenuKeyboard }
  );
}

export function registerDriverHandlers(bot: Bot<BotContext>): void {
  bot.use(createConversation(registerDriverConversation));

  bot.hears('🚗 I am a Driver', async (ctx) => {
    if (ctx.driver) {
      await ctx.reply(`Welcome back, ${ctx.driver.name}!`, { reply_markup: driverMenuKeyboard });
      return;
    }
    await ctx.conversation.enter('registerDriverConversation');
  });

  bot.hears('🟢 Go Online', async (ctx) => {
    if (!ctx.driver || !ctx.from) return;
    if (!ctx.driver.is_approved) {
      await ctx.reply('⏳ Your account is pending admin approval.');
      return;
    }
    if (!ctx.driver.is_enabled) {
      await ctx.reply('🚫 Your account has been disabled. Contact admin.');
      return;
    }
    await updateStatus(ctx.from.id, 'available');
    await ctx.reply(
      '🟢 You are now online!\n\nPlease share your live location so riders can find you:',
      { reply_markup: requestLiveLocationKeyboard }
    );
  });

  bot.hears('🟡 Busy', async (ctx) => {
    if (!ctx.driver || !ctx.from) return;
    await updateStatus(ctx.from.id, 'busy');
    await ctx.reply('🟡 Status set to Busy. You are hidden from rider search.', {
      reply_markup: driverMenuKeyboard,
    });
  });

  bot.hears('🔴 Go Offline', async (ctx) => {
    if (!ctx.driver || !ctx.from) return;
    await updateStatus(ctx.from.id, 'offline');
    await ctx.reply('🔴 You are now offline.', { reply_markup: driverMenuKeyboard });
  });

  bot.hears('👤 My Profile', async (ctx) => {
    if (!ctx.driver) return;
    const count = await getReferralCount(ctx.driver.id);
    await ctx.reply(formatDriverProfile(ctx.driver, count), { parse_mode: 'Markdown' });
  });

  bot.hears('🔗 Invite Drivers', async (ctx) => {
    if (!ctx.driver) return;
    const count = await getReferralCount(ctx.driver.id);
    const botUsername = ctx.me.username;
    const link = getInviteLink(ctx.driver.referral_code, botUsername);
    await ctx.reply(
      `🔗 *Your Invite Link*\n\n${link}\n\nTotal Referrals: ${count}`,
      { parse_mode: 'Markdown' }
    );
  });

  // Driver live location — initial share when going online
  bot.on('message:location', async (ctx, next) => {
    if (!ctx.driver || !ctx.driver.is_approved || !ctx.driver.is_enabled) {
      return next();
    }
    const { latitude, longitude } = ctx.message.location;
    await updateDriverLocation(ctx.from.id, longitude, latitude, true);
    await ctx.reply('📍 Location received! You are now visible to riders.', {
      reply_markup: driverMenuKeyboard,
    });
  });
}
