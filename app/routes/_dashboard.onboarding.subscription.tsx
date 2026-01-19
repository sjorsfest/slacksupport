import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import {
  listProducts,
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

  // Fetch available products from Stripe
  const products = await listProducts();

  // Check for canceled query param
  const url = new URL(request.url);
  const canceled = url.searchParams.get('canceled') === 'true';

  return { user, products, canceled };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const priceId = formData.get('priceId') as string;

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

  // Create checkout session
  const session = await createCheckoutSession({
    priceId,
    customerId: customer.id,
    successUrl: `${settings.BASE_URL}/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${settings.BASE_URL}/stripe/checkout/cancel`,
    accountId: user.accountId,
    userId: user.id,
  });

  return redirect(session.url!);
}

function formatPrice(price: { unit_amount: number | null; currency: string; recurring?: { interval: string } | null }) {
  if (!price.unit_amount) return 'Free';
  const amount = price.unit_amount / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
  }).format(amount);
  const interval = price.recurring?.interval;
  return interval ? `${formatted}/${interval}` : formatted;
}

export default function OnboardingSubscription() {
  const { products, canceled } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state !== 'idle';

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl fun-gradient-text">Choose your plan</h1>
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const price = product.defaultPrice;
          if (!price) return null;

          return (
            <Card key={product.id} className="relative flex flex-col">
              {product.metadata?.recommended === 'true' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-emerald-500 text-white">Recommended</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="text-3xl font-bold mb-6">
                  {formatPrice(price)}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {product.metadata?.features?.split(',').map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature.trim()}
                    </li>
                  ))}
                </ul>
                <fetcher.Form method="post">
                  <input type="hidden" name="priceId" value={price.id} />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Redirecting...' : 'Select Plan'}
                  </Button>
                </fetcher.Form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No subscription plans available. Please contact support.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
