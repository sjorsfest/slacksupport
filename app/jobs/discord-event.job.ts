import { Worker, type Job } from 'bullmq';
import { processDiscordEvent, type DiscordEventPayload } from '~/lib/discord-processor.server';
import { bullMQConnection, QUEUE_NAMES, type DiscordEventJobData } from '~/lib/redis.server';

/**
 * Process Discord events asynchronously.
 * This worker handles message events from Discord threads.
 */
export function createDiscordEventWorker(): Worker<DiscordEventJobData> {
  const worker = new Worker<DiscordEventJobData>(
    QUEUE_NAMES.DISCORD_EVENTS,
    async (job: Job<DiscordEventJobData>) => {
      const { eventId, payload } = job.data;
      const discordPayload = payload as DiscordEventPayload;
      console.log(discordPayload);

      console.log(`Processing Discord event: ${eventId}`);

      const result = await processDiscordEvent(eventId, discordPayload);

      if (result.skipped) {
        console.log(`Discord event ${eventId} skipped: ${result.reason}`);
      }

      return result;
    },
    bullMQConnection
  );

  worker.on('completed', (job) => {
    console.log(`Discord event job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Discord event job ${job?.id} failed:`, err);
  });

  return worker;
}

// Export a function to start the worker
export function startDiscordEventWorker(): Worker<DiscordEventJobData> {
  const worker = createDiscordEventWorker();
  console.log('Discord event worker started');
  return worker;
}
