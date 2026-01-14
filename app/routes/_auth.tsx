import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0">
        <div className="absolute -top-32 right-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-emerald-500/20 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-4xl grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-10 text-white shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-2xl">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-white/60">
                donkey support
              </div>
              <h1 className="font-display text-3xl">Make help feel joyful.</h1>
            </div>
          </div>
          <div className="space-y-4 text-white/80 text-sm">
            <p>
              Stay close to customers with a widget that feels premium and
              personal.
            </p>
            <div className="flex items-center gap-3 text-white/70">
              <span className="h-1 w-10 rounded-full bg-emerald-300/70" />
              Slack-powered conversations
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <span className="h-1 w-10 rounded-full bg-cyan-300/70" />
              Real-time replies, no dashboard fatigue
            </div>
          </div>
        </div>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl lg:ml-auto">
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 rounded-2xl mb-4">
              <svg
                className="w-7 h-7 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl fun-gradient-text">
              donkey support
            </h1>
            <p className="text-slate-500 mt-1">
              Customer support with extra sparkle.
            </p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
