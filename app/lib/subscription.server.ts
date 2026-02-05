import type { Subscription } from '@prisma/client';

import { prisma } from '~/lib/db.server';
import { createFreemiumSubscription } from '~/lib/stripe.server';

export async function ensureFreemiumSubscription({
  accountId,
  userId,
  email,
  name,
}: {
  accountId: string;
  userId: string;
  email: string;
  name?: string | null;
}): Promise<Subscription | null> {
  const existing = await prisma.subscription.findUnique({
    where: { accountId },
  });

  if (existing) {
    return existing;
  }

  try {
    const { customer, subscription, priceId, productId } = await createFreemiumSubscription({
      email,
      name: name || undefined,
      accountId,
      userId,
    });

    const subscriptionItem = subscription.items.data[0];
    const currentPeriodStart = subscriptionItem?.current_period_start;
    const currentPeriodEnd = subscriptionItem?.current_period_end;

    return await prisma.subscription.create({
      data: {
        accountId,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeProductId: productId,
        status: 'active',
        currentPeriodStart: currentPeriodStart
          ? new Date(currentPeriodStart * 1000)
          : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      },
    });
  } catch (error) {
    console.error('Failed to create freemium subscription:', error);
    const existingAfterError = await prisma.subscription.findUnique({
      where: { accountId },
    });
    return existingAfterError || null;
  }
}
