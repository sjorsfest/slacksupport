import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {  RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";

export default function VerifyEmailPending() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/verify-email/success",
      });

      if (error) {
        setError(error.message || "Failed to resend verification email");
      } else {
        setResendSuccess(true);
      }
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            navigate("/login");
          },
        },
      });
    };
  

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className="bg-white p-8 rounded-3xl border-2 border-black"
        style={{ boxShadow: "4px 4px 0px 0px #1a1a1a" }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-6"
        >
          <div className="w-20 h-20 rounded-full bg-secondary-100 border-2 border-secondary-200 flex items-center justify-center mx-auto mb-4">
            <img
              src="/static/donkey.png"
              alt="Donkey Support"
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary mb-2">
            Check your email
          </h2>
          <p className="text-slate-500">
            We sent a verification link to
          </p>
          {email && (
            <p className="font-semibold text-slate-700 mt-1">{email}</p>
          )}
        </motion.div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-600 text-center">
              Click the link in the email to verify your account. If you don't see it, check your spam folder.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <span className="text-lg">&#9888;</span> {error}
            </div>
          )}

          {resendSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5" />
              Verification email sent!
            </div>
          )}

          <Button
            onClick={handleResend}
            disabled={isResending || !email}
            variant="outline"
            className="w-full h-11 rounded-xl border-2 border-slate-200 hover:border-secondary hover:bg-secondary/5 transition-all"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend verification email
              </>
            )}
          </Button>

          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              onClick={handleBackToLogin}
              className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
