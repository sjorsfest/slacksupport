import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import {
  getProductWithPrices,
  getOrCreateCustomer,
  createCheckoutSession,
} from '~/lib/stripe.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Check if already has an active subscription
  const subscription = await prisma.subscription.findUnique({
    where: { accountId: user.accountId },
  });

  if (subscription && ['active', 'trialing'].includes(subscription.status)) {
    return redirect('/onboarding');
  }

  // Fetch the product with all its prices
  const { product, prices } = await getProductWithPrices(settings.STRIPE_PRODUCT_ID);

  // Separate monthly and yearly prices
  const monthlyPrice = prices.find((p) => p.recurring?.interval === 'month');
  const yearlyPrice = prices.find((p) => p.recurring?.interval === 'year');

  // Check for canceled query param
  const url = new URL(request.url);
  const canceled = url.searchParams.get('canceled') === 'true';

  return {
    user,
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    },
    monthlyPrice,
    yearlyPrice,
    canceled,
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

  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
  });

  if (!account) {
    return { error: 'Account not found' };
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

  // Apply coupon for monthly plan if configured
  const couponId = interval === 'month' && settings.STRIPE_MONTHLY_COUPON_ID
    ? settings.STRIPE_MONTHLY_COUPON_ID
    : undefined;

  // Create checkout session
  const session = await createCheckoutSession({
    priceId,
    customerId: customer.id,
    successUrl: `${settings.BASE_URL}/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${settings.BASE_URL}/stripe/checkout/cancel`,
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

export default function OnboardingSubscription() {
  const { product, monthlyPrice, yearlyPrice, canceled, hasCoupon } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state !== 'idle';

  // Calculate yearly savings
  const yearlySavingsPercentage = monthlyPrice && yearlyPrice
    ? Math.round(((monthlyPrice.unit_amount! * 12 - yearlyPrice.unit_amount!) / (monthlyPrice.unit_amount! * 12)) * 100)
    : 0;

  const monthlyFeatures = [
    'Customer support through your preferred platform',
    'Customise the widget to fit your brand style',
    'Webhooks to build custom logic for your chats',
    'Can be used on 5 different domains',
  ];

  const yearlyFeatures = [
    'Everything from the monthly plan!',
    'Much much cheaper',
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 px-6 h-full flex flex-col">
      <div className="text-center mb-10">

        <h1 className="font-display text-3xl text-secondary-400">Choose your plan</h1>
        <p className="text-slate-600 mt-2">
          Select a subscription plan to get started with your support widget.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <Badge className="bg-primary text-primary-foreground">0 · Plan</Badge>
        <Badge variant="muted" className="rounded-full px-4 py-1">1 · Domains</Badge>
        <Badge variant="muted" className="rounded-full px-4 py-1">2 · Slack</Badge>
        <Badge variant="muted" className="rounded-full px-4 py-1">3 · Embed</Badge>
      </div>

      {canceled && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-center">
          Checkout was canceled. Please select a plan to continue.
        </div>
      )}

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
                <Badge className="bg-secondary hover:bg-secondary-600! text-white">First 3 months $0.99</Badge>
              </div>
            )}
            <Card className="relative flex flex-col">

            <CardHeader>
              <CardTitle className="text-xl">Monthly</CardTitle>
              <CardDescription>Perfect for getting started and testing the waters.</CardDescription>
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
                    <span className="text-3xl font-bold">{formatPrice(monthlyPrice.unit_amount!, monthlyPrice.currency)}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {monthlyFeatures.map((feature: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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
                  {isSubmitting ? 'Redirecting...' : 'Select Monthly'}
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
              <CardTitle className="text-xl">Yearly</CardTitle>
              <CardDescription>The best value for growing businesses.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{formatPrice(yearlyPrice.unit_amount!, yearlyPrice.currency)}</span>
                  <span className="text-slate-500">/year</span>
                </div>
                {monthlyPrice && (
                  <div className="text-sm text-slate-600 mt-1">
                    {formatPrice(Math.round(yearlyPrice.unit_amount! / 12), yearlyPrice.currency)}/month billed annually
                  </div>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {yearlyFeatures.map((feature: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <fetcher.Form method="post">
                <input type="hidden" name="priceId" value={yearlyPrice.id} />
                <input type="hidden" name="interval" value="year" />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Redirecting...' : 'Select Yearly'}
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
