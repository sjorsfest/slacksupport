import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import { updateAccountSchema, updateWidgetConfigSchema, updateAllowedDomainsSchema } from '~/types/schemas';
import { parseRequest } from '~/lib/request.server';
import { settings } from '~/lib/settings.server';

/**
 * GET /api/account - Get account info
 * PUT /api/account - Update account
 * GET /api/account/widget-config - Get widget config
 * PUT /api/account/widget-config - Update widget config
 * GET /api/account/allowed-domains - Get allowed domains
 * PUT /api/account/allowed-domains - Update allowed domains
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (path === '' || path === 'info') {
    const account = await prisma.account.findUnique({
      where: { id: user.accountId },
      include: {
        slackInstallation: {
          select: {
            slackTeamName: true,
            installedAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    });

    return Response.json({ account });
  }

  if (path === 'widget-config') {
    const config = await prisma.widgetConfig.findUnique({
      where: { accountId: user.accountId },
    });

    return Response.json({ config });
  }

  if (path === 'allowed-domains') {
    const account = await prisma.account.findUnique({
      where: { id: user.accountId },
      select: { allowedDomains: true },
    });

    return Response.json({ allowedDomains: account?.allowedDomains || [] });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';

  if (request.method !== 'PUT') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await requireUser(request);

  try {
    if (path === '' || path === 'info') {
      const data = await parseRequest(request, updateAccountSchema);

      const account = await prisma.account.update({
        where: { id: user.accountId },
        data,
      });

      return Response.json({ account });
    }

    if (path === 'widget-config') {
      const data = await parseRequest(request, updateWidgetConfigSchema);

      const config = await prisma.widgetConfig.upsert({
        where: { accountId: user.accountId },
        update: data,
        create: {
          accountId: user.accountId,
          ...data,
        },
      });

      return Response.json({ config });
    }

    if (path === 'allowed-domains') {
      const { domains } = await parseRequest(request, updateAllowedDomainsSchema);

      const subscription = await prisma.subscription.findUnique({
        where: { accountId: user.accountId },
        select: { stripeProductId: true, status: true },
      });

      const isFreemium = subscription &&
        ['active', 'trialing'].includes(subscription.status) &&
        subscription.stripeProductId === settings.STRIPE_FREEMIUM_PRODUCT_ID;

      if (isFreemium && domains.length > 3) {
        return Response.json(
          { error: 'Freemium accounts are limited to 3 domains. Upgrade to add more.' },
          { status: 400 }
        );
      }

      if (isFreemium && domains.length < 1) {
        return Response.json(
          { error: 'Freemium accounts must have at least 1 allowed domain for security.' },
          { status: 400 }
        );
      }

      const account = await prisma.account.update({
        where: { id: user.accountId },
        data: { allowedDomains: domains },
      });

      return Response.json({ allowedDomains: account.allowedDomains });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
