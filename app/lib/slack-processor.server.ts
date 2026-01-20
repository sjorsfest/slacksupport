/**
 * Shared Slack event processing logic.
 * Used by both the BullMQ worker and inline serverless processing.
 */
import { prisma } from '~/lib/db.server';
import { getSlackUserInfo, type SlackEventPayload } from '~/lib/slack.server';
import { triggerWebhooks } from '~/lib/webhook.server';

export type ProcessResult = {
  processed: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

/**
 * Process a Slack event and create a message in the database.
 * Returns processing result with skip reason or message ID.
 */
export async function processSlackEvent(
  eventId: string,
  payload: SlackEventPayload
): Promise<ProcessResult> {
  // Only handle event_callback type
  if (payload.type !== 'event_callback' || !payload.event) {
    return { processed: false, skipped: true, reason: 'Not an event callback' };
  }

  const event = payload.event;
  const teamId = payload.team_id;

  // Only handle message events
  if (event.type !== 'message') {
    return { processed: false, skipped: true, reason: 'Not a message event' };
  }

  // Skip message subtypes we don't care about (edits, deletes, etc.)
  if (event.subtype && !['bot_message'].includes(event.subtype)) {
    return { processed: false, skipped: true, reason: `Skipping subtype: ${event.subtype}` };
  }

  // Must be a thread reply (has thread_ts different from ts)
  if (!event.thread_ts || event.thread_ts === event.ts) {
    return { processed: false, skipped: true, reason: 'Not a thread reply' };
  }

  // Check for duplicate processing
  const existingEvent = await prisma.eventDedup.findUnique({
    where: {
      slackTeamId_slackEventId: {
        slackTeamId: teamId!,
        slackEventId: eventId,
      },
    },
  });

  if (existingEvent) {
    return { processed: false, skipped: true, reason: 'Duplicate event' };
  }

  // Find the ticket by thread_ts
  const ticket = await prisma.ticket.findFirst({
    where: {
      slackThreadTs: event.thread_ts,
      account: {
        slackInstallation: {
          slackTeamId: teamId,
        },
      },
    },
    include: {
      account: {
        include: {
          slackInstallation: true,
        },
      },
    },
  });

  if (!ticket) {
    return { processed: false, skipped: true, reason: 'No matching ticket found' };
  }

  // Ignore messages from our own bot
  const botUserId = ticket.account.slackInstallation?.botUserId;
  if (event.bot_id || event.user === botUserId) {
    return { processed: false, skipped: true, reason: 'Message from our bot' };
  }

  // Get user info for display name
  let slackUserName = event.user || 'Unknown';
  if (event.user && ticket.accountId) {
    const userInfo = await getSlackUserInfo(ticket.accountId, event.user);
    if (userInfo) {
      slackUserName = userInfo.displayName || userInfo.realName || userInfo.name;
    }
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      ticketId: ticket.id,
      source: 'slack',
      text: event.text || '',
      slackTs: event.ts,
      slackUserId: event.user,
      slackUserName,
      rawSlackEvent: payload as never,
    },
  });

  // Mark event as processed
  await prisma.eventDedup.create({
    data: {
      slackEventId: eventId,
      slackTeamId: teamId!,
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
      source: 'slack',
      text: message.text,
      slackUserId: event.user,
      slackUserName,
    },
    message.id
  );

  console.log(`Processed Slack message for ticket ${ticket.id}`);

  return { processed: true, skipped: false, messageId: message.id };
}
