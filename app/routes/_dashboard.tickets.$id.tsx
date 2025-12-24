import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';

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
  OPEN: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
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
    <div className="h-full flex">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/tickets" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {ticket.visitor.name || ticket.visitor.email || 'Anonymous Visitor'}
              </h1>
              <p className="text-sm text-gray-500">Ticket #{ticket.id.slice(-8)}</p>
            </div>
          </div>
          {ticket.slackPermalink && (
            <a
              href={ticket.slackPermalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A154B] text-white rounded-lg text-sm font-medium hover:bg-[#3D1141] transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              </svg>
              Reply in Slack
            </a>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.source === 'visitor' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-lg ${message.source === 'visitor' ? 'order-1' : 'order-2'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.source === 'visitor'
                      ? 'bg-white border border-gray-200 rounded-bl-md'
                      : 'bg-[#4A154B] text-white rounded-br-md'
                  }`}
                >
                  {message.text}
                </div>
                <div className={`mt-1 text-xs text-gray-500 ${message.source === 'visitor' ? '' : 'text-right'}`}>
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
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
          This ticket is read-only. Please use Slack to reply to the customer.
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Visitor info */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Visitor</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                {ticket.visitor.name?.[0]?.toUpperCase() || ticket.visitor.email?.[0]?.toUpperCase() || 'V'}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {ticket.visitor.name || 'Anonymous'}
                </div>
                {ticket.visitor.email && (
                  <div className="text-sm text-gray-500">{ticket.visitor.email}</div>
                )}
              </div>
            </div>
            {ticket.visitor.metadata && Object.keys(ticket.visitor.metadata).length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                {Object.entries(ticket.visitor.metadata as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-gray-900 font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Status</h3>
            <div className={`px-3 py-2 rounded-lg text-sm font-medium ${statusColors[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
              {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
            </div>
          </div>

          {/* Priority */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Priority</h3>
            <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50">
              {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
            </div>
          </div>

          {/* Ticket info */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Ticket Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Messages</span>
                <span className="text-gray-900">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-900 font-mono text-xs">{ticket.id.slice(-8)}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

