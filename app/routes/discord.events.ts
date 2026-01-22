import crypto from 'crypto';
import type { ActionFunctionArgs } from 'react-router';
import { TicketStatus } from '@prisma/client';
import { enqueueDiscordEvent } from '~/lib/redis.server';
import { isServerless, getDeploymentEnvironment } from '~/lib/env.server';
import { processDiscordEvent, type DiscordEventPayload } from '~/lib/discord-processor.server';
import { settings } from '~/lib/settings.server';
import { prisma } from '~/lib/db.server';
import { updateDiscordMessage } from '~/lib/discord.server';

/**
 * Verify Discord interaction signature using Ed25519.
 * Uses Node.js crypto module (available in Node 16+).
 */
function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const publicKey = settings.DISCORD_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  try {
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, 'hex');

    // Create public key object for Ed25519
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 public key DER prefix
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(publicKey, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(null, message, keyObject, sig);
  } catch (error) {
    console.error('Discord signature verification error:', error);
    return false;
  }
}

/**
 * POST /discord/events
 * Receives events from Discord (Gateway events forwarded via webhook or Interactions endpoint).
 *
 * Note: Discord uses different event delivery mechanisms:
 * 1. Interactions Endpoint - For slash commands and button interactions (requires signature verification)
 * 2. Gateway events - Usually handled via WebSocket, but can be forwarded via webhook
 *
 * This endpoint handles both cases.
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  // Verify Discord signature (only if headers are present - for Interactions endpoint)
  if (signature && timestamp) {
    if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
      console.warn('Invalid Discord signature');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let payload: { type?: number; t?: string; d?: unknown; [key: string]: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Handle Discord Interactions endpoint PING (type 1)
  if (payload.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle Message Component interactions (type 3) - button clicks
  if (payload.type === 3) {
    const interaction = payload as {
      data?: { custom_id?: string };
      guild_id?: string;
      channel_id?: string;
      message?: { id: string };
    };

    const customId = interaction.data?.custom_id;
    if (customId?.startsWith('toggle_status:')) {
      const ticketId = customId.replace('toggle_status:', '');

      // Find installation by guild ID
      const guildId = interaction.guild_id;
      const installation = await prisma.discordInstallation.findFirst({
        where: { discordGuildId: guildId },
        select: { accountId: true },
      });

      if (!installation) {
        return new Response(
          JSON.stringify({
            type: 4, // Channel message with source
            data: { content: 'Installation not found', flags: 64 }, // Ephemeral
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get current ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
          visitor: true,
        },
      });

      if (!ticket) {
        return new Response(
          JSON.stringify({
            type: 4,
            data: { content: 'Ticket not found', flags: 64 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Toggle status between OPEN and CLOSED
      const newStatus = ticket.status === TicketStatus.OPEN ? TicketStatus.CLOSED : TicketStatus.OPEN;

      // Update ticket in database
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 1 },
          visitor: true,
        },
      });

      // Update the Discord message
      // Use ticket's stored channel ID, not interaction.channel_id
      // For thread-starter messages, interaction.channel_id returns the thread ID,
      // but the message is in the parent channel stored on the ticket
      const channelId = ticket.discordChannelId;
      const messageId = ticket.discordMessageId || interaction.message?.id;

      if (channelId && messageId) {
        const success = await updateDiscordMessage(installation.accountId, channelId, messageId, {
          id: updatedTicket.id,
          status: updatedTicket.status,
          firstMessage: updatedTicket.messages[0]?.text || 'No message',
          visitorEmail: updatedTicket.visitor.email || undefined,
          visitorName: updatedTicket.visitor.name || undefined,
          metadata: updatedTicket.visitor.metadata as Record<string, unknown>,
        });
        if (!success) {
          console.error('Failed to update Discord message for ticket:', ticketId);
        }
      } else {
        console.warn('Missing channel or message ID for ticket:', ticketId, { channelId, messageId });
      }

      // Respond with update acknowledgement (type 6 = deferred update, no visible response)
      return new Response(JSON.stringify({ type: 6 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Unknown component interaction
    return new Response(JSON.stringify({ type: 6 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle Gateway events (MESSAGE_CREATE, etc.)
  if (payload.t === 'MESSAGE_CREATE' && payload.d) {
    const eventId = (payload.d as { id?: string }).id || `discord-${Date.now()}`;

    if (isServerless()) {
      // Serverless: Process inline
      console.log(`[Discord Events] Running in SERVERLESS mode (${getDeploymentEnvironment()}) - Processing event inline: ${eventId}`);

      try {
        const result = await processDiscordEvent(eventId, payload as DiscordEventPayload);
        console.log(`Inline processing result:`, result);
      } catch (err) {
        console.error('Failed to process Discord event inline:', err);
      }
    } else {
      // Persistent server: Queue for background processing
      console.log(`[Discord Events] Running in PERSISTENT SERVER mode - Queueing event: ${eventId}`);

      enqueueDiscordEvent(eventId, payload).catch((err) => {
        console.error('Failed to enqueue Discord event:', err);
      });
    }

    return new Response('OK', { status: 200 });
  }

  // Unknown event type - still return 200 OK
  return new Response('OK', { status: 200 });
}
