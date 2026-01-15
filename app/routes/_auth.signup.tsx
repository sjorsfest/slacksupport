import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export default function Signup() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const isLoading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { error?: string };
      if (data.error) {
        setError(data.error);
      } else {
        navigate("/onboarding");
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    fetcher.submit(formData, { method: "POST", action: "/api/auth/signup" });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transform -rotate-3 overflow-hidden">
            <img
              src="/static/donkey.png"
              alt="Donkey Support"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary mb-2">
            Create your account
          </h2>
          <p className="text-slate-500">
            Launch a polished support experience in minutes.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-sm font-bold text-slate-700 ml-1"
            >
              Your name
            </label>
            <Input
              type="text"
              id="name"
              name="name"
              required
              placeholder="John Doe"
              className="h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="companyName"
              className="block text-sm font-bold text-slate-700 ml-1"
            >
              Company name
            </label>
            <Input
              type="text"
              id="companyName"
              name="companyName"
              required
              placeholder="Acme Inc."
              className="h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-bold text-slate-700 ml-1"
            >
              Work email
            </label>
            <Input
              type="email"
              id="email"
              name="email"
              required
              placeholder="you@company.com"
              className="h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-bold text-slate-700 ml-1"
            >
              Password
            </label>
            <Input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all"
            />
            <p className="text-xs text-slate-500 ml-1">At least 8 characters</p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-11 text-base font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all duration-200",
              "bg-secondary hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98]",
              isLoading && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-bold text-secondary hover:text-secondary/80 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
