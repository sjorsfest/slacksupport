import { startSlackEventWorker } from './slack-event.job';
import { startDiscordEventWorker } from './discord-event.job';
import { startTelegramEventWorker } from './telegram-event.job';
import { startWebhookDeliveryWorker } from './webhook-delivery.job';
import { initializeDiscordGateway, disconnectDiscordGateway } from '~/lib/discord-gateway.server';
import { setTelegramWebhook, isTelegramConfigured } from '~/lib/telegram.server';

/**
 * Start all background workers and services.
 * This should be called when the server starts.
 */
export async function startAllWorkers() {
  const workers = {
    slackEvent: startSlackEventWorker(),
    discordEvent: startDiscordEventWorker(),
    telegramEvent: startTelegramEventWorker(),
    webhookDelivery: startWebhookDeliveryWorker(),
  };

  console.log('All workers started');

  // Initialize Discord Gateway connection
  const discordClient = await initializeDiscordGateway();
  if (discordClient) {
    console.log('✅ Discord Gateway client initialized');
  }

  // Set up Telegram webhook
  if (isTelegramConfigured()) {
    const webhookSet = await setTelegramWebhook();
    if (webhookSet) {
      console.log('✅ Telegram webhook configured');
    } else {
      console.warn('⚠️ Failed to set Telegram webhook');
    }
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down workers...');
    await Promise.all([
      workers.slackEvent.close(),
      workers.discordEvent.close(),
      workers.telegramEvent.close(),
      workers.webhookDelivery.close(),
      disconnectDiscordGateway(),
    ]);
    console.log('Workers shut down');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return workers;
}

export { startSlackEventWorker } from './slack-event.job';
export { startDiscordEventWorker } from './discord-event.job';
export { startTelegramEventWorker } from './telegram-event.job';
export { startWebhookDeliveryWorker } from './webhook-delivery.job';

