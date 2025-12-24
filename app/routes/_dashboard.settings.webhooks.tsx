import { useState, useEffect } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { deliveries: true },
      },
    },
  });

  return { endpoints };
}

type Webhook = {
  id: string;
  url: string;
  enabled: boolean;
  secret?: string;
  createdAt: Date | string;
  _count: { deliveries: number };
};

type Delivery = {
  id: string;
  ticketId: string;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export default function WebhooksSettings() {
  const { endpoints } = useLoaderData<typeof loader>();
  const [webhooks, setWebhooks] = useState<Webhook[]>(endpoints as Webhook[]);
  const [newUrl, setNewUrl] = useState('');
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const createFetcher = useFetcher();
  const toggleFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const rotateFetcher = useFetcher();
  const deliveriesFetcher = useFetcher();

  const isCreating = createFetcher.state !== 'idle';
  const loadingDeliveries = deliveriesFetcher.state !== 'idle';

  useEffect(() => {
    if (createFetcher.state === 'idle' && createFetcher.data) {
      const { endpoint } = createFetcher.data as { endpoint: Webhook };
      if (endpoint) {
        setWebhooks([{ ...endpoint, _count: { deliveries: 0 } }, ...webhooks]);
        setNewUrl('');
        setShowSecret(endpoint.id);
      }
    }
  }, [createFetcher.state, createFetcher.data]);

  useEffect(() => {
    if (rotateFetcher.state === 'idle' && rotateFetcher.data) {
      const { secret, id } = rotateFetcher.data as { secret: string; id: string };
      if (secret && id) {
        setWebhooks(webhooks.map((w) => (w.id === id ? { ...w, secret } : w)));
        setShowSecret(id);
      }
    }
  }, [rotateFetcher.state, rotateFetcher.data]);

  useEffect(() => {
    if (deliveriesFetcher.state === 'idle' && deliveriesFetcher.data) {
      const data = deliveriesFetcher.data as { deliveries: Delivery[] };
      setDeliveries(data.deliveries || []);
    }
  }, [deliveriesFetcher.state, deliveriesFetcher.data]);

  const handleCreate = () => {
    if (!newUrl.trim()) return;
    createFetcher.submit(
      { url: newUrl },
      { method: 'POST', action: '/api/webhooks', encType: 'application/json' }
    );
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setWebhooks(webhooks.map((w) => (w.id === id ? { ...w, enabled } : w)));
    toggleFetcher.submit(
      { enabled },
      { method: 'PUT', action: `/api/webhooks/${id}`, encType: 'application/json' }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    setWebhooks(webhooks.filter((w) => w.id !== id));
    if (selectedWebhook === id) setSelectedWebhook(null);
    deleteFetcher.submit(null, { method: 'DELETE', action: `/api/webhooks/${id}` });
  };

  const handleRotateSecret = (id: string) => {
    if (!confirm('Are you sure? This will invalidate the current secret.')) return;
    rotateFetcher.submit(null, { method: 'POST', action: `/api/webhooks/${id}/rotate-secret` });
  };

  const loadDeliveries = (webhookId: string) => {
    setSelectedWebhook(webhookId);
    deliveriesFetcher.load(`/api/webhooks/${webhookId}/deliveries`);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
        <p className="text-gray-600 mt-1">
          Receive HTTP notifications when ticket events occur
        </p>
      </div>

      {/* Create new webhook */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Webhook Endpoint</h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating || !newUrl.trim()}
            className="px-6 py-2.5 bg-[#4A154B] text-white font-medium rounded-lg hover:bg-[#3D1141] transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Add Endpoint'}
          </button>
        </div>
      </div>

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No webhooks configured</h3>
          <p className="text-gray-500">Add a webhook endpoint to receive ticket notifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          webhook.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {webhook.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {webhook._count.deliveries} deliveries
                      </span>
                    </div>
                    <div className="font-mono text-sm text-gray-900 truncate">
                      {webhook.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhook.enabled}
                        onChange={(e) => handleToggle(webhook.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#4A154B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A154B]"></div>
                    </label>
                  </div>
                </div>

                {/* Secret */}
                {(showSecret === webhook.id || webhook.secret) && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">Signing Secret</span>
                      <button
                        onClick={() => handleRotateSecret(webhook.id)}
                        className="text-xs text-[#4A154B] hover:underline"
                      >
                        Rotate
                      </button>
                    </div>
                    <code className="text-sm font-mono text-gray-600">
                      {webhook.secret || '••••••••••••••••••••••••'}
                    </code>
                    <p className="text-xs text-gray-500 mt-2">
                      Use this secret to verify webhook signatures. Check the X-Webhook-Signature header.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => loadDeliveries(webhook.id)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    View Deliveries
                  </button>
                  <button
                    onClick={() => setShowSecret(showSecret === webhook.id ? null : webhook.id)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showSecret === webhook.id ? 'Hide Secret' : 'Show Secret'}
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Deliveries panel */}
              {selectedWebhook === webhook.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Deliveries</h3>
                  {loadingDeliveries ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : deliveries.length === 0 ? (
                    <div className="text-sm text-gray-500">No deliveries yet</div>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                delivery.status === 'success'
                                  ? 'bg-green-500'
                                  : delivery.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`}
                            ></span>
                            <span className="text-sm text-gray-600">
                              Ticket {delivery.ticketId.slice(-8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{delivery.attemptCount} attempt(s)</span>
                            <span>
                              {delivery.lastAttemptAt
                                ? new Date(delivery.lastAttemptAt).toLocaleString()
                                : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Documentation */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Webhook Payload Format</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "event": "message.created",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "data": {
    "ticketId": "clx...",
    "accountId": "clx...",
    "messageId": "clx...",
    "source": "visitor",
    "text": "Hello, I need help..."
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-gray-600">
          Events: <code className="bg-gray-200 px-1 rounded">ticket.created</code>,{' '}
          <code className="bg-gray-200 px-1 rounded">message.created</code>,{' '}
          <code className="bg-gray-200 px-1 rounded">ticket.updated</code>
        </p>
      </div>
    </div>
  );
}

