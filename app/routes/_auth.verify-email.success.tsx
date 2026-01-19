import { Link, useSearchParams, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { authClient } from "~/lib/auth-client";

export default function VerifyEmailSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const error = searchParams.get("error");

  const isError = !!error;
  const errorMessage = error === "invalid_token"
    ? "This verification link is invalid or has expired."
    : error || "Something went wrong.";


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
          <div
            className={cn(
              "w-20 h-20 rounded-2xl border-2 flex items-center justify-center mx-auto mb-4",
              isError
                ? "bg-rose-50 border-rose-200"
                : "bg-emerald-50 border-emerald-200"
            )}
          >
            {isError ? (
              <XCircle className="w-10 h-10 text-rose-500" />
            ) : (
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            )}
          </div>
          <h2 className="font-display text-3xl font-bold text-primary mb-2">
            {isError ? "Verification Failed" : "Email Verified!"}
          </h2>
          <p className="text-slate-500">
            {isError
              ? errorMessage
              : "Your email has been successfully verified."}
          </p>
        </motion.div>

        <div className="space-y-4">
          {isError ? (
            <>
              <p className="text-sm text-slate-600 text-center">
                Please try requesting a new verification email or contact support if the problem persists.
              </p>
              <Link to="/login" className="block">
                <button
                  onClick={handleBackToLogin}
                  className={cn(
                    "cursor-pointer w-full h-11 text-base font-bold rounded-xl shadow-lg transition-all duration-200",
                    "bg-secondary hover:bg-secondary/90 text-white hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  Back to Login
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </Link>
            </>
          ) : (
            <>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-700 text-center font-medium">
                  You can now access all features of Donkey Support!
                </p>
              </div>
              <Link to="/tickets" className="block">
                <Button
                  className={cn(
                    "w-full h-11 text-base font-bold rounded-xl shadow-lg shadow-secondary/20 transition-all duration-200",
                    "bg-secondary hover:bg-secondary/90 text-white hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
