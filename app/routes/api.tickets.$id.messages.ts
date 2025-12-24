import type { LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';

/**
 * GET /api/tickets/:id/messages?since=<timestamp>
 * Polling endpoint for real-time message updates on serverless.
 * Returns messages created after the 'since' timestamp.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const ticketId = params.id;
  const url = new URL(request.url);
  const since = url.searchParams.get('since');

  console.log(`[Polling] Fetching messages for ticket ${ticketId}${since ? ` since ${since}` : ''}`);

  if (!ticketId) {
    return Response.json({ error: 'Missing ticket ID' }, { status: 400 });
  }

  // Verify ticket exists
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    return Response.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Build query for messages
  const whereClause: {
    ticketId: string;
    createdAt?: { gt: Date };
  } = { ticketId };

  // If 'since' provided, only get messages after that timestamp
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      whereClause.createdAt = { gt: sinceDate };
    }
  }

  const messages = await prisma.message.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      source: true,
      text: true,
      createdAt: true,
      slackUserName: true,
    },
  });

  return Response.json({
    messages: messages.map((m) => ({
      id: m.id,
      source: m.source,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
      slackUserName: m.slackUserName,
    })),
    ticketStatus: ticket.status,
    serverTime: new Date().toISOString(),
  });
}
