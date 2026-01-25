import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { settings } from './settings.server';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function getRedisUrl(): string {
  return settings.REDIS_URL;
}

// Singleton Redis connection for general use
export const redis = globalThis.__redis ?? new Redis(getRedisUrl(), {
  maxRetriesPerRequest: null,
});

if (settings.NODE_ENV !== 'production') {
  globalThis.__redis = redis;
}

// BullMQ connection options
export const bullMQConnection = {
  connection: redis,
};

// Queue names
export const QUEUE_NAMES = {
  SLACK_EVENTS: 'slack-events',
  DISCORD_EVENTS: 'discord-events',
  TELEGRAM_EVENTS: 'telegram-events',
  WEBHOOK_DELIVERY: 'webhook-delivery',
} as const;

// Create queues
export const slackEventQueue = new Queue(QUEUE_NAMES.SLACK_EVENTS, bullMQConnection);
export const discordEventQueue = new Queue(QUEUE_NAMES.DISCORD_EVENTS, bullMQConnection);
export const telegramEventQueue = new Queue(QUEUE_NAMES.TELEGRAM_EVENTS, bullMQConnection);
export const webhookDeliveryQueue = new Queue(QUEUE_NAMES.WEBHOOK_DELIVERY, bullMQConnection);

/**
 * Add a job to the Slack events queue.
 */
export async function enqueueSlackEvent(eventId: string, payload: unknown): Promise<Job> {
  return slackEventQueue.add('process', { eventId, payload }, {
    jobId: eventId, // Use event ID for deduplication
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

/**
 * Add a job to the Discord events queue.
 */
export async function enqueueDiscordEvent(eventId: string, payload: unknown): Promise<Job> {
  return discordEventQueue.add('process', { eventId, payload }, {
    jobId: eventId, // Use event ID for deduplication
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

/**
 * Add a job to the Telegram events queue.
 */
export async function enqueueTelegramEvent(update: { update_id: number; [key: string]: unknown }): Promise<Job> {
  const updateId = String(update.update_id);
  return telegramEventQueue.add('process', { updateId, update }, {
    jobId: `telegram-${updateId}`, // Use update ID for deduplication
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

/**
 * Add a job to the webhook delivery queue.
 */
export async function enqueueWebhookDelivery(deliveryId: string, data: {
  endpointId: string;
  url: string;
  secret: string;
  payload: unknown;
}): Promise<Job> {
  return webhookDeliveryQueue.add('deliver', { deliveryId, ...data }, {
    jobId: deliveryId,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

// Export types for workers
export type SlackEventJobData = {
  eventId: string;
  payload: unknown;
};

export type DiscordEventJobData = {
  eventId: string;
  payload: unknown;
};

export type TelegramEventJobData = {
  updateId: string;
  update: unknown;
};

export type WebhookDeliveryJobData = {
  deliveryId: string;
  endpointId: string;
  url: string;
  secret: string;
  payload: unknown;
};

export { Worker, Job };
