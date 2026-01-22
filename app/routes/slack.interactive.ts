import type { ActionFunctionArgs } from 'react-router';
import { TicketStatus } from '@prisma/client';
import { prisma } from '~/lib/db.server';
import {
  verifySlackSignature,
  openStatusModal,
  updateSlackMessage,
  postStatusChangeToSlackThread,
} from '~/lib/slack.server';
import { triggerWebhooks } from '~/lib/webhook.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  // Parse payload (it comes as form-urlencoded 'payload' parameter)
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get('payload');
  if (!payloadStr) {
    return new Response('Missing payload', { status: 400 });
  }

  const payload = JSON.parse(payloadStr);
  const teamId = payload.team?.id;

  // Find account by team ID
  const installation = await prisma.slackInstallation.findFirst({
    where: { slackTeamId: teamId },
    select: { accountId: true },
  });

  if (!installation) {
    console.error('No installation found for team:', teamId);
    return new Response('Installation not found', { status: 404 });
  }

  const { accountId } = installation;

  // Handle Button Click
  if (payload.type === 'block_actions') {
    for (const action of payload.actions) {
      // Handle toggle ticket status button (Close/Reopen)
      if (action.action_id === 'toggle_ticket_status') {
        const ticketId = action.value;

        // Get current ticket with all needed data
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            messages: { orderBy: { createdAt: 'asc' }, take: 1 },
            visitor: true,
          },
        });

        if (ticket) {
          // Toggle status
          const newStatus = ticket.status === TicketStatus.OPEN ? TicketStatus.CLOSED : TicketStatus.OPEN;

          // Update ticket in database
          const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: { status: newStatus },
          });

          // Update the Slack message
          if (ticket.slackChannelId && ticket.slackRootMessageTs) {
            await updateSlackMessage(accountId, ticket.slackChannelId, ticket.slackRootMessageTs, {
              id: updatedTicket.id,
              status: updatedTicket.status,
              firstMessage: ticket.messages[0]?.text || 'No message',
              visitorEmail: ticket.visitor.email || undefined,
              visitorName: ticket.visitor.name || undefined,
              metadata: ticket.visitor.metadata as Record<string, unknown>,
            });

            // Post status change message to thread
            await postStatusChangeToSlackThread(
              accountId,
              ticket.slackChannelId,
              ticket.slackThreadTs || ticket.slackRootMessageTs,
              newStatus
            );
          }

          // Trigger webhook
          await triggerWebhooks(accountId, ticketId, 'ticket.updated', {
            ticketId,
            accountId,
            status: newStatus,
          });
        }
      }

      // Handle legacy update_status button (opens modal)
      if (action.action_id === 'update_status') {
        const ticketId = action.value;
        const triggerId = payload.trigger_id;

        // Get current ticket status
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { status: true },
        });

        if (ticket) {
          await openStatusModal(accountId, triggerId, ticketId, ticket.status);
        }
      }
    }
    return new Response('OK', { status: 200 });
  }

  // Handle Modal Submission
  if (payload.type === 'view_submission') {
    const view = payload.view;
    if (view.callback_id === 'update_status_modal') {
      const ticketId = view.private_metadata;
      const statusValue =
        view.state.values.status_block.status_selection.selected_option.value;

      // Update ticket status
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: statusValue as TicketStatus },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          visitor: true,
        },
      });

      // Update original Slack message if we have the timestamp
      if (updatedTicket.slackChannelId && updatedTicket.slackRootMessageTs) {
        await updateSlackMessage(
          accountId,
          updatedTicket.slackChannelId,
          updatedTicket.slackRootMessageTs,
          {
            id: updatedTicket.id,
            status: updatedTicket.status,
            firstMessage: updatedTicket.messages[0]?.text || 'No message',
            visitorEmail: updatedTicket.visitor.email || undefined,
            visitorName: updatedTicket.visitor.name || undefined,
            metadata: updatedTicket.visitor.metadata as Record<string, unknown>,
          }
        );

        // Post status change message to thread
        await postStatusChangeToSlackThread(
          accountId,
          updatedTicket.slackChannelId,
          updatedTicket.slackThreadTs || updatedTicket.slackRootMessageTs,
          updatedTicket.status
        );
      }

      // Trigger webhook
      await triggerWebhooks(accountId, ticketId, 'ticket.updated', {
        ticketId,
        accountId,
        status: updatedTicket.status,
      });
    }
    // Return empty body to close modal
    return new Response(null, { status: 200 });
  }

  return new Response('OK', { status: 200 });
}
