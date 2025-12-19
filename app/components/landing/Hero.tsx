import { Link } from 'react-router';
import {
  SparklesIcon,
  SlackIcon,
  MessageCircleIcon,
  SendIcon,
  HashIcon,
  EllipsisVerticalIcon,
  PaperclipIcon,
  AtSignIcon,
  SmileIcon,
} from './Icons';

export function Hero() {
  return (
    <section className="relative min-h-screen pt-24 md:pt-32 pb-16 overflow-hidden bg-gradient-to-b from-surface to-background">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Beta badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <SparklesIcon className="w-4 h-4" />
            Now in Public Beta
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-center tracking-tight text-foreground max-w-4xl mx-auto leading-tight">
          Support your customers{' '}
          <span className="bg-gradient-to-r from-slack-blue via-primary to-accent bg-clip-text text-transparent">
            without leaving Slack.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg md:text-xl text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
          The widget for your website. The dashboard is your Slack channel. No new logins, no separate tabs. Just instant, real-time support.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-md bg-slack-blue hover:bg-slack-blue/90 text-white transition-all hover:scale-105 text-base px-8 py-4 h-auto"
          >
            <SlackIcon className="w-5 h-5" />
            Install to Slack
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 font-medium border border-border bg-background hover:bg-surface rounded-md transition-all hover:scale-105 text-base px-8 py-4 h-auto"
          >
            View Live Demo
          </a>
        </div>

        {/* Demo mockups */}
        <div className="mt-16 md:mt-20 relative">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-4 relative">
            {/* Widget mockup */}
            <div className="relative z-10">
              <WidgetMockup />
            </div>

            {/* Arrow */}
            <div className="hidden lg:flex items-center justify-center relative z-0">
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none" className="text-accent">
                <path d="M0 30 Q60 0 120 30" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" fill="none" />
                <polygon points="110,25 120,30 110,35" fill="currentColor" />
              </svg>
            </div>

            {/* Slack mockup */}
            <div className="relative z-10">
              <SlackMockup />
            </div>
          </div>

          {/* Gradient fade at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>
    </section>
  );
}

function WidgetMockup() {
  return (
    <div className="w-[320px] sm:w-[360px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-slack-blue p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold">Acme Support</h4>
            <span className="text-sm text-white/80 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              Online
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-4 bg-surface min-h-[200px]">
        {/* Agent message */}
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-slack-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="bg-card rounded-2xl rounded-tl-none p-3 shadow-sm border border-border max-w-[80%]">
            <p className="text-sm text-foreground">Hi there! 👋 How can I help you today?</p>
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-slack-blue rounded-2xl rounded-tr-none p-3 max-w-[80%]">
            <p className="text-sm text-white">Do you support SSO?</p>
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-slack-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="bg-card rounded-2xl rounded-tl-none p-3 shadow-sm border border-border">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce-dot" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce-dot" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-surface rounded-full px-4 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            readOnly
          />
          <button className="w-10 h-10 rounded-full bg-slack-blue text-white flex items-center justify-center transition-all hover:scale-105">
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Powered by <span className="font-medium">SlackSupport</span>
        </p>
      </div>
    </div>
  );
}

function SlackMockup() {
  return (
    <div className="w-[320px] sm:w-[400px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
      {/* Slack header */}
      <div className="bg-primary p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HashIcon className="w-5 h-5 opacity-70" />
            <span className="font-semibold text-sm">support-tickets</span>
          </div>
          <EllipsisVerticalIcon className="w-5 h-5 opacity-70" />
        </div>
      </div>

      {/* Messages */}
      <div className="bg-card">
        {/* Bot message */}
        <div className="p-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">SlackSupport Bot</span>
                <span className="text-xs text-muted-foreground">2:34 PM</span>
              </div>
              <p className="text-sm text-foreground mt-1">
                <span className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs font-medium">NEW TICKET</span>
              </p>
              <div className="mt-2 p-3 bg-surface rounded-lg border-l-4 border-accent">
                <p className="text-sm text-foreground font-medium">Visitor asks:</p>
                <p className="text-sm text-muted-foreground mt-1">"Do you support SSO?"</p>
                <p className="text-xs text-muted-foreground mt-2">From: acme.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Human reply */}
        <div className="p-4 bg-surface/50">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">SK</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">Sarah Kim</span>
                <span className="text-xs text-muted-foreground">2:35 PM</span>
              </div>
              <p className="text-sm text-foreground mt-1">
                Yes! We support SAML SSO on the Pro plan. Want me to send over the docs? 📚
              </p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 bg-surface rounded-lg border border-border px-3 py-2">
            <PaperclipIcon className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Reply in thread..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              readOnly
            />
            <AtSignIcon className="w-4 h-4 text-muted-foreground" />
            <SmileIcon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}

