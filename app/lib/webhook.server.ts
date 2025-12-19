import { prisma } from './db.server';
import { signWebhookPayload, generateWebhookSecret } from './crypto.server';
import { enqueueWebhookDelivery } from './redis.server';
import { v4 as uuidv4 } from 'uuid';

export type WebhookEventType = 'ticket.created' | 'message.created' | 'ticket.updated';

export type WebhookPayload = {
  event: WebhookEventType;
  timestamp: string;
  data: {
    ticketId: string;
    accountId: string;
    messageId?: string;
    source?: string;
    text?: string;
    visitorId?: string;
    status?: string;
    [key: string]: unknown;
  };
};

/**
 * Create a new webhook endpoint for an account.
 */
export async function createWebhookEndpoint(accountId: string, url: string): Promise<{
  id: string;
  url: string;
  secret: string;
}> {
  const secret = generateWebhookSecret();

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      accountId,
      url,
      secret,
    },
  });

  return {
    id: endpoint.id,
    url: endpoint.url,
    secret: endpoint.secret,
  };
}

/**
 * Rotate the secret for a webhook endpoint.
 */
export async function rotateWebhookSecret(endpointId: string): Promise<string> {
  const newSecret = generateWebhookSecret();

  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { secret: newSecret },
  });

  return newSecret;
}

/**
 * Trigger webhook delivery for all enabled endpoints of an account.
 */
export async function triggerWebhooks(
  accountId: string,
  ticketId: string,
  event: WebhookEventType,
  data: WebhookPayload['data'],
  messageId?: string
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      accountId,
      enabled: true,
    },
  });

  if (endpoints.length === 0) {
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const endpoint of endpoints) {
    const idempotencyKey = `${endpoint.id}:${event}:${messageId || ticketId}:${uuidv4()}`;

    // Create delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        ticketId,
        messageId,
        idempotencyKey,
        payload: payload as never,
        status: 'pending',
      },
    });

    // Enqueue for async delivery
    await enqueueWebhookDelivery(delivery.id, {
      endpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      payload,
    });
  }
}

/**
 * Deliver a webhook to an endpoint.
 * Called by the webhook delivery worker.
 */
export async function deliverWebhook(
  deliveryId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, secret, timestamp);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-ID': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const success = response.status >= 200 && response.status < 300;

    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        status: success ? 'success' : 'pending',
        lastStatusCode: response.status,
        lastError: success ? null : `HTTP ${response.status}`,
      },
    });

    return { success, statusCode: response.status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update delivery record with error
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: errorMessage,
      },
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Mark a delivery as permanently failed after max retries.
 */
export async function markDeliveryFailed(deliveryId: string): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'failed',
    },
  });
}

/**
 * Get delivery history for a webhook endpoint.
 */
export async function getDeliveryHistory(
  endpointId: string,
  options?: { limit?: number; cursor?: string }
): Promise<{
  deliveries: Array<{
    id: string;
    ticketId: string;
    status: string;
    attemptCount: number;
    lastAttemptAt: Date | null;
    lastError: string | null;
    createdAt: Date;
  }>;
  nextCursor?: string;
}> {
  const limit = options?.limit || 20;

  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      endpointId,
      ...(options?.cursor ? { id: { lt: options.cursor } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      ticketId: true,
      status: true,
      attemptCount: true,
      lastAttemptAt: true,
      lastError: true,
      createdAt: true,
    },
  });

  const hasMore = deliveries.length > limit;
  if (hasMore) {
    deliveries.pop();
  }

  return {
    deliveries,
    nextCursor: hasMore ? deliveries[deliveries.length - 1]?.id : undefined,
  };
}

