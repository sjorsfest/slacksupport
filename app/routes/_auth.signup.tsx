import { useState } from "react";
import { Link, Form, useActionData, useNavigation, redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { auth, getCurrentUser } from "~/lib/auth.server";
import { prisma } from "~/lib/db.server";
import { createFreemiumSubscription } from "~/lib/stripe.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Redirect already authenticated users to dashboard
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  if (user && user.accountId) {
    return redirect("/tickets");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const payload = Object.fromEntries(formData);

  const result = signupSchema.safeParse(payload);

  if (!result.success) {
    return { 
      errors: result.error.flatten().fieldErrors,
      error: "Please check your input."
    };
  }

  const { email, password, name, companyName } = result.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { 
      error: "User already exists",
      code: "USER_ALREADY_EXISTS"
    };
  }

  // 1. Create SaaS Account first (before user signup)
  // This ensures the user is created with accountId already set
  const account = await prisma.account.create({
    data: {
      name: companyName,
      allowedDomains: [],
      widgetConfig: {
        create: {
          companyName: companyName,
        },
      },
    },
  });

  // 2. Create User via Better Auth with accountId already set
  try {
    const response = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        accountId: account.id,
        role: "admin",
      },
      asResponse: true,
    });

    if (!response.ok) {
      // Cleanup account if user creation fails
      await prisma.account.delete({ where: { id: account.id } });
      const data = await response.clone().json();
      return { error: data.message || data.error || "Failed to create user" };
    }

    const data = await response.clone().json();

    if (!data?.user?.id) {
      // Cleanup account if user creation fails
      await prisma.account.delete({ where: { id: account.id } });
      return { error: "Failed to create user" };
    }

    // Create freemium subscription for the new account
    try {
      const { customer, subscription, priceId, productId } = await createFreemiumSubscription({
        email,
        name,
        accountId: account.id,
        userId: data.user.id,
      });

      const subscriptionItem = subscription.items.data[0];
      const currentPeriodStart = subscriptionItem?.current_period_start;
      const currentPeriodEnd = subscriptionItem?.current_period_end;

      await prisma.subscription.create({
        data: {
          accountId: account.id,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeProductId: productId,
          status: 'active',
          currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        },
      });
    } catch (freemiumError) {
      console.error('Failed to create freemium subscription:', freemiumError);
      // Don't block signup if freemium creation fails
    }

    // Redirect to verification pending page with email
    return redirect(`/verify-email/pending?email=${encodeURIComponent(email)}`, {
      headers: response.headers,
    });
  } catch (e) {
    // Cleanup account if user creation fails
    await prisma.account.delete({ where: { id: account.id } });
    console.error("Signup Error:", e);
    return { error: "An unexpected error occurred" };
  }
}

export default function Signup() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  
  const isLoading = navigation.state === "submitting";
  const errors = actionData?.errors;
  const generalError = actionData?.error;

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="bg-white p-8 rounded-3xl border-2 border-black"
        style={{ boxShadow: "4px 4px 0px 0px #1a1a1a" }}
      >
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

        {generalError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-lg">⚠️</span> {generalError}
          </div>
        )}

        <Form method="post" className="space-y-5">
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
              className={cn(
                "h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all",
                errors?.name && "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
              )}
            />
            {errors?.name && (
              <p className="text-xs text-rose-600 ml-1">{errors.name[0]}</p>
            )}
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
              className={cn(
                "h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all",
                errors?.companyName && "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
              )}
            />
            {errors?.companyName && (
              <p className="text-xs text-rose-600 ml-1">{errors.companyName[0]}</p>
            )}
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
              className={cn(
                "h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all",
                errors?.email && "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
              )}
            />
            {errors?.email && (
              <p className="text-xs text-rose-600 ml-1">{errors.email[0]}</p>
            )}
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
              className={cn(
                "h-11 rounded-xl border-slate-200 focus:border-secondary/50 focus:ring-secondary/20 bg-slate-50 focus:bg-white transition-all",
                errors?.password && "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
              )}
            />
            {errors?.password ? (
              <p className="text-xs text-rose-600 ml-1">{errors.password[0]}</p>
            ) : (
              <p className="text-xs text-slate-500 ml-1">At least 8 characters</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full h-11 text-base font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all duration-200",
              "bg-secondary hover:bg-secondary/90 text-white hover:scale-[1.02] active:scale-[0.98]",
              isLoading && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </Form>

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
