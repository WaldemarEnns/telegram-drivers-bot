import { Keyboard, InlineKeyboard } from 'grammy';
import type { NearbyDriver } from '../services/location';
import type { Driver } from '../services/drivers';

export const roleSelectionKeyboard = new Keyboard()
  .text('🚗 I am a Driver')
  .text('🙋 I am a Rider')
  .resized()
  .oneTime();

export const driverMenuKeyboard = new Keyboard()
  .text('🟢 Go Online').text('🟡 Busy').row()
  .text('🔴 Go Offline').text('👤 My Profile').row()
  .text('🔗 Invite Drivers')
  .resized();

export const riderMenuKeyboard = new Keyboard()
  .text('🔍 Find Drivers')
  .resized();

export const requestLiveLocationKeyboard = new Keyboard()
  .requestLocation('📍 Share Live Location')
  .resized()
  .oneTime();

export const requestOneTimeLocationKeyboard = new Keyboard()
  .requestLocation('📍 Share My Location')
  .resized()
  .oneTime();

export const vehicleTypeKeyboard = new InlineKeyboard()
  .text('🚗 Car', 'vtype:car').text('🛺 Tuk', 'vtype:tuk').row()
  .text('🚐 Van', 'vtype:van').text('🚙 SUV', 'vtype:suv');

export const vehicleFilterKeyboard = new InlineKeyboard()
  .text('All', 'filter:all').text('🚗 Car', 'filter:car').text('🛺 Tuk', 'filter:tuk').row()
  .text('🚐 Van', 'filter:van').text('🚙 SUV', 'filter:suv');

const VEHICLE_EMOJI: Record<string, string> = {
  car: '🚗',
  tuk: '🛺',
  van: '🚐',
  suv: '🚙',
};

export function formatDriverCard(driver: NearbyDriver, index: number): string {
  const distKm = (driver.distance_m / 1000).toFixed(1);
  const emoji = VEHICLE_EMOJI[driver.vehicle_type] ?? '🚗';
  const vehicleLabel = driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1);
  const phone = driver.phone.replace('+', '');
  const callLink = `[📞 Call](tel:${driver.phone})`;
  const waLink = `[💬 WhatsApp](https://wa.me/${phone})`;
  return (
    `*${index}. ${driver.name}* – ${distKm} km\n` +
    `   ${emoji} ${vehicleLabel} | Seats: ${driver.seats}\n` +
    `   ${callLink} | ${waLink}`
  );
}

export function formatDriverProfile(driver: Driver, referralCount: number): string {
  const statusLabel = {
    available: '🟢 Available',
    busy: '🟡 Busy',
    offline: '🔴 Offline',
  }[driver.status];

  const approvalStatus = driver.is_approved
    ? driver.is_enabled ? '✅ Approved' : '🚫 Disabled'
    : '⏳ Pending Approval';

  const vehicleLabel = driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1);

  return (
    `👤 *My Profile*\n\n` +
    `Name: ${driver.name}\n` +
    `Phone: ${driver.phone}\n` +
    `Vehicle: ${vehicleLabel} | Seats: ${driver.seats}\n` +
    `Plate: ${driver.vehicle_number}\n` +
    `Status: ${statusLabel}\n` +
    `Account: ${approvalStatus}\n` +
    `Referral Code: \`${driver.referral_code}\`\n` +
    `Total Referrals: ${referralCount}`
  );
}
