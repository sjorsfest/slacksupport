import {
  ZapIcon,
  ShieldIcon,
  CodeXmlIcon,
  PaletteIcon,
  Building2Icon,
} from './Icons';

export function Features() {
  return (
    <section id="features" className="py-16 md:py-24 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-accent font-medium text-sm uppercase tracking-wider">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            Everything you need to deliver
            <br />
            <span className="bg-gradient-to-r from-slack-blue via-primary to-accent bg-clip-text text-transparent">
              exceptional support
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Built on a modern, secure architecture that scales with your business.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Real-time Sync - Large card */}
          <div className="group bg-card rounded-2xl p-6 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300 md:col-span-2 lg:col-span-1 lg:row-span-2">
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <ZapIcon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Real-time Sync</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Messages flow instantly between your website and Slack using WebSockets. No delays, no polling.
                </p>
              </div>
              <div className="mt-6 flex-1 flex items-end">
                <div className="w-full bg-surface rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Live connection</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 bg-accent/30 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
                      <div className="flex-1 h-2 bg-muted rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 bg-accent/30 rounded animate-pulse" style={{ animationDelay: '400ms' }} />
                      <div className="flex-1 h-2 bg-muted rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 bg-accent/30 rounded animate-pulse" style={{ animationDelay: '600ms' }} />
                      <div className="flex-1 h-2 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="group bg-card rounded-2xl p-6 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300">
            <div className="h-full flex flex-col">
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <ShieldIcon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Uncompromised Security</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  AES-256 encryption at rest. Slack signature verification on every request. SOC 2 compliant.
                </p>
              </div>
              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <ShieldIcon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 h-2 bg-gradient-to-r from-accent/50 to-accent/10 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Developer Friendly */}
          <div className="group bg-card rounded-2xl p-6 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300">
            <div className="h-full flex flex-col">
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <CodeXmlIcon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Developer Friendly</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Webhooks, REST API, and event subscriptions. Build custom workflows on top.
                </p>
              </div>
              <div className="mt-6">
                <div className="bg-foreground/5 rounded-lg p-3 font-mono text-xs">
                  <div className="text-muted-foreground">
                    <span className="text-accent">{'{'}</span>
                    <br />
                    <span className="ml-2">"event": <span className="text-primary">"message.new"</span>,</span>
                    <br />
                    <span className="ml-2">"data": <span className="text-accent">{'{ ... }'}</span></span>
                    <br />
                    <span className="text-accent">{'}'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Perfect Widget */}
          <div className="group bg-card rounded-2xl p-6 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300">
            <div className="h-full flex flex-col">
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <PaletteIcon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">The Perfect Widget</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Customizable colors, position, and behavior. Lightweight and iframe-isolated.
                </p>
              </div>
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: '#4A154B' }} />
                  <div className="w-6 h-6 rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: '#1264A3' }} />
                  <div className="w-6 h-6 rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: '#36C5F0' }} />
                  <div className="w-6 h-6 rounded-full border-2 border-card shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: '#2EB67D' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Tenant */}
          <div className="group bg-card rounded-2xl p-6 border border-border hover:shadow-xl hover:border-accent/30 transition-all duration-300">
            <div className="h-full flex flex-col">
              <div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Building2Icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Multi-Tenant</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Manage multiple brands and websites from a single Slack workspace. Keep conversations organized.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

