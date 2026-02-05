import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { motion } from 'framer-motion';
import { Sparkles, Check, Zap } from 'lucide-react';

import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import {
  getPrices,
  createCheckoutSession,
  stripe,
} from '~/lib/stripe.server';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const subscription = await prisma.subscription.findUnique({
    where: { accountId: user.accountId },
  });

  // Only freemium users should see this page
  const isFreemiumUser = subscription &&
    ['active', 'trialing'].includes(subscription.status) &&
    subscription.stripeProductId === settings.STRIPE_FREEMIUM_PRODUCT_ID;

  if (!isFreemiumUser) {
    // Already a paid user or no subscription, redirect
    return redirect('/tickets');
  }

  // Fetch paid product prices
  const prices = await getPrices(settings.STRIPE_PRODUCT_ID);
  const monthlyPrice = prices.find((p) => p.recurring?.interval === 'month');
  const yearlyPrice = prices.find((p) => p.recurring?.interval === 'year');

  return {
    user,
    monthlyPrice,
    yearlyPrice,
    hasCoupon: !!settings.STRIPE_MONTHLY_COUPON_ID,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const priceId = formData.get('priceId') as string;
  const interval = formData.get('interval') as string;

  if (!priceId) {
    return { error: 'Please select a plan' };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { accountId: user.accountId },
  });

  if (!subscription) {
    return { error: 'No subscription found' };
  }

  // Cancel the existing freemium subscription in Stripe
  if (subscription.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (cancelError) {
      console.error('Failed to cancel freemium subscription:', cancelError);
      // Continue with upgrade even if cancel fails
    }
  }

  // Apply coupon for monthly plan if configured
  const couponId = interval === 'month' && settings.STRIPE_MONTHLY_COUPON_ID
    ? settings.STRIPE_MONTHLY_COUPON_ID
    : undefined;

  // Create checkout session for upgrade
  const session = await createCheckoutSession({
    priceId,
    customerId: subscription.stripeCustomerId,
    successUrl: `${settings.BASE_URL}/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${settings.BASE_URL}/upgrade?canceled=true`,
    accountId: user.accountId,
    userId: user.id,
    couponId,
  });

  return redirect(session.url!);
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function UpgradePage() {
  const { monthlyPrice, yearlyPrice, hasCoupon } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== 'idle';
  const submittingInterval = fetcher.formData?.get('interval');

  const paidFeatures = [
    'Remove "Powered by Donkey Support" branding from the widget',
    'No limit on allowed domains',
    'Access to webhooks',
    'Additional customization options',
    'Priority support', 
  ];

  const yearlySavingsPercentage = monthlyPrice && yearlyPrice
    ? Math.round(((monthlyPrice.unit_amount! * 12 - yearlyPrice.unit_amount!) / (monthlyPrice.unit_amount! * 12)) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto py-6 px-6">
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full mb-4"
        >
          <Sparkles className="w-5 h-5 text-secondary" />
          <span className="text-secondary font-bold">Upgrade to Pro</span>
        </motion.div>
        <h1 className="font-display text-4xl text-secondary-400 mb-2">
          Unlock the full experience
        </h1>
        <p className="text-slate-600 mt-2 max-w-lg mx-auto">
          Remove branding, get priority support, and unlock all features.
        </p>
      </div>

      {fetcher.data?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-center">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Monthly Plan */}
        {monthlyPrice && (
          <div className="relative">
            {hasCoupon && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <Badge className="bg-secondary hover:bg-secondary-600! text-white">
                  First 3 months $0.99
                </Badge>
              </div>
            )}
            <Card className="relative flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-xl">Monthly</CardTitle>
                <CardDescription>Pay as you go, cancel anytime.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  {hasCoupon ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">$0.99</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        <span className="line-through">{formatPrice(monthlyPrice.unit_amount!, monthlyPrice.currency)}</span>
                        <span className="ml-2">then {formatPrice(monthlyPrice.unit_amount!, monthlyPrice.currency)}/month</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {formatPrice(monthlyPrice.unit_amount!, monthlyPrice.currency)}
                      </span>
                      <span className="text-slate-500">/month</span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {paidFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <fetcher.Form method="post">
                  <input type="hidden" name="priceId" value={monthlyPrice.id} />
                  <input type="hidden" name="interval" value="month" />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && submittingInterval === 'month' ? 'Redirecting...' : 'Choose Monthly'}
                  </Button>
                </fetcher.Form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Yearly Plan */}
        {yearlyPrice && (
          <div className="relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-primary hover:bg-primary-600! text-black border-2 border-black font-semibold px-3">
                {yearlySavingsPercentage > 0 ? `Save ${yearlySavingsPercentage}%` : 'Best Value'}
              </Badge>
            </div>
            <Card
              className="flex flex-col border-2 border-black rounded-2xl shiny-card h-full"
              style={{ boxShadow: '4px 4px 0px 0px #1a1a1a' }}
            >
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Yearly
                </CardTitle>
                <CardDescription>Best value for growing businesses.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {formatPrice(yearlyPrice.unit_amount!, yearlyPrice.currency)}
                    </span>
                    <span className="text-slate-500">/year</span>
                  </div>
                  {monthlyPrice && (
                    <div className="text-sm text-slate-600 mt-1">
                      {formatPrice(Math.round(yearlyPrice.unit_amount! / 12), yearlyPrice.currency)}/month billed annually
                    </div>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  <li className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    Everything from the monthly plan, at a much better price
                  </li>
                </ul>
                <fetcher.Form method="post">
                  <input type="hidden" name="priceId" value={yearlyPrice.id} />
                  <input type="hidden" name="interval" value="year" />
                  <Button
                    type="submit"
                    className="w-full bg-secondary hover:bg-secondary/90 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && submittingInterval === 'year' ? 'Redirecting...' : 'Choose Yearly'}
                  </Button>
                </fetcher.Form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {!monthlyPrice && !yearlyPrice && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No subscription plans available. Please contact support.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
