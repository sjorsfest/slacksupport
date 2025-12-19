import { useState } from 'react';
import { Link } from 'react-router';
import { CheckIcon, SparklesIcon } from './Icons';

export function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small teams getting started',
      price: { monthly: 0, yearly: 0 },
      features: [
        '1 Team Seat',
        '100 Tickets / month',
        'Standard Widget',
        '7-day History',
        'Email Support',
      ],
      cta: 'Start for Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      description: 'For growing teams who need more',
      price: { monthly: 29, yearly: 23 },
      features: [
        'Unlimited Seats',
        'Unlimited Tickets',
        'Remove Branding',
        'Webhooks & API',
        'Priority Support',
        'Advanced Analytics',
        '90-day History',
      ],
      cta: 'Start 14-Day Trial',
      highlighted: true,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-accent font-medium text-sm uppercase tracking-wider">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-3 bg-card rounded-full p-1.5 border border-border">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billing === 'yearly'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-2xl p-8 border hover:shadow-xl transition-all duration-300 ${
                plan.highlighted
                  ? 'border-accent shadow-[0_0_40px_rgba(54,197,240,0.15)]'
                  : 'border-border'
              }`}
            >
              {/* Popular badge */}
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-white text-xs font-medium">
                    <SparklesIcon className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-bold text-foreground">
                    ${billing === 'monthly' ? plan.price.monthly : plan.price.yearly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-foreground">
                    <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <CheckIcon className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                className={`inline-flex items-center justify-center w-full h-11 rounded-md px-8 text-sm font-medium transition-all hover:scale-105 ${
                  plan.highlighted
                    ? 'bg-accent hover:bg-accent/90 text-white'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Need more?{' '}
            <a href="#" className="text-accent hover:underline font-medium">
              Contact us for Enterprise pricing
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

