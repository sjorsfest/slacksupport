import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

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
    <div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">
        Create your account
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Launch a polished support experience in minutes.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Your name
          </label>
          <Input
            type="text"
            id="name"
            name="name"
            required
            placeholder="John Doe"
          />
        </div>

        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Company name
          </label>
          <Input
            type="text"
            id="companyName"
            name="companyName"
            required
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Work email
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
            minLength={8}
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
