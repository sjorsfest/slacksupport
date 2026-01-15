import { Link, useLoaderData, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MessageSquare, AlertCircle, CheckCircle2, Circle } from 'lucide-react';

import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  
  const status = url.searchParams.get('status') || undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = 20;

  const where = {
    accountId: user.accountId,
    ...(status && { status: status as 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' }),
  };

  const [tickets, total, statusCounts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        visitor: { select: { email: true, name: true, anonymousId: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
    prisma.ticket.groupBy({
      by: ['status'],
      where: { accountId: user.accountId },
      _count: true,
    }),
  ]);

  const counts = {
    OPEN: statusCounts.find((s) => s.status === 'OPEN')?._count || 0,
    PENDING: statusCounts.find((s) => s.status === 'PENDING')?._count || 0,
    RESOLVED: statusCounts.find((s) => s.status === 'RESOLVED')?._count || 0,
    CLOSED: statusCounts.find((s) => s.status === 'CLOSED')?._count || 0,
  };

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      visitor: t.visitor,
      lastMessage: t.messages[0] || null,
      createdAt: t.createdAt.toISOString(),
      slackPermalink: t.slackPermalink,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    counts,
  };
}

const statusConfig = {
  OPEN: { color: 'bg-blue-500', icon: Circle, label: 'Open' },
  PENDING: { color: 'bg-amber-500', icon: Clock, label: 'Pending' },
  RESOLVED: { color: 'bg-emerald-500', icon: CheckCircle2, label: 'Resolved' },
  CLOSED: { color: 'bg-slate-500', icon: CheckCircle2, label: 'Closed' },
};

const priorityConfig = {
  LOW: { color: 'text-slate-500', bg: 'bg-slate-100' },
  MEDIUM: { color: 'text-blue-600', bg: 'bg-blue-100' },
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-100' },
  URGENT: { color: 'text-rose-600', bg: 'bg-rose-100' },
};

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function TicketsIndex() {
  const { tickets, pagination, counts } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || '';

  const setStatus = (status: string) => {
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  const totalTickets = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
            Support Tickets
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Manage your conversations with a smile 🐴
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 lg:mb-8 p-1 bg-muted rounded-2xl w-fit">
        {[
          { id: '', label: 'All', count: totalTickets },
          { id: 'OPEN', label: 'Open', count: counts.OPEN },
          { id: 'PENDING', label: 'Pending', count: counts.PENDING },
          { id: 'RESOLVED', label: 'Resolved', count: counts.RESOLVED },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatus(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative",
              currentStatus === tab.id
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50"
            )}
          >
            {currentStatus === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white shadow-sm rounded-xl"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.label}
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] h-5 px-1.5 min-w-[1.25rem]">
                {tab.count}
              </Badge>
            </span>
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card className="border-border shadow-sm overflow-hidden">
          <CardContent className="py-20">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
                <MessageSquare className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-display font-bold text-secondary-100 mb-2">No tickets found</h3>
              <p className="text-muted-foreground">It's quiet... too quiet? 🌵</p>
            </motion.div>
          </CardContent>
        </Card>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {tickets.map((ticket) => {
              const StatusIcon = statusConfig[ticket.status].icon;
              
              return (
                <motion.div key={ticket.id} variants={item} layout>
                  <Link to={`/tickets/${ticket.id}`}>
                    <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-border shadow-sm group cursor-pointer overflow-hidden">
                      <div className={cn("h-1 w-full", statusConfig[ticket.status].color)} />
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                              <AvatarFallback className={cn("text-white font-bold", statusConfig[ticket.status].color)}>
                                {ticket.visitor.name?.[0]?.toUpperCase() || 'V'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-white line-clamp-1">
                                {ticket.visitor.name || 'Anonymous Visitor'}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {ticket.visitor.email}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "capitalize border-0", 
                              priorityConfig[ticket.priority].bg,
                              priorityConfig[ticket.priority].color
                            )}
                          >
                            {ticket.priority.toLowerCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pb-3">
                        <div className="bg-muted/30 p-3 rounded-lg mb-3 group-hover:bg-muted/50 transition-colors">
                          <p className="text-sm text-foreground/80 line-clamp-2 min-h-[2.5rem]">
                            {ticket.lastMessage?.text || <span className="italic text-muted-foreground">No messages yet...</span>}
                          </p>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-0 text-xs text-muted-foreground flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn("w-3.5 h-3.5", statusConfig[ticket.status].color.replace('bg-', 'text-'))} />
                          <span className="capitalize">{ticket.status.toLowerCase()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {ticket.lastMessage ? formatTimeAgo(String(ticket.lastMessage.createdAt)) : formatTimeAgo(ticket.createdAt)}
                        </div>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page - 1) })}
            disabled={pagination.page === 1}
            className="rounded-full"
          >
            Previous
          </Button>
          <div className="flex items-center px-4 text-sm font-medium text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </div>
          <Button
            variant="outline"
            onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page + 1) })}
            disabled={pagination.page === pagination.pages}
            className="rounded-full"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
