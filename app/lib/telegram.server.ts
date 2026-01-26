import { prisma } from './db.server';
import { settings } from './settings.server';

const TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = settings.TELEGRAM_WEBHOOK_SECRET;
const BASE_URL = settings.BASE_URL;

// Telegram Bot API base URL
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Check if Telegram integration is configured.
 */
export function isTelegramConfigured(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_WEBHOOK_SECRET);
}

/**
 * Get the webhook secret for verification.
 */
export function getTelegramWebhookSecret(): string {
  return TELEGRAM_WEBHOOK_SECRET;
}

/**
 * Make a request to the Telegram Bot API.
 */
async function telegramRequest<T>(
  method: string,
  params?: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Telegram API error (${method}):`, error);
    return { ok: false, description: 'Request failed' };
  }
}

/**
 * Get bot info to validate the token and get bot username.
 */
export async function getBotInfo(): Promise<{
  id: number;
  username: string;
  first_name: string;
} | null> {
  const response = await telegramRequest<{
    id: number;
    username: string;
    first_name: string;
  }>('getMe');

  return response.ok ? response.result ?? null : null;
}

/**
 * Set up the webhook for receiving updates.
 */
export async function setTelegramWebhook(): Promise<boolean> {
  const webhookUrl = `${BASE_URL}/telegram/webhook`;

  const response = await telegramRequest('setWebhook', {
    url: webhookUrl,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'my_chat_member'],
  });

  if (!response.ok) {
    console.error('Failed to set Telegram webhook:', response.description);
    return false;
  }

  console.log('Telegram webhook set:', webhookUrl);
  return true;
}

/**
 * Delete the webhook (for cleanup).
 */
export async function deleteTelegramWebhook(): Promise<boolean> {
  const response = await telegramRequest('deleteWebhook');
  return response.ok;
}

/**
 * Get info about a chat (group/supergroup).
 */
export async function getChatInfo(chatId: string): Promise<{
  id: number;
  title: string;
  type: string;
  is_forum?: boolean;
} | null> {
  const response = await telegramRequest<{
    id: number;
    title: string;
    type: string;
    is_forum?: boolean;
  }>('getChat', { chat_id: chatId });

  return response.ok ? response.result ?? null : null;
}

/**
 * Generate the deep link for adding bot to a group.
 * Users open this link to add the bot to their supergroup.
 */
export async function getTelegramInstallUrl(accountId: string): Promise<string | null> {
  const botInfo = await getBotInfo();
  if (!botInfo) {
    return null;
  }

  // Deep link format: t.me/BotUsername?startgroup=true&admin=manage_topics
  // The admin parameter requests admin permissions for managing topics
  return `https://t.me/${botInfo.username}?startgroup=${accountId}&admin=manage_topics`;
}

/**
 * Store a Telegram group config for an account.
 */
export async function storeTelegramGroupConfig(
  accountId: string,
  data: {
    chatId: string;
    chatTitle: string;
    isForumEnabled: boolean;
  }
): Promise<void> {
  await prisma.telegramGroupConfig.upsert({
    where: {
      accountId_telegramChatId: {
        accountId,
        telegramChatId: data.chatId,
      },
    },
    update: {
      telegramChatTitle: data.chatTitle,
      isForumEnabled: data.isForumEnabled,
    },
    create: {
      accountId,
      telegramChatId: data.chatId,
      telegramChatTitle: data.chatTitle,
      isForumEnabled: data.isForumEnabled,
    },
  });
}

/**
 * Get Telegram group configs for an account.
 */
