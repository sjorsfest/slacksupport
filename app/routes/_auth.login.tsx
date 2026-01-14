import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { login } from "~/lib/auth.server";
import { loginSchema } from "~/types/schemas";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

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
    <div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">
        Welcome back
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Sign in to keep conversations flowing.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Email
          </label>
          <Input
            type="email"
            id="email"
            name="email"
            required
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Password
          </label>
          <Input
            type="password"
            id="password"
            name="password"
            required
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="text-primary font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
