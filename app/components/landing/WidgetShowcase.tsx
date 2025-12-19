import { useState } from 'react';
import { MonitorIcon, SmartphoneIcon } from './Icons';

export function WidgetShowcase() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <section className="py-16 md:py-24 bg-background overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-accent font-medium text-sm uppercase tracking-wider">
            Widget Design
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            Designed to look{' '}
            <span className="bg-gradient-to-r from-slack-blue via-primary to-accent bg-clip-text text-transparent">
              native to your brand
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Pixel-perfect UI that feels like it was built just for your website.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center bg-surface rounded-full p-1 border border-border">
            <button
              onClick={() => setView('desktop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                view === 'desktop'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MonitorIcon className="w-4 h-4" />
              Desktop
            </button>
            <button
              onClick={() => setView('mobile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                view === 'mobile'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SmartphoneIcon className="w-4 h-4" />
              Mobile
            </button>
          </div>
        </div>

        {/* Browser mockup */}
        <div className="relative flex justify-center">
          <div
            className={`relative transition-all duration-500 ${
              view === 'mobile' ? 'w-full max-w-sm' : 'w-full max-w-4xl'
            }`}
          >
            <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
              {/* Browser chrome */}
              <div className="bg-surface px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-background rounded-md px-4 py-1 text-xs text-muted-foreground w-64 text-center">
                    yourwebsite.com
                  </div>
                </div>
              </div>

              {/* Browser content */}
              <div className="relative bg-gradient-to-br from-surface to-background p-8 min-h-[400px]">
                {/* Fake page content */}
                <div className="space-y-4 opacity-30">
                  <div className="h-8 w-32 bg-muted rounded" />
                  <div className="h-4 w-96 max-w-full bg-muted rounded" />
                  <div className="h-4 w-80 max-w-full bg-muted rounded" />
                  <div className="h-32 w-full bg-muted rounded-lg mt-8" />
                </div>

                {/* Widget preview */}
                <div className="absolute bottom-8 right-8">
                  <div className="w-80 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                    {/* Widget header */}
                    <div className="bg-slack-blue p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-white font-bold">A</span>
                        </div>
                        <div className="text-white">
                          <h4 className="font-semibold">Acme Support</h4>
                          <span className="text-sm opacity-80">Usually replies in minutes</span>
                        </div>
                      </div>
                    </div>

                    {/* Widget messages */}
                    <div className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-slack-blue flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                        <div className="bg-surface rounded-2xl rounded-tl-none p-3">
                          <p className="text-sm text-foreground">Hey! How can we help? 👋</p>
                        </div>
                      </div>
                    </div>

                    {/* Widget input */}
                    <div className="p-3 border-t border-border">
                      <div className="flex items-center bg-surface rounded-full px-4 py-2 border border-border">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          className="flex-1 bg-transparent text-sm focus:outline-none"
                          readOnly
                        />
                      </div>
                      <p className="text-center text-xs text-muted-foreground mt-2">
                        Powered by <span className="font-medium">SlackSupport</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          <div className="text-center">
            <h4 className="font-semibold text-foreground mb-1">Message Bubbles</h4>
            <p className="text-sm text-muted-foreground">Clean, readable conversations</p>
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-foreground mb-1">Typing Indicators</h4>
            <p className="text-sm text-muted-foreground">Real-time engagement signals</p>
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-foreground mb-1">Custom Branding</h4>
            <p className="text-sm text-muted-foreground">Match your website perfectly</p>
          </div>
        </div>
      </div>
    </section>
  );
}

