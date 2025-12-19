import { useState } from 'react';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';

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

const statusColors = {
  OPEN: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const priorityColors = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <p className="text-gray-600 mt-1">Manage and respond to support requests</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setStatus('')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            !currentStatus
              ? 'border-[#4A154B] text-[#4A154B]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({totalTickets})
        </button>
        <button
          onClick={() => setStatus('OPEN')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            currentStatus === 'OPEN'
              ? 'border-[#4A154B] text-[#4A154B]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Open ({counts.OPEN})
        </button>
        <button
          onClick={() => setStatus('PENDING')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            currentStatus === 'PENDING'
              ? 'border-[#4A154B] text-[#4A154B]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({counts.PENDING})
        </button>
        <button
          onClick={() => setStatus('RESOLVED')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            currentStatus === 'RESOLVED'
              ? 'border-[#4A154B] text-[#4A154B]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Resolved ({counts.RESOLVED})
        </button>
      </div>

      {/* Tickets list */}
      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets yet</h3>
          <p className="text-gray-500">Tickets will appear here when visitors contact you</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Visitor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Message</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium">
                        {ticket.visitor.name?.[0]?.toUpperCase() || ticket.visitor.email?.[0]?.toUpperCase() || 'V'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {ticket.visitor.name || ticket.visitor.email || 'Anonymous'}
                        </div>
                        {ticket.visitor.email && ticket.visitor.name && (
                          <div className="text-sm text-gray-500">{ticket.visitor.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 text-sm line-clamp-1 max-w-xs">
                      {ticket.lastMessage?.text || 'No messages'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                      {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${priorityColors[ticket.priority]}`}>
                      {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {ticket.lastMessage ? formatTimeAgo(String(ticket.lastMessage.createdAt)) : formatTimeAgo(ticket.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="text-[#4A154B] hover:text-[#3D1141] font-medium text-sm"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tickets
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(pagination.page + 1) })}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

