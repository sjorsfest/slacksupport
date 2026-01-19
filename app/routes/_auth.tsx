import { Outlet } from "react-router";
import { FaSlack, FaDiscord, FaFaceSmileWink } from "react-icons/fa6";
import { motion } from "framer-motion";

export default function AuthLayout() {
  const features = [
    {
      icon: <FaFaceSmileWink className="w-4 h-4 text-amber-500" />,
      title: "Support so simple",
      description: "You'll actually enjoy helping your customers.",
    },
    {
      icon: (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <div className="flex-1 flex items-center justify-center z-10">
            <FaSlack className="w-3.5 h-3.5 text-[#4A154B]" />
          </div>
          <div className="w-[1.5px] h-6 bg-slate-200 rotate-[25deg] z-20 mx-[-2px]" />
          <div className="flex-1 flex items-center justify-center z-10">
            <FaDiscord className="w-3.5 h-3.5 text-[#5865F2]" />
          </div>
        </div>
      ),
      title: "Chat where you are",
      description: "Directly from your favorite apps like Slack or Discord.",
    },
    {
      icon: <span className="text-lg">✨</span>,
      title: "No clunky helpdesks",
      description: "Just good vibes and lightning-fast fixes.",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div className="relative w-full max-w-4xl grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex flex-col gap-8 rounded-3xl border border-white/40 bg-white/50 p-8 text-slate-900 shadow-xl backdrop-blur-md">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-4xl font-bold mb-10 text-secondary-200"
            >
              Support doesn't have to be boring!
            </motion.h1>

            <div className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * (index + 1) }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm tracking-tight">
                      {feature.title}
                    </p>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Browser Window Mockup */}
          <div className="relative w-full aspect-[4/3] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
            {/* Window Controls */}
            <div className="h-8 bg-slate-50 border-b border-slate-100 flex items-center px-3 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>

            {/* Placeholder Content */}
            <img 
              src="/static/homepage.png" 
              alt="Dashboard Preview" 
              className="absolute inset-0 top-[33px] w-full h-full object-contain object-top"
            />
            
          </div>
        </div>
        <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
