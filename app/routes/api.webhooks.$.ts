import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import { createWebhookSchema, updateWebhookSchema } from '~/types/schemas';
import { parseRequest } from '~/lib/request.server';
import { createWebhookEndpoint, rotateWebhookSecret, getDeliveryHistory } from '~/lib/webhook.server';

/**
 * GET /api/webhooks - List webhook endpoints
 * POST /api/webhooks - Create webhook endpoint
 * GET /api/webhooks/:id - Get webhook endpoint
 * PUT /api/webhooks/:id - Update webhook endpoint
 * DELETE /api/webhooks/:id - Delete webhook endpoint
 * POST /api/webhooks/:id/rotate-secret - Rotate webhook secret
 * GET /api/webhooks/:id/deliveries - Get delivery history
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);
  const url = new URL(request.url);

  // List webhooks
  if (path === '') {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { accountId: user.accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { deliveries: true },
        },
      },
    });

    return Response.json({ endpoints });
  }

  // Get single webhook
  const webhookMatch = path.match(/^([^/]+)$/);
  if (webhookMatch) {
    const webhookId = webhookMatch[1];

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, accountId: user.accountId },
      select: {
        id: true,
        url: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!endpoint) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json({ endpoint });
  }

  // Get deliveries
  const deliveriesMatch = path.match(/^([^/]+)\/deliveries$/);
  if (deliveriesMatch) {
    const webhookId = deliveriesMatch[1];

    // Verify webhook belongs to user
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, accountId: user.accountId },
    });

    if (!endpoint) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const cursor = url.searchParams.get('cursor') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const result = await getDeliveryHistory(webhookId, { cursor, limit });

    return Response.json(result);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  // Create webhook
  if (path === '' && request.method === 'POST') {
    try {
      const data = await parseRequest(request, createWebhookSchema);

      const endpoint = await createWebhookEndpoint(user.accountId, data.url);

      return Response.json({ endpoint });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ error: 'Failed to create webhook' }, { status: 500 });
    }
  }

  // Update webhook
  const updateMatch = path.match(/^([^/]+)$/);
  if (updateMatch && request.method === 'PUT') {
    const webhookId = updateMatch[1];

    try {
      const data = await parseRequest(request, updateWebhookSchema);

      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: webhookId, accountId: user.accountId },
      });

      if (!endpoint) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      const updated = await prisma.webhookEndpoint.update({
        where: { id: webhookId },
        data,
        select: {
          id: true,
          url: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return Response.json({ endpoint: updated });
    } catch (error) {
      if (error instanceof Error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      return Response.json({ error: 'Failed to update webhook' }, { status: 500 });
    }
  }

  // Delete webhook
  if (updateMatch && request.method === 'DELETE') {
    const webhookId = updateMatch[1];

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, accountId: user.accountId },
    });

    if (!endpoint) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({ where: { id: webhookId } });

    return Response.json({ success: true });
  }

  // Rotate secret
  const rotateMatch = path.match(/^([^/]+)\/rotate-secret$/);
  if (rotateMatch && request.method === 'POST') {
    const webhookId = rotateMatch[1];

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: webhookId, accountId: user.accountId },
    });

    if (!endpoint) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const newSecret = await rotateWebhookSecret(webhookId);

    return Response.json({ secret: newSecret, id: webhookId });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
