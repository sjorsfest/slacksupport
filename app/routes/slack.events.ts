import type { ActionFunctionArgs } from 'react-router';
import { verifySlackSignature, type SlackEventPayload } from '~/lib/slack.server';
import { enqueueSlackEvent } from '~/lib/redis.server';

/**
 * POST /slack/events
 * Receives events from Slack Events API.
 * Must respond quickly (within 3 seconds) to avoid retries.
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  // Verify Slack signature
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    console.warn('Invalid Slack signature');
    return new Response('Invalid signature', { status: 401 });
  }

  // Check for retry header - if this is a retry, still process but log it
  const retryNum = request.headers.get('x-slack-retry-num');
  const retryReason = request.headers.get('x-slack-retry-reason');
  if (retryNum) {
    console.log(`Slack retry #${retryNum}, reason: ${retryReason}`);
  }

  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For event_callback, acknowledge immediately and process async
  if (payload.type === 'event_callback' && payload.event_id) {
    // Enqueue for async processing - this is non-blocking
    // The job will handle deduplication via event_id
    enqueueSlackEvent(payload.event_id, payload).catch((err) => {
      console.error('Failed to enqueue Slack event:', err);
    });

    // Respond immediately with 200 OK
    return new Response('OK', { status: 200 });
  }

  // Unknown event type
  return new Response('OK', { status: 200 });
}

