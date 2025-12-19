import { PlugZapIcon, CodeIcon, MessageSquareIcon } from './Icons';

export function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: PlugZapIcon,
      title: 'Connect',
      description: "One-click OAuth with Slack. No API keys to copy, no permissions to configure. Just sign in and you're ready.",
      visual: (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slack-aubergine flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div className="flex-1 h-1 bg-gradient-to-r from-primary to-accent rounded" />
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">✓</span>
          </div>
        </div>
      ),
    },
    {
      number: '02',
      icon: CodeIcon,
      title: 'Embed',
      description: 'Copy a simple 2-line JavaScript snippet to your HTML. Works with any website, framework, or CMS.',
      visual: (
        <div className="bg-foreground rounded-lg p-3 font-mono text-xs">
          <code className="text-green-400">{'<script src="slacksupport.js">'}</code>
          <br />
          <code className="text-green-400">{'</script>'}</code>
        </div>
      ),
    },
    {
      number: '03',
      icon: MessageSquareIcon,
      title: 'Chat',
      description: 'Receive the first message in a dedicated Slack channel. Reply in threads, use emojis, mention teammates.',
      visual: (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center">
              <span className="text-white text-xs font-bold">J</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-card flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">Your team, ready to help</span>
        </div>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-accent font-medium text-sm uppercase tracking-wider">
            How it Works
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            Get started in{' '}
            <span className="bg-gradient-to-r from-slack-blue via-primary to-accent bg-clip-text text-transparent">
              3 minutes
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            No complicated setup. No learning curve. Just connect and start chatting.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="bg-card rounded-2xl p-8 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-5xl font-bold text-muted/30">{step.number}</span>
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground mb-6">{step.description}</p>
                  <div className="mt-auto">{step.visual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

