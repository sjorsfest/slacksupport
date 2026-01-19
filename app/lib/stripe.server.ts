import Stripe from 'stripe';
import { settings } from './settings.server';

/**
 * Stripe client for handling payments and subscriptions.
 */
export const stripe = new Stripe(settings.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

/**
 * List all active products with their prices.
 */
export async function listProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    images: product.images,
    defaultPrice: product.default_price as Stripe.Price | null,
    metadata: product.metadata,
  }));
}

/**
 * List all active prices for a specific product.
 */
export async function listPricesForProduct(productId: string) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
  });

  return prices.data;
}

/**
 * Get a product with all its active prices.
 */
export async function getProductWithPrices(productId: string) {
  const [product, prices] = await Promise.all([
    stripe.products.retrieve(productId),
    stripe.prices.list({ product: productId, active: true }),
  ]);

  return {
    product,
    prices: prices.data,
  };
}

/**
 * Create a checkout session to start a subscription or one-time payment.
 */
export async function createCheckoutSession({
  priceId,
  customerId,
  customerEmail,
  successUrl,
  cancelUrl,
  accountId,
  userId,
  metadata,
  couponId,
}: {
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  accountId?: string;
  userId?: string;
  metadata?: Record<string, string>;
  couponId?: string;
}) {
  const sessionMetadata = {
    ...metadata,
    ...(accountId && { accountId }),
    ...(userId && { userId }),
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: sessionMetadata,
    subscription_data: {
      metadata: sessionMetadata,
    },
    ...(couponId && {
      discounts: [{ coupon: couponId }],
    }),
  });

  return session;
}

/**
 * Create a billing portal session for a customer to manage their subscription.
 */
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Get or create a Stripe customer for a user.
 */
export async function getOrCreateCustomer({
  email,
  name,
  metadata,
}: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}) {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata,
  });

  return customer;
}

/**
 * Get a customer's active subscriptions.
 */
export async function getCustomerSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    expand: ['data.items.data.price.product'],
  });

  return subscriptions.data;
}

/**
 * Construct and verify a Stripe webhook event.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
) {
  if (!settings.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    settings.STRIPE_WEBHOOK_SECRET
  );
}
