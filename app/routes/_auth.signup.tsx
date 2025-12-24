import { useState, useEffect } from "react";
import { Link, useNavigate, useFetcher } from "react-router";

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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Create your account
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent transition-shadow"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Company name
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent transition-shadow"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Work email
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
            minLength={8}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent transition-shadow"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-[#4A154B] text-white font-medium rounded-lg hover:bg-[#3D1141] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A154B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-[#4A154B] font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
