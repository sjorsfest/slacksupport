/**
 * Shared Discord event processing logic.
 * Used by both the BullMQ worker and inline serverless processing.
 */
import { prisma } from '~/lib/db.server';
import { getDiscordUserInfo, type DiscordMessageEvent } from '~/lib/discord.server';
import { triggerWebhooks } from '~/lib/webhook.server';

export type ProcessResult = {
  processed: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

export type DiscordEventPayload = {
  t: string; // Event type (MESSAGE_CREATE, etc.)
  d: DiscordMessageEvent;
};

/**
 * Process a Discord event and create a message in the database.
 * Returns processing result with skip reason or message ID.
 */
export async function processDiscordEvent(
  eventId: string,
  payload: DiscordEventPayload
): Promise<ProcessResult> {
  // Only handle MESSAGE_CREATE events
  if (payload.t !== 'MESSAGE_CREATE') {
    return { processed: false, skipped: true, reason: 'Not a MESSAGE_CREATE event' };
  }

  const event = payload.d;
  const guildId = event.guild_id;

  if (!guildId) {
    return { processed: false, skipped: true, reason: 'No guild ID in event' };
  }

  // Skip bot messages
  if (event.author.bot) {
    return { processed: false, skipped: true, reason: 'Message from a bot' };
  }

  // Check for duplicate processing
  const existingEvent = await prisma.eventDedup.findUnique({
    where: {
      discordGuildId_discordEventId: {
        discordGuildId: guildId,
        discordEventId: eventId,
      },
    },
  });

  if (existingEvent) {
    return { processed: false, skipped: true, reason: 'Duplicate event' };
  }

  // Find the ticket by Discord thread ID
  // The channel_id for thread messages is the thread ID itself
  const ticket = await prisma.ticket.findFirst({
    where: {
      discordThreadId: event.channel_id,
      account: {
        discordInstallation: {
          discordGuildId: guildId,
        },
      },
    },
    include: {
      account: {
        include: {
          discordInstallation: true,
        },
      },
    },
  });

  if (!ticket) {
    return { processed: false, skipped: true, reason: 'No matching ticket found' };
  }

  // Ignore messages from our own bot
  const botUserId = ticket.account.discordInstallation?.botUserId;
  if (event.author.id === botUserId) {
    return { processed: false, skipped: true, reason: 'Message from our bot' };
  }

  // Get user display name
  let discordUserName = event.author.global_name || event.author.username;

  // Try to get more user info if needed
  if (!discordUserName) {
    const userInfo = await getDiscordUserInfo(event.author.id);
    if (userInfo) {
      discordUserName = userInfo.global_name || userInfo.username;
    }
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      ticketId: ticket.id,
      source: 'discord',
      text: event.content || '',
      discordMessageId: event.id,
      discordUserId: event.author.id,
      discordUserName,
      rawDiscordEvent: payload as never,
    },
  });

  // Mark event as processed
  await prisma.eventDedup.create({
    data: {
      discordEventId: eventId,
      discordGuildId: guildId,
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
      messageId: message.id,
      source: 'discord',
      text: message.text,
      discordUserId: event.author.id,
      discordUserName,
    },
    message.id
  );

  console.log(`Processed Discord message for ticket ${ticket.id}`);

  return { processed: true, skipped: false, messageId: message.id };
}
