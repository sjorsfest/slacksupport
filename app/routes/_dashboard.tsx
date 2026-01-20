import {
  Link,
  Outlet,
  useLocation,
  useLoaderData,
  useNavigate,
  redirect,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { motion } from "framer-motion";
import {
  Ticket,
  Plug,
  MessageSquare,
  Webhook,
  LogOut,
  Slack,
} from "lucide-react";
import { FaDiscord } from "react-icons/fa";

import { requireUser } from "~/lib/auth.server";
import { authClient } from "~/lib/auth-client";
import { prisma } from "~/lib/db.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const isOnboardingRoute = url.pathname.startsWith('/onboarding');


  if (!isOnboardingRoute) {
    const subscription = await prisma.subscription.findUnique({
      where: { accountId: user.accountId },
    });

    if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
      throw redirect('/onboarding/subscription');
    }
  }


  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    include: {
      slackInstallation: {
        select: { slackTeamName: true },
      },
      discordInstallation: {
        select: { discordGuildName: true },
      },
      _count: {
        select: {
          tickets: {
            where: { status: "OPEN" },
          },
        },
      },
    },
  });

  return { user, account };
}

const navItems = [
  { path: "/tickets", label: "Tickets", icon: Ticket, color: "text-blue-500" },
  {
    path: "/connect",
    label: "Connect",
    icon: Plug,
    color: "text-purple-500",
  },
  {
    path: "/widget",
    label: "Widget",
    icon: MessageSquare,
    color: "text-pink-500",
  },
  {
    path: "/settings/webhooks",
    label: "Webhooks",
    icon: Webhook,
    color: "text-orange-500",
  },
];

export default function DashboardLayout() {
  const { user, account } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/login");
        },
      },
    });
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background font-sans overflow-hidden">
      {/* Fun Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-72 m-4 rounded-3xl bg-card border-2 border-black flex-col overflow-hidden transition-all duration-300 h-[calc(100vh-2rem)] flex-shrink-0" style={{ boxShadow: '4px 4px 0px 0px #1a1a1a' }}>
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center space-x-[-1rem]">
            <div className="relative group">
              <img
                src="/static/donkey.png"
                alt="Donkey Support"
                className="w-15 h-15 object-contain group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-bounce-subtle" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <h1 className="font-display text-4xl font-bold text-primary-500 text-center leading-[0.8] w-fit mx-auto tracking-tighter">
                Donkey Support
              </h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className="block">
                <div
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group overflow-hidden",
                    isActive
                      ? "bg-primary/10 text-primary-700 shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}

                  <item.icon
                    className={cn(
                      "w-5 h-5 relative z-10 transition-transform group-hover:scale-110 group-hover:rotate-3",
                      isActive ? "text-primary-700" : item.color
                    )}
                  />

                  <span className="font-medium relative z-10">
                    {item.label}
                  </span>

                  {item.path === "/tickets" && account?._count?.tickets ? (
                    <Badge variant="fun" className="ml-auto relative z-10">
                      {account._count.tickets}
                    </Badge>
                  ) : null}

                  {item.path === "/connect" && (account?.slackInstallation || account?.discordInstallation) && (
                    <span className={cn(
                      "absolute bottom-0.5 left-12 flex items-center gap-1 text-[10px] z-10",
                      isActive ? "text-primary-700" : "text-muted-foreground"
                    )}>
                      {account.slackInstallation && (
                        <>
                          <Slack className="w-2.5 h-2.5" />
                          {account.slackInstallation.slackTeamName}
                        </>
                      )}
                      {account.discordInstallation && !account.slackInstallation && (
                        <>
                          <FaDiscord className="w-2.5 h-2.5" />
                          {account.discordInstallation.discordGuildName}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border/50 bg-muted/20">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/50 transition-colors cursor-pointer group">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
              <AvatarFallback className="bg-gradient-to-br from-secondary to-orange-400 text-white font-bold">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground truncate group-hover:-700 transition-colors">
                {user.name || "Support Hero"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 m-0 lg:m-4 lg:ml-0 rounded-none lg:rounded-3xl bg-white/90 border-x-0 lg:border-2 lg:border-black backdrop-blur-sm overflow-hidden flex flex-col relative pb-20 lg:pb-0 lg:[box-shadow:4px_4px_0px_0px_#1a1a1a]">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-border/50 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src="/static/donkey.png"
                alt="Donkey Support"
                className="w-10 h-10 object-contain"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-bounce-subtle" />
            </div>
            <h1 className="font-display text-lg font-bold text-primary">
              Donkey Support
            </h1>
          </div>
          <Avatar
            className="h-8 w-8 border border-white shadow-sm"
            onClick={handleLogout}
          >
            <AvatarFallback className="bg-gradient-to-br from-secondary to-orange-400 text-white text-xs font-bold">
              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

        <div className="flex-1 overflow-auto p-4 lg:p-6 relative z-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50 pb-safe">
        <div className="flex items-center justify-around p-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 min-w-[4rem]",
                  isActive
                    ? "text-primary-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isActive ? "bg-primary/10" : "bg-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-6 h-6",
                      isActive ? "text-primary" : item.color
                    )}
                  />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
