import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { stripe } from '~/lib/stripe.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    console.error('No session_id provided to checkout success');
    return redirect('/onboarding/subscription?error=missing_session');
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price.product'],
    });

    if (!session.metadata?.accountId) {
      console.error('No accountId in session metadata', sessionId);
      return redirect('/onboarding/subscription?error=invalid_session');
    }

    const accountId = session.metadata.accountId;
    const subscription = session.subscription as import('stripe').Stripe.Subscription | null;

    if (!subscription) {
      console.error('No subscription in checkout session', sessionId);
      return redirect('/onboarding/subscription?error=no_subscription');
    }

    const subscriptionItem = subscription.items.data[0];
    const price = subscriptionItem?.price;
    const product = price?.product as import('stripe').Stripe.Product | undefined;
    const currentPeriodStart = subscriptionItem?.current_period_start;
    const currentPeriodEnd = subscriptionItem?.current_period_end;

    // Update subscription record in database
    await prisma.subscription.upsert({
      where: { accountId },
      create: {
        accountId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: price?.id,
        stripeProductId: product?.id,
        status: subscription.status as import('@prisma/client').SubscriptionStatus,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: price?.id,
        stripeProductId: product?.id,
        status: subscription.status as import('@prisma/client').SubscriptionStatus,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Redirect to the next onboarding step (domains)
    return redirect('/onboarding/domains');
  } catch (error) {
    console.error('Error processing checkout success:', error);
    return redirect('/onboarding/subscription?error=processing_failed');
  }
}

export default function CheckoutSuccess() {
  // This should never render since loader always redirects
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-600">Processing your subscription...</p>
    </div>
  );
}
