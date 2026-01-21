import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import { settings } from '~/lib/settings.server';
import {
  listProducts,
  getOrCreateCustomer,
  createCheckoutSession,
  createBillingPortalSession,
} from '~/lib/stripe.server';

/**
 * GET /api/stripe/products - List available products
 * GET /api/stripe/subscription - Get current account subscription
 * POST /api/stripe/checkout - Create checkout session
 * POST /api/stripe/billing-portal - Create billing portal session
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (path === 'products') {
    const products = await listProducts();
    return Response.json({ products });
  }

  if (path === 'subscription') {
    const subscription = await prisma.subscription.findUnique({
      where: { accountId: user.accountId },
    });
    return Response.json({ subscription });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    if (path === 'checkout') {
      const body = await request.json();
      const { priceId } = body;

      if (!priceId) {
        return Response.json({ error: 'priceId is required' }, { status: 400 });
      }

      const account = await prisma.account.findUnique({
        where: { id: user.accountId },
      });

      if (!account) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      // Get or create Stripe customer
      const customer = await getOrCreateCustomer({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          accountId: user.accountId,
          userId: user.id,
        },
      });

      // Create or update subscription record with incomplete status
      await prisma.subscription.upsert({
        where: { accountId: user.accountId },
        create: {
          accountId: user.accountId,
          stripeCustomerId: customer.id,
          status: 'incomplete',
        },
        update: {
          stripeCustomerId: customer.id,
          status: 'incomplete',
        },
      });

      // Create checkout session
      const session = await createCheckoutSession({
        priceId,
        customerId: customer.id,
        successUrl: `${settings.BASE_URL}/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${settings.BASE_URL}/stripe/checkout/cancel`,
        accountId: user.accountId,
        userId: user.id,
      });

      return Response.json({ url: session.url });
    }

    if (path === 'billing-portal') {
      const subscription = await prisma.subscription.findUnique({
        where: { accountId: user.accountId },
      });

      if (!subscription) {
        return Response.json({ error: 'No subscription found' }, { status: 404 });
      }

      const session = await createBillingPortalSession({
        customerId: subscription.stripeCustomerId,
        returnUrl: `${settings.BASE_URL}/tickets`,
      });

      return Response.json({ url: session.url });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Stripe API error:', error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
