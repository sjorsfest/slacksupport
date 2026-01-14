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
};

const statusOptions = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const statusColors: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-700',
  PENDING: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

export default function TicketDetail() {
  const { ticket, user, baseUrl } = useLoaderData<typeof loader>();
  const params = useParams();
  const [messages, setMessages] = useState<Message[]>(ticket.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    const wsUrl = `${baseUrl.replace('http', 'ws')}/ws?ticketId=${params.id}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.data) {
          const newMessage: Message = {
            id: data.data.messageId,
            source: data.data.source,
            text: data.data.text,
            createdAt: data.data.createdAt,
            slackUserName: data.data.slackUserName,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current = ws;
  }, [baseUrl, params.id]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full flex bg-transparent">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border bg-white/80 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/tickets" className="text-slate-500 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                {ticket.visitor.name || ticket.visitor.email || 'Anonymous Visitor'}
              </h1>
              <p className="text-sm text-slate-500">Ticket #{ticket.id.slice(-8)}</p>
            </div>
          </div>
          {ticket.slackPermalink && (
            <a
              href={ticket.slackPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button className="gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                </svg>
                Reply in Slack
              </Button>
            </a>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.source === 'visitor' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-lg ${message.source === 'visitor' ? 'order-1' : 'order-2'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.source === 'visitor'
                      ? 'bg-white border border-border rounded-bl-md shadow-sm'
                      : 'bg-slate-900 text-white rounded-br-md shadow-sm'
                  }`}
                >
                  {message.text}
                </div>
                <div className={`mt-1 text-xs text-slate-500 ${message.source === 'visitor' ? '' : 'text-right'}`}>
                  {message.source === 'slack' && message.slackUserName && (
                    <span className="font-medium mr-2">{message.slackUserName}</span>
                  )}
                  {message.source === 'agent_dashboard' && (
                    <span className="font-medium mr-2">{user.name || 'You'}</span>
                  )}
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Read-only footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-border text-center text-sm text-slate-500">
          This ticket is read-only. Please use Slack to reply to the customer.
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-80 border-l border-border bg-white/80 backdrop-blur overflow-y-auto">
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
              <CardTitle>Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="px-3 py-2 border border-border rounded-lg text-sm text-slate-700 bg-slate-50">
                {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
              </div>
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
