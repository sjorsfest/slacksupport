import { Worker, type Job } from 'bullmq';
import { bullMQConnection, QUEUE_NAMES, type TelegramEventJobData } from '~/lib/redis.server';
import { processTelegramEvent } from '~/lib/telegram-processor.server';
import type { TelegramUpdate } from '~/lib/telegram.server';

/**
 * Process Telegram events asynchronously.
 * This worker handles message events from Telegram forum topics.
 */
export function createTelegramEventWorker(): Worker<TelegramEventJobData> {
  const worker = new Worker<TelegramEventJobData>(
    QUEUE_NAMES.TELEGRAM_EVENTS,
    async (job: Job<TelegramEventJobData>) => {
      const { updateId, update } = job.data;

      console.log(`Processing Telegram event: ${updateId}`);

      const result = await processTelegramEvent(update as TelegramUpdate);

      return result;
    },
    bullMQConnection
  );

  worker.on('completed', (job) => {
    console.log(`Telegram event job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Telegram event job ${job?.id} failed:`, err);
  });

  return worker;
}

// Export a function to start the worker
export function startTelegramEventWorker(): Worker<TelegramEventJobData> {
  const worker = createTelegramEventWorker();
  console.log('Telegram event worker started');
  return worker;
}
