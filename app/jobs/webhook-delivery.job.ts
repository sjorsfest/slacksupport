import { Worker, type Job } from 'bullmq';
import { deliverWebhook, markDeliveryFailed, type WebhookPayload } from '~/lib/webhook.server';
import { bullMQConnection, QUEUE_NAMES, type WebhookDeliveryJobData } from '~/lib/redis.server';

const MAX_ATTEMPTS = 5;

/**
 * Process webhook deliveries with exponential backoff.
 */
export function createWebhookDeliveryWorker(): Worker<WebhookDeliveryJobData> {
  const worker = new Worker<WebhookDeliveryJobData>(
    QUEUE_NAMES.WEBHOOK_DELIVERY,
    async (job: Job<WebhookDeliveryJobData>) => {
      const { deliveryId, url, secret, payload } = job.data;

      console.log(`Delivering webhook ${deliveryId} to ${url}`);

      const result = await deliverWebhook(
        deliveryId,
        url,
        secret,
        payload as WebhookPayload
      );

      if (!result.success) {
        // Check if we've exhausted retries
        if (job.attemptsMade >= MAX_ATTEMPTS - 1) {
          await markDeliveryFailed(deliveryId);
          console.log(`Webhook delivery ${deliveryId} permanently failed after ${MAX_ATTEMPTS} attempts`);
          return { success: false, permanent: true };
        }

        // Throw to trigger retry with backoff
        throw new Error(result.error || `HTTP ${result.statusCode}`);
      }

      console.log(`Webhook delivery ${deliveryId} successful`);
      return { success: true };
    },
    {
      ...bullMQConnection,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          // Exponential backoff: 1s, 5s, 30s, 2min, 10min
          const delays = [1000, 5000, 30000, 120000, 600000];
          return delays[Math.min(attemptsMade, delays.length - 1)];
        },
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Webhook delivery job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Webhook delivery job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// Export a function to start the worker
export function startWebhookDeliveryWorker(): Worker<WebhookDeliveryJobData> {
  const worker = createWebhookDeliveryWorker();
  console.log('Webhook delivery worker started');
  return worker;
}

