import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const ticketId = params.id;

  if (!ticketId) {
    throw new Response('Not found', { status: 404 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, accountId: user.accountId },
    include: {
      visitor: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    throw new Response('Not found', { status: 404 });
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';

  return {
    ticket: {
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      visitor: {
        ...ticket.visitor,
        createdAt: ticket.visitor.createdAt.toISOString(),
        updatedAt: ticket.visitor.updatedAt.toISOString(),
      },
    },
    user,
    baseUrl,
  };
}

type Message = {
  id: string;
  source: string;
  text: string;
  createdAt: string;
  slackUserName: string | null;
  discordUserName: string | null;
};

const statusOptions = ['OPEN', 'CLOSED'];
const statusColors: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

export default function TicketDetail() {
  const { ticket, user, baseUrl } = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState<Message[]>(ticket.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row border border-border rounded-xl overflow-hidden">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="px-4 lg:px-6 py-3 lg:py-4 border-b border-border bg-white/80 backdrop-blur flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
            <Link to="/tickets" className="text-slate-500 hover:text-slate-700 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-semibold text-secondary-300 truncate">
                {ticket.visitor.name || ticket.visitor.email || 'Anonymous Visitor'}
              </h1>
              <p className="text-xs lg:text-sm text-slate-500">Ticket #{ticket.id.slice(-8)}</p>
            </div>
          </div>
          {ticket.slackPermalink && (
            <a
              href={ticket.slackPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0"
            >
              <Button size="sm" className="gap-1.5 text-xs lg:text-sm">
                <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                </svg>
                <span className="hidden sm:inline">Reply in Slack</span>
                <span className="sm:hidden">Slack</span>
              </Button>
            </a>
          )}
        </header>

        {/* Mobile visitor info bar */}
        <div className="lg:hidden px-4 py-2 bg-slate-100 border-b border-border flex items-center justify-between text-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs font-medium">
              {ticket.visitor.name?.[0]?.toUpperCase() || ticket.visitor.email?.[0]?.toUpperCase() || 'V'}
            </div>
            <span className="text-slate-600 truncate">
              {ticket.visitor.email || 'Anonymous'}
            </span>
          </div>
          <Badge className={`${statusColors[ticket.status] || 'bg-slate-100 text-slate-800'} text-xs`}>
            {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50 space-y-3 lg:space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.source === 'visitor' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[85%] lg:max-w-lg ${message.source === 'visitor' ? 'order-1' : 'order-2'}`}>
                <div
                  className={`px-3 lg:px-4 py-2 lg:py-3 rounded-2xl text-sm lg:text-base ${
                    message.source === 'visitor'
                      ? 'bg-white border border-border rounded-bl-md shadow-sm'
                      : 'bg-slate-900 text-white rounded-br-md shadow-sm'
                  }`}
                >
                  {message.text}
                </div>
                <div className={`mt-1 text-[10px] lg:text-xs text-slate-500 ${message.source === 'visitor' ? '' : 'text-right'}`}>
                  {message.source !== 'visitor' &&
                    (message.slackUserName || message.discordUserName) && (
                      <span className="font-medium mr-1 lg:mr-2">
                        {message.slackUserName || message.discordUserName}
                      </span>
                    )}
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Read-only footer */}
        <div className="px-4 lg:px-6 py-3 lg:py-4 bg-slate-50 border-t border-border text-center text-xs lg:text-sm text-slate-500 flex-shrink-0">
          Reply via Discord/Slack
        </div>
      </div>

      {/* Sidebar - hidden on mobile */}
      <aside className="hidden lg:block w-80 border-l border-border bg-white/80 backdrop-blur overflow-y-auto flex-shrink-0">
        <div className="p-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-medium">
                  {ticket.visitor.name?.[0]?.toUpperCase() || ticket.visitor.email?.[0]?.toUpperCase() || 'V'}
                </div>
                <div>
                  <div className="font-medium text-slate-900">
                    {ticket.visitor.name || 'Anonymous'}
                  </div>
                  {ticket.visitor.email && (
                    <div className="text-sm text-slate-500">{ticket.visitor.email}</div>
                  )}
                </div>
              </div>
              {ticket.visitor.metadata && Object.keys(ticket.visitor.metadata).length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                  {Object.entries(ticket.visitor.metadata as Record<string, unknown>).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key}:</span>
                      <span className="text-slate-900 font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={statusColors[ticket.status] || 'bg-slate-100 text-slate-800'}>
                {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticket Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-900">{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Messages</span>
                <span className="text-slate-900">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID</span>
                <span className="text-slate-900 font-mono text-xs">{ticket.id.slice(-8)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
