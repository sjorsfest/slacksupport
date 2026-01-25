/**
 * Shared Telegram event processing logic.
 * Used by both the BullMQ worker and inline serverless processing.
 */
import { prisma } from '~/lib/db.server';
import {
  type TelegramUpdate,
  type TelegramMessage,
  type TelegramChatMemberUpdated,
  storeTelegramGroupConfig,
  getBotInfo,
} from '~/lib/telegram.server';
import { triggerWebhooks } from '~/lib/webhook.server';

export type ProcessResult = {
  processed: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

/**
 * Process a Telegram update and create a message in the database.
 * Handles both message events and bot membership changes.
 */
export async function processTelegramEvent(
  update: TelegramUpdate
): Promise<ProcessResult> {
  // Handle bot being added to a group
  if (update.my_chat_member) {
    return handleChatMemberUpdate(update.my_chat_member);
  }

  // Handle regular messages
  if (update.message) {
    return handleMessage(update.update_id, update.message, update);
  }

  return { processed: false, skipped: true, reason: 'Unsupported update type' };
}

/**
 * Handle bot being added/removed from a group.
 * When added to a supergroup, we track it for later selection.
 */
async function handleChatMemberUpdate(
  event: TelegramChatMemberUpdated
): Promise<ProcessResult> {
  const chat = event.chat;
  const newStatus = event.new_chat_member.status;
  const oldStatus = event.old_chat_member.status;

  // Check if bot was added (status changed to member/administrator)
  const wasAdded =
    (newStatus === 'member' || newStatus === 'administrator') &&
    (oldStatus === 'left' || oldStatus === 'kicked' || !oldStatus);

  if (!wasAdded) {
    return { processed: false, skipped: true, reason: 'Not a bot addition event' };
  }

  // Only track supergroups (where forum topics work)
  if (chat.type !== 'supergroup') {
    return { processed: false, skipped: true, reason: 'Not a supergroup' };
  }

  // We need to find which account initiated this installation
  // The startgroup parameter in the deep link contains the accountId
  // However, Telegram doesn't pass this through my_chat_member updates
  // So we track all groups and let users select them in the dashboard

  console.log(
    `Bot added to supergroup: ${chat.title} (${chat.id}), is_forum: ${chat.is_forum}`
  );

  // We'll store this when processing the first message or via the API
  // For now, just acknowledge the event
  return {
    processed: true,
    skipped: false,
    reason: `Bot added to ${chat.title}`,
  };
}

/**
 * Handle an incoming message from a Telegram topic.
 */
async function handleMessage(
  updateId: number,
  message: TelegramMessage,
  fullUpdate: TelegramUpdate
): Promise<ProcessResult> {
  const chat = message.chat;
  const chatId = String(chat.id);

  // Skip non-supergroup messages
  if (chat.type !== 'supergroup') {
    return { processed: false, skipped: true, reason: 'Not a supergroup message' };
  }

  // Skip bot messages
  if (message.from?.is_bot) {
    return { processed: false, skipped: true, reason: 'Message from a bot' };
  }

  // Must have message_thread_id (forum topic)
  if (!message.message_thread_id) {
    return { processed: false, skipped: true, reason: 'Not a forum topic message' };
  }

  // Skip messages without text
  if (!message.text) {
    return { processed: false, skipped: true, reason: 'No text content' };
  }

  // Check for duplicate processing
  const existingEvent = await prisma.eventDedup.findUnique({
    where: {
      telegramChatId_telegramUpdateId: {
        telegramChatId: chatId,
        telegramUpdateId: updateId,
      },
    },
  });

  if (existingEvent) {
    return { processed: false, skipped: true, reason: 'Duplicate event' };
  }

  // Find the ticket by Telegram topic ID
  const ticket = await prisma.ticket.findFirst({
    where: {
      telegramChatId: chatId,
      telegramTopicId: message.message_thread_id,
    },
  });

  if (!ticket) {
    return { processed: false, skipped: true, reason: 'No matching ticket found' };
  }

  // Get bot info to check if message is from our bot
  const botInfo = await getBotInfo();
  if (botInfo && message.from?.id === botInfo.id) {
    return { processed: false, skipped: true, reason: 'Message from our bot' };
  }

  // Get user display name
  const telegramUserName = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(' ')
    : 'Unknown';

  // Create the message
  const dbMessage = await prisma.message.create({
    data: {
      ticketId: ticket.id,
      source: 'telegram',
      text: message.text,
      telegramMessageId: message.message_id,
      telegramUserId: message.from ? String(message.from.id) : null,
      telegramUserName,
      rawTelegramEvent: fullUpdate as never,
    },
  });

  // Mark event as processed
  await prisma.eventDedup.create({
    data: {
      telegramUpdateId: updateId,
      telegramChatId: chatId,
    },
  });

  // Trigger webhook delivery
  await triggerWebhooks(
    ticket.accountId,
    ticket.id,
    'message.created',
    {
      ticketId: ticket.id,
      accountId: ticket.accountId,
      messageId: dbMessage.id,
      source: 'telegram',
      text: dbMessage.text,
      telegramUserId: message.from?.id,
      telegramUserName,
    },
    dbMessage.id
  );

  console.log(`Processed Telegram message for ticket ${ticket.id}`);

  return { processed: true, skipped: false, messageId: dbMessage.id };
}

/**
 * Handle tracking a new group when we receive any message from it.
 * This is called when we get a message from a group we haven't seen before.
 */
export async function trackTelegramGroup(
  accountId: string,
  chat: { id: number; title?: string; is_forum?: boolean }
): Promise<void> {
  await storeTelegramGroupConfig(accountId, {
    chatId: String(chat.id),
    chatTitle: chat.title || 'Unknown Group',
    isForumEnabled: chat.is_forum || false,
  });
}
