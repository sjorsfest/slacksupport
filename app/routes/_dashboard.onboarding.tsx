import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { motion } from "framer-motion";

export default function OnboardingLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const isEmbed = pathname.startsWith("/onboarding/embed");
  const showProgress =
    pathname === "/onboarding/settings" ||
    pathname === "/onboarding/embed";

  const steps = ["Start", "Settings", "Connect", "Embed"];
  const currentStepIndex = (() => {
    if (pathname.startsWith("/onboarding/settings")) return 1;
    if (pathname.startsWith("/onboarding/connect")) return 2;
    if (pathname.startsWith("/onboarding/embed")) return 3;
    return 0;
  })();
  const progressPercent = Math.min(
    100,
    Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)
  );

  const animationKey = pathname;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [pathname]);

  return (
    <>
      {showProgress && (
        <div className="fixed inset-x-0 bottom-6 z-40 px-4 hidden sm:block pointer-events-none">
          <div className={`mx-auto ${isEmbed ? "max-w-6xl" : "max-w-4xl"}`}>
            {isVisible && (
              <motion.div
                key={animationKey}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [10, 0, 0, 0],
                  scale: [0.98, 1.01, 1, 1],
                  boxShadow: [
                    "0 8px 20px rgba(15, 23, 42, 0.08)",
                    "0 10px 28px rgba(16, 185, 129, 0.18)",
                    "0 8px 20px rgba(15, 23, 42, 0.08)",
                    "0 8px 20px rgba(15, 23, 42, 0.06)",
                  ],
                }}
                transition={{
                  duration: 6,
                  times: [0, 0.12, 0.7, 1],
                  ease: "easeOut",
                }}
                onAnimationComplete={() => setIsVisible(false)}
                className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl px-4 py-3 pointer-events-auto"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center">
                    Onboarding
                    <span className="inline-flex items-end w-5 ml-0.5" aria-hidden="true">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <motion.span
                          key={index}
                          className="inline-block w-[3px]"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: index * 0.2,
                            ease: "easeInOut",
                          }}
                        >
                          .
                        </motion.span>
                      ))}
                    </span>
                  </span>
                  <span>
                    {steps[currentStepIndex]} · {currentStepIndex + 1}/{steps.length}
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-slate-200/70 mb-3">
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-between px-1.5">
                    {steps.map((step, index) => {
                      const isActive = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      return (
                        <motion.span
                          key={step}
                          className={`h-2.5 w-2.5 rounded-full  border-2 ${
                            isActive ? "bg-white border border-emerald-400" : "bg-white border-slate-300 z-100"
                          }`}
                          animate={
                            isCurrent
                              ? {
                                  scale: [1, 1.2, 1],
                                  boxShadow: [
                                    "0 0 0 0 rgba(16,185,129,0.35)",
                                    "0 0 0 6px rgba(16,185,129,0.15)",
                                    "0 0 0 0 rgba(16,185,129,0.35)",
                                  ],
                                  borderColor: ["#10B981", "#22C55E", "#10B981"],
                                }
                              : { scale: 1 }
                          }
                          transition={
                            isCurrent
                              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                              : { duration: 0.2 }
                          }
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  {steps.map((step, index) => (
                    <span
                      key={step}
                      className={index <= currentStepIndex ? "text-foreground" : undefined}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
      <Outlet />
    </>
  );
}
