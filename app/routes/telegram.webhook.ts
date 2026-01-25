import type { ActionFunctionArgs } from 'react-router';
import { enqueueTelegramEvent } from '~/lib/redis.server';
import { isServerless, getDeploymentEnvironment } from '~/lib/env.server';
import { processTelegramEvent } from '~/lib/telegram-processor.server';
import { getTelegramWebhookSecret, type TelegramUpdate } from '~/lib/telegram.server';

/**
 * POST /telegram/webhook
 * Receives updates from Telegram Bot API.
 * Telegram sends all message events here after setWebhook is called.
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify the secret token header
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = getTelegramWebhookSecret();

  if (!expectedSecret) {
    console.error('Telegram webhook secret not configured');
    return new Response('Server configuration error', { status: 500 });
  }

  if (secretToken !== expectedSecret) {
    console.warn('Invalid Telegram webhook secret');
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse the update
  let update: TelegramUpdate;
  try {
    const rawBody = await request.text();
    update = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const updateId = update.update_id;

  // Process the update
  if (isServerless()) {
    // Serverless: Process inline
    console.log(
      `[Telegram Webhook] Running in SERVERLESS mode (${getDeploymentEnvironment()}) - Processing update inline: ${updateId}`
    );

    try {
      const result = await processTelegramEvent(update);
      console.log(`Inline processing result:`, result);
    } catch (err) {
      console.error('Failed to process Telegram event inline:', err);
    }
  } else {
    // Persistent server: Queue for background processing
    console.log(
      `[Telegram Webhook] Running in PERSISTENT SERVER mode - Queueing update: ${updateId}`
    );

    enqueueTelegramEvent(update).catch((err) => {
      console.error('Failed to enqueue Telegram event:', err);
    });
  }

  // Always return 200 OK to Telegram
  return new Response('OK', { status: 200 });
}
