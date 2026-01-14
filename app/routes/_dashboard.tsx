import { Link, Outlet, useLocation, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion } from 'framer-motion';
import { 
  Ticket, 
  Slack, 
  MessageSquare, 
  Webhook, 
  LogOut, 
  Settings,
  Sparkles
} from 'lucide-react';

import { requireUser, logout } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    include: {
      slackInstallation: {
        select: { slackTeamName: true },
      },
      _count: {
        select: {
          tickets: {
            where: { status: 'OPEN' },
          },
        },
      },
    },
  });

  return { user, account };
}

export async function action({ request }: LoaderFunctionArgs) {
  if (request.method === 'POST') {
    const headers = await logout(request);
    return new Response(null, {
      status: 302,
      headers: {
        ...Object.fromEntries(headers),
        Location: '/login',
      },
    });
  }
  return null;
}

const navItems = [
  { path: '/tickets', label: 'Tickets', icon: Ticket, color: 'text-blue-500' },
  { path: '/integrations/slack', label: 'Slack', icon: Slack, color: 'text-purple-500' },
  { path: '/widget', label: 'Widget', icon: MessageSquare, color: 'text-pink-500' },
  { path: '/settings/webhooks', label: 'Webhooks', icon: Webhook, color: 'text-orange-500' },
];

export default function DashboardLayout() {
  const { user, account } = useLoaderData<typeof loader>();
  const location = useLocation();
  const fetcher = useFetcher();

  const handleLogout = () => {
    fetcher.submit(null, { method: 'POST', action: '/api/auth/logout' });
  };

  return (
    <div className="min-h-screen flex bg-background font-sans">
      {/* Fun Sidebar */}
      <aside className="w-20 lg:w-72 m-4 rounded-3xl bg-card border border-border shadow-xl flex flex-col overflow-hidden transition-all duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-bounce-subtle" />
            </div>
            <div className="hidden lg:block">
              <h1 className="font-display text-xl font-bold text-secondary">
                Donkey Support
              </h1>
              {account?.slackInstallation && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {account.slackInstallation.slackTeamName}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="block"
              >
                <div
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group overflow-hidden",
                    isActive 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  <item.icon className={cn("w-5 h-5 relative z-10 transition-transform group-hover:scale-110 group-hover:rotate-3", isActive ? "text-primary" : item.color)} />
                  
                  <span className="font-medium relative z-10 hidden lg:block">
                    {item.label}
                  </span>
                  
                  {item.path === '/tickets' && account?._count?.tickets ? (
                    <Badge variant="fun" className="ml-auto relative z-10 hidden lg:flex">
                      {account._count.tickets}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border/50 bg-muted/30">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/50 transition-colors cursor-pointer group">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
              <AvatarFallback className="bg-gradient-to-br from-secondary to-orange-400 text-white font-bold">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 hidden lg:block">
              <div className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
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
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hidden lg:flex"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 m-4 ml-0 rounded-3xl bg-white/50 border border-white/20 shadow-xl backdrop-blur-sm overflow-hidden flex flex-col relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
        
        <div className="flex-1 overflow-auto p-6 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
