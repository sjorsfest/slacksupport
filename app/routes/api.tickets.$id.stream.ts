import type { LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { subscribeToTicket, type TicketMessagePayload } from '~/lib/redis.server';
import { isServerless } from '~/lib/env.server';

/**
 * GET /api/tickets/:id/stream
 * Server-Sent Events endpoint for real-time message updates.
 * Works on both serverless (Vercel) and persistent server environments.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const ticketId = params.id;

  if (!ticketId) {
    return new Response('Missing ticket ID', { status: 400 });
  }

  // Verify ticket exists
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    return new Response('Ticket not found', { status: 404 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ ticketId })}\n\n`)
      );

      // Subscribe to Redis pub/sub for this ticket
      unsubscribe = subscribeToTicket(ticketId, (message: TicketMessagePayload) => {
        if (isClosed) return;
        
        try {
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
          );
        } catch (e) {
          // Stream closed
          console.log('SSE stream closed');
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      // This is especially important for serverless environments
      heartbeatInterval = setInterval(() => {
        if (isClosed) return;
        
        try {
          controller.enqueue(encoder.encode(`:heartbeat\n\n`));
        } catch (e) {
          // Stream closed
        }
      }, 30000);
    },
    cancel() {
      isClosed = true;
      if (unsubscribe) unsubscribe();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    isClosed = true;
    if (unsubscribe) unsubscribe();
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}
