import { Worker, type Job } from 'bullmq';
import { prisma } from '~/lib/db.server';
import { getSlackUserInfo, type SlackEventPayload } from '~/lib/slack.server';
import { bullMQConnection, QUEUE_NAMES, type SlackEventJobData } from '~/lib/redis.server';
import { triggerWebhooks } from '~/lib/webhook.server';

/**
 * Process Slack events asynchronously.
 * This worker handles message events from Slack threads.
 */
export function createSlackEventWorker(): Worker<SlackEventJobData> {
  const worker = new Worker<SlackEventJobData>(
    QUEUE_NAMES.SLACK_EVENTS,
    async (job: Job<SlackEventJobData>) => {
      const { eventId, payload } = job.data;
      const slackPayload = payload as SlackEventPayload;

      console.log(`Processing Slack event: ${eventId}`);

      // Only handle event_callback type
      if (slackPayload.type !== 'event_callback' || !slackPayload.event) {
        return { skipped: true, reason: 'Not an event callback' };
      }

      const event = slackPayload.event;
      const teamId = slackPayload.team_id;

      // Only handle message events
      if (event.type !== 'message') {
        return { skipped: true, reason: 'Not a message event' };
      }

      // Skip message subtypes we don't care about (edits, deletes, etc.)
      // We'll only handle regular messages for now
      if (event.subtype && !['bot_message'].includes(event.subtype)) {
        return { skipped: true, reason: `Skipping subtype: ${event.subtype}` };
      }

      // Must be a thread reply (has thread_ts different from ts)
      if (!event.thread_ts || event.thread_ts === event.ts) {
        return { skipped: true, reason: 'Not a thread reply' };
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
        return { skipped: true, reason: 'Duplicate event' };
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
        // Not a thread we're tracking
        return { skipped: true, reason: 'No matching ticket found' };
      }

      // Ignore messages from our own bot
      const botUserId = ticket.account.slackInstallation?.botUserId;
      if (event.bot_id || event.user === botUserId) {
        return { skipped: true, reason: 'Message from our bot' };
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
          rawSlackEvent: slackPayload as never,
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

      return { processed: true, messageId: message.id };
    },
    bullMQConnection
  );

  worker.on('completed', (job) => {
    console.log(`Slack event job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Slack event job ${job?.id} failed:`, err);
  });

  return worker;
}

// Export a function to start the worker
export function startSlackEventWorker(): Worker<SlackEventJobData> {
  const worker = createSlackEventWorker();
  console.log('Slack event worker started');
  return worker;
}

