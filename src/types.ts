import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor } from '@grammyjs/conversations';
import type { Driver } from './services/drivers';

export interface SessionData {
  referredBy: number | null;
}

export type BotContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor & {
    driver: Driver | null;
  };
