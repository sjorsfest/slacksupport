import { useState } from "react";
import { Link, Form, useActionData, useNavigation, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authClient } from "~/lib/auth-client";
import { auth, getCurrentUser } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { FcGoogle } from "react-icons/fc";
import { FaXTwitter } from "react-icons/fa6";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  if (user && user.accountId) {
    return redirect("/tickets");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    const response = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      asResponse: true,
    });

    if (!response.ok) {
      try {
        const data = await response.clone().json();
        return { error: data.message || data.error || "Invalid email or password" };
      } catch {
        return { error: "Invalid email or password" };
      }
    }

    return redirect("/tickets", {
      headers: response.headers,
    });
  } catch (error) {
    return { error: "An unexpected error occurred" };
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [clientError, setClientError] = useState<string | null>(null);
  
  const isLoading = navigation.state === "submitting";
  const error = actionData?.error || clientError;

  const handleSocialSignIn = async (provider: "google" | "twitter") => {
    await authClient.signIn.social({
      provider,
      callbackURL: "/tickets",
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white p-8 rounded-3xl border-2 border-black" style={{ boxShadow: '4px 4px 0px 0px #1a1a1a' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transform rotate-3 overflow-hidden">
            <img
              src="/static/donkey.png"
              alt="Donkey Support"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-slate-500">Ready to make your customers smile?</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-lg">⚠️</span> {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          <Button
            type="button"
            onClick={() => handleSocialSignIn("google")}
            className="w-full h-11 cursor-pointer text-base font-bold rounded-xl border-2 border-transparent bg-white hover:bg-gray-50 text-gray-700 transition-all shadow-sm flex items-center justify-center gap-2"
            style={{ border: '2px solid #dadce0' }}
          >
            <FcGoogle className="w-5 h-5" />
            Sign in with Google
          </Button>
           <Button
            type="button"
            onClick={() => handleSocialSignIn("twitter")}
            className="w-full h-11 cursor-pointer text-base font-bold rounded-xl border-2 border-black bg-black hover:bg-gray-900 text-white transition-all flex items-center justify-center gap-2"
          >
            <FaXTwitter className="w-5 h-5" />
            Sign in with X
          </Button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-500 font-bold">Or continue with email</span>
          </div>
        </div>

        <Form method="post" className="space-y-5">
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
              "w-full h-11 cursor-pointer text-base font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all duration-200",
              "bg-secondary hover:bg-secondary/90 text-white hover:scale-[1.02] active:scale-[0.98]",
              isLoading && "opacity-70 !cursor-not-allowed"
            )}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </Form>

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
