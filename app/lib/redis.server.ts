import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

// Singleton Redis connection for general use
export const redis = globalThis.__redis ?? new Redis(getRedisUrl(), {
  maxRetriesPerRequest: null,
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis = redis;
}

// BullMQ connection options
export const bullMQConnection = {
  connection: redis,
};

// Queue names
export const QUEUE_NAMES = {
  SLACK_EVENTS: 'slack-events',
  WEBHOOK_DELIVERY: 'webhook-delivery',
} as const;

// Create queues
export const slackEventQueue = new Queue(QUEUE_NAMES.SLACK_EVENTS, bullMQConnection);
export const webhookDeliveryQueue = new Queue(QUEUE_NAMES.WEBHOOK_DELIVERY, bullMQConnection);

// Pub/Sub for real-time message delivery
const pubClient = new Redis(getRedisUrl());
const subClient = new Redis(getRedisUrl());

export type TicketMessagePayload = {
  ticketId: string;
  messageId: string;
  source: string;
  text: string;
  createdAt: string;
  slackUserName?: string;
};

/**
 * Publish a new message to a ticket channel for real-time updates.
 */
export async function publishTicketMessage(ticketId: string, payload: TicketMessagePayload): Promise<void> {
  await pubClient.publish(`ticket:${ticketId}`, JSON.stringify(payload));
}

/**
 * Subscribe to messages for a specific ticket.
 */
export function subscribeToTicket(ticketId: string, callback: (message: TicketMessagePayload) => void): () => void {
  const channel = `ticket:${ticketId}`;
  
  const handler = (subscribedChannel: string, message: string) => {
    if (subscribedChannel === channel) {
      try {
        const payload = JSON.parse(message) as TicketMessagePayload;
        callback(payload);
      } catch (e) {
        console.error('Failed to parse ticket message:', e);
      }
    }
  };
  
  subClient.subscribe(channel);
  subClient.on('message', handler);
  
  // Return unsubscribe function
  return () => {
    subClient.unsubscribe(channel);
    subClient.off('message', handler);
  };
}

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

export type WebhookDeliveryJobData = {
  deliveryId: string;
  endpointId: string;
  url: string;
  secret: string;
  payload: unknown;
};

export { Worker, Job };

