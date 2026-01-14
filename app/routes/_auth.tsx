import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div className="relative w-full max-w-4xl grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-white/40 bg-white/50 p-8 text-slate-900 shadow-xl backdrop-blur-md">
          <div>
            <h1 className="font-display text-4xl font-bold mb-4 text-slate-900">
              Support doesn't have to be boring.
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-md">
              Give your customers a support experience that feels as premium and playful as your product.
            </p>
          </div>

          {/* Browser Window Mockup */}
          <div className="relative w-full aspect-[4/3] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
            {/* Window Controls */}
            <div className="h-8 bg-slate-50 border-b border-slate-100 flex items-center px-3 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            
            {/* Placeholder Content */}
            <div className="absolute inset-0 top-8 bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-4 border-2 border-dashed border-slate-200 flex items-center justify-center">
                <span className="text-2xl">📸</span>
              </div>
              <p className="font-medium text-slate-400 text-sm">
                Dashboard Screenshot Placeholder
              </p>
              <p className="text-xs text-slate-300 mt-1">
                (Drop your awesome UI here later!)
              </p>
            </div>
          </div>
        </div>
        <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
