import type { ActionFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { stripe, constructWebhookEvent } from '~/lib/stripe.server';
import type Stripe from 'stripe';
import type { SubscriptionStatus } from '@prisma/client';

/**
 * POST /stripe/webhooks
 * Receives webhook events from Stripe.
 * Handles subscription lifecycle events.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.warn('Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  console.log(`Processing Stripe webhook: ${event.type}`, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice_payment.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const accountId = session.metadata?.accountId;
  if (!accountId) {
    console.warn('No accountId in checkout session metadata');
    return;
  }

  // Retrieve the full subscription
  const subscriptionId = session.subscription as string | null;
  if (!subscriptionId) {
    console.warn('No subscription in checkout session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });

  const subscriptionItem = subscription.items.data[0];
  const price = subscriptionItem?.price;
  const product = price?.product as Stripe.Product | undefined;
  const currentPeriodStart = subscriptionItem?.current_period_start;
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await prisma.subscription.upsert({
    where: { accountId },
    create: {
      accountId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      stripeProductId: product?.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      stripeProductId: product?.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  console.log(`Subscription created/updated for account ${accountId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const accountId = subscription.metadata?.accountId;

  // Try to find by stripeSubscriptionId first, then by accountId from metadata
  let existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription && accountId) {
    existingSubscription = await prisma.subscription.findUnique({
      where: { accountId },
    });
  }

  if (!existingSubscription) {
    console.warn(`No subscription record found for Stripe subscription ${subscription.id}`);
    return;
  }

  const subscriptionItem = subscription.items.data[0];
  const price = subscriptionItem?.price;
  const product = typeof price?.product === 'string'
    ? await stripe.products.retrieve(price.product)
    : price?.product as Stripe.Product | undefined;
  const currentPeriodStart = subscriptionItem?.current_period_start;
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      stripeProductId: product?.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });

  console.log(`Subscription updated for ${existingSubscription.accountId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription) {
    console.warn(`No subscription record found for deleted subscription ${subscription.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  });

  console.log(`Subscription canceled for ${existingSubscription.accountId}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionRef) return;

  const subscriptionId = typeof subscriptionRef === 'string'
    ? subscriptionRef
    : subscriptionRef.id;

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!existingSubscription) {
    console.warn(`No subscription record found for invoice ${invoice.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: 'past_due',
    },
  });

  console.log(`Subscription marked as past_due for ${existingSubscription.accountId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionRef) return;

  const subscriptionId = typeof subscriptionRef === 'string'
    ? subscriptionRef
    : subscriptionRef.id;

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!existingSubscription) {
    console.warn(`No subscription record found for invoice ${invoice.id}`);
    return;
  }

  // Only update to active if was past_due
  if (existingSubscription.status === 'past_due') {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'active',
      },
    });

    console.log(`Subscription reactivated for ${existingSubscription.accountId}`);
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    paused: 'paused',
  };
  return statusMap[status] || 'incomplete';
}
