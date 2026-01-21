import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser, getCurrentUser } from '~/lib/auth.server';
import { createTicketSchema, createMessageSchema, updateTicketSchema, ticketFiltersSchema } from '~/types/schemas';
import { parseRequest } from '~/lib/request.server';
import { createTicketInSlack, postToSlack } from '~/lib/slack.server';
import { createTicketInDiscord, postToDiscord } from '~/lib/discord.server';
import { triggerWebhooks } from '~/lib/webhook.server';

/**
 * GET /api/tickets - List tickets (dashboard)
 * GET /api/tickets/:id - Get single ticket
 * POST /api/tickets - Create ticket (widget)
 * POST /api/tickets/:id/messages - Send message
 * PUT /api/tickets/:id - Update ticket
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const url = new URL(request.url);

  // Widget endpoints don't require auth
  if (path === '' && request.method === 'GET') {
    // Dashboard: List tickets
    const user = await requireUser(request);
    
    const filters = ticketFiltersSchema.parse(Object.fromEntries(url.searchParams));
    
    const where = {
      accountId: user.accountId,
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { subject: { contains: filters.search, mode: 'insensitive' as const } },
          { visitor: { email: { contains: filters.search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          visitor: { select: { email: true, name: true, anonymousId: true } },
          messages: { 
            orderBy: { createdAt: 'desc' }, 
            take: 1,
            select: { text: true, createdAt: true, source: true }
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return Response.json({
      tickets: tickets.map(t => ({
        id: t.id,
        status: t.status,
        subject: t.subject,
        visitor: t.visitor,
        lastMessage: t.messages[0] || null,
        createdAt: t.createdAt,
        slackPermalink: t.slackPermalink,
        discordPermalink: t.discordPermalink,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    });
  }

  // Single ticket
  const ticketIdMatch = path.match(/^([^/]+)$/);
  if (ticketIdMatch) {
    const ticketId = ticketIdMatch[1];
    const user = await requireUser(request);

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, accountId: user.accountId },
      include: {
        visitor: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!ticket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return Response.json({ ticket });
  }

  // GET /api/tickets/:id/messages - Polling endpoint for widget
  const messagesMatch = path.match(/^([^/]+)\/messages$/);
  if (messagesMatch) {
    const ticketId = messagesMatch[1];
    const since = url.searchParams.get('since');

    // Verify ticket exists (no auth required for widget polling)
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
        discordUserName: true,
      },
    });

    return Response.json({
      messages: messages.map((m) => ({
        id: m.id,
        source: m.source,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
        slackUserName: m.slackUserName,
        discordUserName: m.discordUserName,
      })),
      ticketStatus: ticket.status,
    });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';

  // Create ticket (from widget)
  if (path === '' && request.method === 'POST') {
    try {
      const data = await parseRequest(request, createTicketSchema);

      // Validate origin/domain
      const origin = request.headers.get('origin');
      if (origin) {
        const account = await prisma.account.findUnique({
          where: { id: data.accountId },
          select: { allowedDomains: true },
        });
        
        if (account && account.allowedDomains.length > 0) {
          const originHost = new URL(origin).hostname;
          const isAllowed = account.allowedDomains.some(domain => 
            originHost === domain || originHost.endsWith(`.${domain}`)
          );
          if (!isAllowed) {
            return Response.json({ error: 'Origin not allowed' }, { status: 403 });
          }
        }
      }

      // Find or create visitor
      let visitor = await prisma.visitor.findUnique({
        where: {
          accountId_anonymousId: {
            accountId: data.accountId,
            anonymousId: data.visitorId,
          },
        },
      });

      if (!visitor) {
        visitor = await prisma.visitor.create({
          data: {
            accountId: data.accountId,
            anonymousId: data.visitorId,
            email: data.email,
            name: data.name,
            metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
          },
        });
      } else if (data.email || data.name || data.metadata) {
        visitor = await prisma.visitor.update({
          where: { id: visitor.id },
          data: {
            ...(data.email && { email: data.email }),
            ...(data.name && { name: data.name }),
            ...(data.metadata && { metadata: JSON.parse(JSON.stringify(data.metadata)) }),
          },
        });
      }

      // Get default channel configs (Slack or Discord)
      const [slackChannelConfig, discordChannelConfig] = await Promise.all([
        prisma.slackChannelConfig.findFirst({
          where: { accountId: data.accountId, isDefault: true },
        }),
        prisma.discordChannelConfig.findFirst({
          where: { accountId: data.accountId, isDefault: true },
        }),
      ]);

      // Create ticket
      const ticket = await prisma.ticket.create({
        data: {
          accountId: data.accountId,
          visitorId: visitor.id,
          slackChannelId: slackChannelConfig?.slackChannelId,
          discordChannelId: discordChannelConfig?.discordChannelId,
        },
      });

      // Create first message
      const message = await prisma.message.create({
        data: {
          ticketId: ticket.id,
          source: 'visitor',
          text: data.message,
        },
      });

      // Post to Slack if configured
      if (slackChannelConfig) {
        try {
          const slackResult = await createTicketInSlack(
            data.accountId,
            slackChannelConfig.slackChannelId,
            {
              id: ticket.id,
              visitorEmail: visitor.email ?? undefined,
              visitorName: visitor.name ?? undefined,
              firstMessage: data.message,
              metadata: data.metadata,
            }
          );

          if (slackResult) {
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                slackThreadTs: slackResult.threadTs,
                slackRootMessageTs: slackResult.threadTs,
                slackPermalink: slackResult.permalink,
              },
            });
          }
        } catch (slackError) {
          console.error('Failed to post to Slack:', slackError);
          // Don't fail the ticket creation if Slack fails
        }
      }

      // Post to Discord if configured (and Slack not configured - only one integration allowed)
      if (discordChannelConfig && !slackChannelConfig) {
        try {
          const discordResult = await createTicketInDiscord(
            data.accountId,
            discordChannelConfig.discordChannelId,
            {
              id: ticket.id,
              visitorEmail: visitor.email ?? undefined,
              visitorName: visitor.name ?? undefined,
              firstMessage: data.message,
              metadata: data.metadata,
            }
          );

          if (discordResult) {
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: {
                discordThreadId: discordResult.threadId,
                discordMessageId: discordResult.messageId,
                discordPermalink: discordResult.permalink,
              },
            });
          }
        } catch (discordError) {
          console.error('Failed to post to Discord:', discordError);
          // Don't fail the ticket creation if Discord fails
        }
      }

      // Trigger webhooks
      await triggerWebhooks(
        data.accountId,
        ticket.id,
        'ticket.created',
        {
          ticketId: ticket.id,
          accountId: data.accountId,
          visitorId: visitor.id,
          messageId: message.id,
          text: data.message,
        },
        message.id
      );

      return Response.json({ 
        ticketId: ticket.id, 
        messageId: message.id,
        visitorId: visitor.id,
      });
    } catch (error) {
      console.error('Create ticket error:', error);
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ error: 'Failed to create ticket' }, { status: 500 });
    }
  }

  // Send message to ticket
  const messageMatch = path.match(/^([^/]+)\/messages$/);
  if (messageMatch && request.method === 'POST') {
    const ticketId = messageMatch[1];

    try {
      const data = await parseRequest(request, createMessageSchema);

      // Check if this is from widget or dashboard
      const user = await getCurrentUser(request);
      const source = 'visitor';

      // Get ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { account: true },
      });

      if (!ticket) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Verify access (widget: origin check, dashboard: account check)
      if (user && user.accountId !== ticket.accountId) {
        return Response.json({ error: 'Access denied' }, { status: 403 });
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          ticketId,
          source,
          text: data.text,
        },
      });

      // Post to Slack thread if exists
      if (ticket.slackChannelId && ticket.slackThreadTs) {
        try {
          const prefix = source === 'visitor'
            ? '👤 *Visitor:*\n'
            : `💬 *${user?.name || 'Agent'}:*\n`;

          const slackResult = await postToSlack(
            ticket.accountId,
            ticket.slackChannelId,
            prefix + data.text,
            { threadTs: ticket.slackThreadTs }
          );

          if (slackResult?.ts) {
            await prisma.message.update({
              where: { id: message.id },
              data: { slackTs: slackResult.ts },
            });
          }
        } catch (slackError) {
          console.error('Failed to post message to Slack:', slackError);
        }
      }

      // Post to Discord thread if exists
      if (ticket.discordChannelId && ticket.discordThreadId) {
        try {
          const prefix = source === 'visitor'
            ? '**Visitor:**\n'
            : `**${user?.name || 'Agent'}:**\n`;

          const discordResult = await postToDiscord(
            ticket.accountId,
            ticket.discordChannelId,
            prefix + data.text,
            { threadId: ticket.discordThreadId }
          );

          if (discordResult?.id) {
            await prisma.message.update({
              where: { id: message.id },
              data: { discordMessageId: discordResult.id },
            });
          }
        } catch (discordError) {
          console.error('Failed to post message to Discord:', discordError);
        }
      }

      // Trigger webhooks
      await triggerWebhooks(
        ticket.accountId,
        ticketId,
        'message.created',
        {
          ticketId,
          accountId: ticket.accountId,
          messageId: message.id,
          source,
          text: data.text,
        },
        message.id
      );

      return Response.json({ messageId: message.id });
    } catch (error) {
      console.error('Send message error:', error);
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ error: 'Failed to send message' }, { status: 500 });
    }
  }

  // Update ticket
  const updateMatch = path.match(/^([^/]+)$/);
  if (updateMatch && request.method === 'PUT') {
    const ticketId = updateMatch[1];

    try {
      const user = await requireUser(request);
      const data = await parseRequest(request, updateTicketSchema);

      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, accountId: user.accountId },
      });

      if (!ticket) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data,
      });

      // Trigger webhook
      await triggerWebhooks(
        user.accountId,
        ticketId,
        'ticket.updated',
        {
          ticketId,
          accountId: user.accountId,
          status: updated.status,
        }
      );

      return Response.json({ ticket: updated });
    } catch (error) {
      console.error('Update ticket error:', error);
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ error: 'Failed to update ticket' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
