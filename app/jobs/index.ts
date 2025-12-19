import { startSlackEventWorker } from './slack-event.job';
import { startWebhookDeliveryWorker } from './webhook-delivery.job';

/**
 * Start all background workers.
 * This should be called when the server starts.
 */
export function startAllWorkers() {
  const workers = {
    slackEvent: startSlackEventWorker(),
    webhookDelivery: startWebhookDeliveryWorker(),
  };

  console.log('All workers started');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...');
    await Promise.all([
      workers.slackEvent.close(),
      workers.webhookDelivery.close(),
    ]);
    console.log('Workers shut down');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return workers;
}

export { startSlackEventWorker } from './slack-event.job';
export { startWebhookDeliveryWorker } from './webhook-delivery.job';

