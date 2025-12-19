import { CircleXIcon, CircleCheckIcon, ArrowRightIcon } from './Icons';

export function ProblemSolution() {
  return (
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Problem card */}
          <div className="bg-card rounded-2xl p-8 border border-border shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <CircleXIcon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground">The Problem</h3>
            </div>
            <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Stop the Tab Switching.
            </h4>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Logging into Zendesk, Intercom, or Freshdesk just to answer one customer question breaks your flow. By the time you're in, you've lost context on what you were working on.
            </p>
            <ul className="space-y-3">
              {[
                'Multiple logins across platforms',
                'Context switching kills productivity',
                'Delayed response times',
                'Another tool to learn',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Solution card */}
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-8 border border-accent/20 shadow-lg relative overflow-hidden">
            {/* Decorative blur */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CircleCheckIcon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground">The Solution</h3>
              </div>
              <h4 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Your Team is Already Here.
              </h4>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Slack is already open. Your team knows how to use threads, reactions, and mentions. Adoption is instant because there's nothing new to learn.
              </p>
              <ul className="space-y-3">
                {[
                  'Reply from where you already are',
                  'Zero learning curve for your team',
                  '10x faster response times',
                  'Threads keep context organized',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-foreground">
                    <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <CircleCheckIcon className="w-3 h-3 text-accent" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="#features" className="inline-flex items-center gap-2 mt-6 text-accent font-medium hover:underline">
                See all features
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

