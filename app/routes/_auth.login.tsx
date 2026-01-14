import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { Sparkles } from "lucide-react";
import { login } from "~/lib/auth.server";
import { loginSchema } from "~/types/schemas";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const data = loginSchema.parse({ email, password });
    const { headers } = await login(data.email, data.password);

    return new Response(null, {
      status: 302,
      headers: {
        ...Object.fromEntries(headers),
        Location: "/tickets",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Login failed" }, { status: 400 });
  }
}

export default function Login() {
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
        navigate("/tickets");
      }
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    fetcher.submit(formData, { method: "POST", action: "/api/auth/login" });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 transform rotate-3">
            <Sparkles className="w-6 h-6 text-secondary" />
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-900 mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-slate-500">
            Ready to make your customers smile?
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
              htmlFor="email"
              className="block text-sm font-bold text-slate-700 ml-1"
            >
              Email
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
            <div className="flex items-center justify-between ml-1">
              <label
                htmlFor="password"
                className="block text-sm font-bold text-slate-700"
              >
                Password
              </label>
              <Link 
                to="/forgot-password" 
                className="text-xs font-medium text-slate-400 hover:text-secondary transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <Input
              type="password"
              id="password"
              name="password"
              required
              placeholder="••••••••"
              className="h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all"
            />
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
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500">
            New to Donkey Support?{" "}
            <Link
              to="/signup"
              className="font-bold text-secondary hover:text-secondary/80 hover:underline transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
