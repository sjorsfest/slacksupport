import { useState, useEffect } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";

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
        <h1 className="font-display text-3xl fun-gradient-text">Webhooks</h1>
        <p className="text-slate-600 mt-1">
          Receive HTTP notifications when ticket events occur.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add Webhook Endpoint</CardTitle>
          <CardDescription>
            Post events to your own services and pipelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks"
              className="flex-1 min-w-[220px]"
            />
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newUrl.trim()}
            >
              {isCreating ? 'Creating...' : 'Add Endpoint'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {webhooks.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="w-12 h-12 text-slate-300 mx-auto mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <CardTitle>No webhooks configured</CardTitle>
            <CardDescription>
              Add a webhook endpoint to receive ticket notifications.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant={webhook.enabled ? "success" : "muted"}>
                        {webhook.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {webhook._count.deliveries} deliveries
                      </span>
                    </div>
                    <div className="font-mono text-sm text-slate-900 truncate">
                      {webhook.url}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={webhook.enabled}
                      onChange={(e) => handleToggle(webhook.id, e.target.checked)}
                    />
                  </div>
                </div>

                {(showSecret === webhook.id || webhook.secret) && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">Signing Secret</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary"
                        onClick={() => handleRotateSecret(webhook.id)}
                      >
                        Rotate
                      </Button>
                    </div>
                    <code className="text-sm font-mono text-slate-600">
                      {webhook.secret || '••••••••••••••••••••••••'}
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      Use this secret to verify webhook signatures. Check the X-Webhook-Signature header.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadDeliveries(webhook.id)}
                  >
                    View Deliveries
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecret(showSecret === webhook.id ? null : webhook.id)}
                  >
                    {showSecret === webhook.id ? 'Hide Secret' : 'Show Secret'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>

              {selectedWebhook === webhook.id && (
                <div className="border-t border-border bg-slate-50 p-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Recent Deliveries</h3>
                  {loadingDeliveries ? (
                    <div className="text-sm text-slate-500">Loading...</div>
                  ) : deliveries.length === 0 ? (
                    <div className="text-sm text-slate-500">No deliveries yet</div>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between bg-white p-3 rounded-xl border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                delivery.status === 'success'
                                  ? 'bg-emerald-500'
                                  : delivery.status === 'failed'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              }`}
                            ></span>
                            <span className="text-sm text-slate-600">
                              Ticket {delivery.ticketId.slice(-8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
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
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 bg-white/80">
        <CardHeader>
          <CardTitle>Webhook Payload Format</CardTitle>
          <CardDescription>
            Events include ticket and message lifecycle notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-sm overflow-x-auto">
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
          <p className="mt-3 text-sm text-slate-600">
            Events: <code className="bg-muted px-1 rounded">ticket.created</code>,{' '}
            <code className="bg-muted px-1 rounded">message.created</code>,{' '}
            <code className="bg-muted px-1 rounded">ticket.updated</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
