import type { ActionFunctionArgs } from 'react-router';
import { verifySlackSignature, type SlackEventPayload } from '~/lib/slack.server';
import { enqueueSlackEvent } from '~/lib/redis.server';
import { isServerless, getDeploymentEnvironment } from '~/lib/env.server';
import { processSlackEvent } from '~/lib/slack-processor.server';

/**
 * POST /slack/events
 * Receives events from Slack Events API.
 * Must respond quickly (within 3 seconds) to avoid retries.
 * 
 * Processing modes:
 * - Serverless (Vercel, Lambda): Process inline immediately
 * - Persistent server: Queue for background worker processing
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

  // For event_callback, process based on environment
  if (payload.type === 'event_callback' && payload.event_id) {
    const eventId = payload.event_id;

    if (isServerless()) {
      // Serverless: Process inline (no workers available)
      console.log(`[${getDeploymentEnvironment()}] Processing Slack event inline: ${eventId}`);
      
      try {
        const result = await processSlackEvent(eventId, payload);
        console.log(`Inline processing result:`, result);
      } catch (err) {
        console.error('Failed to process Slack event inline:', err);
        // Still return 200 to avoid Slack retries - event is already deduplicated
      }
    } else {
      // Persistent server: Queue for background processing
      console.log(`[Persistent Server] Queueing Slack event: ${eventId}`);
      
      enqueueSlackEvent(eventId, payload).catch((err) => {
        console.error('Failed to enqueue Slack event:', err);
      });
    }

    // Respond immediately with 200 OK
    return new Response('OK', { status: 200 });
  }

  // Unknown event type
  return new Response('OK', { status: 200 });
}