export async function getTelegramGroupConfigs(accountId: string) {
  return prisma.telegramGroupConfig.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get the default Telegram group for an account.
 */
export async function getDefaultTelegramGroup(accountId: string) {
  return prisma.telegramGroupConfig.findFirst({
    where: { accountId, isDefault: true },
  });
}

/**
 * Set a Telegram group as the default for an account.
 */
export async function setDefaultTelegramGroup(
  accountId: string,
  chatId: string
): Promise<void> {
  // Clear existing default
  await prisma.telegramGroupConfig.updateMany({
    where: { accountId, isDefault: true },
    data: { isDefault: false },
  });

  // Set new default
  await prisma.telegramGroupConfig.update({
    where: {
      accountId_telegramChatId: { accountId, telegramChatId: chatId },
    },
    data: { isDefault: true },
  });
}

/**
 * Remove a Telegram group config.
 */
export async function removeTelegramGroupConfig(
  accountId: string,
  chatId: string
): Promise<void> {
  await prisma.telegramGroupConfig.delete({
    where: {
      accountId_telegramChatId: { accountId, telegramChatId: chatId },
    },
  });
}

/**
 * Create a forum topic for a new ticket.
 */
export async function createForumTopic(
  chatId: string,
  name: string
): Promise<{ message_thread_id: number } | null> {
  const response = await telegramRequest<{ message_thread_id: number }>(
    'createForumTopic',
    {
      chat_id: chatId,
      name: name.substring(0, 128), // Max 128 chars
    }
  );

  if (!response.ok) {
    console.error('Failed to create forum topic:', response.description);
    return null;
  }

  return response.result ?? null;
}

/**
 * Close a forum topic (when ticket is closed).
 */
export async function closeForumTopic(
  chatId: string,
  topicId: number
): Promise<boolean> {
  const response = await telegramRequest('closeForumTopic', {
    chat_id: chatId,
    message_thread_id: topicId,
  });

  return response.ok;
}

/**
 * Reopen a forum topic (when ticket is reopened).
 */
export async function reopenForumTopic(
  chatId: string,
  topicId: number
): Promise<boolean> {
  const response = await telegramRequest('reopenForumTopic', {
    chat_id: chatId,
    message_thread_id: topicId,
  });

  return response.ok;
}

/**
 * Send a message to a Telegram chat or topic.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    topicId?: number;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  }
): Promise<{ message_id: number } | null> {
  const response = await telegramRequest<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text,
    message_thread_id: options?.topicId,
    parse_mode: options?.parseMode,
  });

  if (!response.ok) {
    console.error('Failed to send Telegram message:', response.description);
    return null;
  }

  return response.result ?? null;
}

/**
 * Build the ticket message text with visitor info.
 */
function buildTicketMessage(ticket: {
  id: string;
  visitorEmail?: string;
  visitorName?: string;
  firstMessage: string;
  metadata?: Record<string, unknown>;
}): string {
  const lines: string[] = ['🎫 <b>New Support Ticket</b>', ''];

  if (ticket.visitorName) {
    lines.push(`<b>Name:</b> ${escapeHtml(ticket.visitorName)}`);
  }
  if (ticket.visitorEmail) {
    lines.push(`<b>Email:</b> ${escapeHtml(ticket.visitorEmail)}`);
  }

  if (ticket.metadata) {
    for (const [key, value] of Object.entries(ticket.metadata)) {
      lines.push(`<b>${escapeHtml(key)}:</b> ${escapeHtml(String(value))}`);
    }
  }

  lines.push('', `<b>Message:</b>`, escapeHtml(ticket.firstMessage));
  lines.push('', '💬 Reply in this topic to respond');

  return lines.join('\n');
}

/**
 * Escape HTML special characters for Telegram HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Create a ticket in Telegram with a forum topic.
 */
export async function createTicketInTelegram(
  accountId: string,
  chatId: string,
  ticket: {
    id: string;
    visitorEmail?: string;
    visitorName?: string;
    firstMessage: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{
  topicId: number;
  messageId: number;
  permalink: string;
} | null> {
  // Create a forum topic for this ticket
  const topicName = ticket.visitorName
    ? `Support: ${ticket.visitorName}`
    : 'Support Ticket';

  const topicResult = await createForumTopic(chatId, topicName);
  if (!topicResult) {
    return null;
  }

  const topicId = topicResult.message_thread_id;

  // Send the ticket message to the topic
  const messageText = buildTicketMessage(ticket);
  const messageResult = await sendTelegramMessage(chatId, messageText, {
    topicId,
    parseMode: 'HTML',
  });

  if (!messageResult) {
    return null;
  }

  // Build permalink (deep link to topic)
  // Format: https://t.me/c/{chat_id_without_-100}/{topic_id}
  const chatIdForLink = chatId.replace('-100', '');
  const permalink = `https://t.me/c/${chatIdForLink}/${topicId}`;

  return {
    topicId,
    messageId: messageResult.message_id,
    permalink,
  };
}

/**
 * Post a message to a Telegram ticket topic.
 */
export async function postToTelegram(
  chatId: string,
  text: string,
  options?: {
    topicId?: number;
    source?: 'visitor' | 'agent';
    agentName?: string;
  }
): Promise<{ messageId: number } | null> {
  // Format message based on source
  let formattedText = text;
  if (options?.source === 'visitor') {
    formattedText = `👤 <b>Visitor:</b>\n${escapeHtml(text)}`;
  } else if (options?.source === 'agent' && options.agentName) {
    formattedText = `💬 <b>${escapeHtml(options.agentName)}:</b>\n${escapeHtml(text)}`;
  }

  const result = await sendTelegramMessage(chatId, formattedText, {
    topicId: options?.topicId,
    parseMode: 'HTML',
  });

  return result ? { messageId: result.message_id } : null;
}

// Types for Telegram updates
export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  is_forum?: boolean;
};

export type TelegramMessage = {
  message_id: number;
  message_thread_id?: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  new_chat_member?: TelegramUser;
  left_chat_member?: TelegramUser;
  // Service messages for forum topics
  forum_topic_closed?: Record<string, never>;
  forum_topic_reopened?: Record<string, never>;
};

export type TelegramChatMemberUpdated = {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: {
    user: TelegramUser;
    status: string;
  };
  new_chat_member: {
    user: TelegramUser;
    status: string;
  };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  my_chat_member?: TelegramChatMemberUpdated;
};
