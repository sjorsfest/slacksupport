import { useState, useEffect } from "react";
import { Form, Link, useNavigate, useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { login } from "~/lib/auth.server";
import { loginSchema } from "~/types/schemas";

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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Sign in to your account
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent transition-shadow"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent transition-shadow"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-[#4A154B] text-white font-medium rounded-lg hover:bg-[#3D1141] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A154B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="text-[#4A154B] font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
