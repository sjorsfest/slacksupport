import { useState } from 'react';
import { ChevronDownIcon } from './Icons';

const faqs = [
  {
    question: 'Do I need to pay for each agent?',
    answer:
      'No! The Starter plan includes 1 seat, but on Pro you get unlimited seats. Your whole team can respond to customer messages without any per-seat charges.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use AES-256 encryption for all data at rest, verify Slack request signatures on every API call, and are SOC 2 compliant. Your customer conversations are safe with us.',
  },
  {
    question: 'Does it work with React, Next.js, or other frameworks?',
    answer:
      "Yes! Our widget is a simple JavaScript snippet that works with any website, whether it's built with React, Next.js, Vue, Angular, or plain HTML. Just paste the code and you're ready to go.",
  },
  {
    question: 'Can I customize the widget appearance?',
    answer:
      "Definitely. You can customize the primary color, greeting message, position (left or right), and more from your dashboard. The widget is designed to blend seamlessly with your brand.",
  },
  {
    question: "What happens if I exceed the free plan's ticket limit?",
    answer:
      "We'll notify you when you're approaching the limit. You can upgrade to Pro anytime for unlimited tickets, or we'll pause new tickets until the next billing cycle. Existing conversations remain accessible.",
  },
  {
    question: 'Can I use multiple websites with one Slack workspace?',
    answer:
      'Yes! With our multi-tenant architecture, you can connect multiple websites to the same Slack workspace. Each site can have its own dedicated channel, keeping conversations organized.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 md:py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-accent font-medium text-sm uppercase tracking-wider">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            Common questions
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about SlackSupport.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`bg-card rounded-xl border border-border px-6 transition-shadow ${
                openIndex === index ? 'shadow-lg' : ''
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between py-5 text-left"
              >
                <span className="text-foreground font-semibold pr-4">{faq.question}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-96 pb-5' : 'max-h-0'
                }`}
              >
                <p className="text-muted-foreground text-sm leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Still have questions?{' '}
            <a href="#" className="text-accent hover:underline font-medium">
              Chat with us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

