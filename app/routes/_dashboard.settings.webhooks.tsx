import { useState, useEffect } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Plus, Eye, EyeOff, RotateCcw, Trash2, Code, ExternalLink, Zap } from 'lucide-react';

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
import { cn } from "~/lib/utils";

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
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary mb-2">
          Webhooks
        </h1>
        <p className="text-muted-foreground text-base lg:text-lg">
          Receive HTTP notifications when ticket events occur 🔗
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="mb-6 border-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Add Webhook Endpoint</CardTitle>
            </div>
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
                className="flex-1 min-w-[220px] bg-muted/30"
              />
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newUrl.trim()}
                className="bg-secondary hover:bg-secondary/90 text-white"
              >
                {isCreating ? 'Creating...' : 'Add Endpoint'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {webhooks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="text-center border-border shadow-sm">
            <CardHeader>
              <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-10 h-10 text-muted-foreground" />
              </div>
              <CardTitle>No webhooks configured</CardTitle>
              <CardDescription>
                Add a webhook endpoint to receive ticket notifications.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {webhooks.map((webhook, index) => (
              <motion.div
                key={webhook.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow duration-300">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant={webhook.enabled ? "success" : "muted"}>
                            {webhook.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {webhook._count.deliveries} deliveries
                          </span>
                        </div>
                        <div className="font-mono text-sm text-foreground truncate">
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

                    <AnimatePresence>
                      {(showSecret === webhook.id || webhook.secret) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 p-4 bg-muted/50 rounded-xl border border-border"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">Signing Secret</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-primary gap-1"
                              onClick={() => handleRotateSecret(webhook.id)}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rotate
                            </Button>
                          </div>
                          <code className="text-sm font-mono text-muted-foreground">
                            {webhook.secret || '••••••••••••••••••••••••'}
                          </code>
                          <p className="text-xs text-muted-foreground mt-2">
                            Use this secret to verify webhook signatures. Check the X-Webhook-Signature header.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => loadDeliveries(webhook.id)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Deliveries
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setShowSecret(showSecret === webhook.id ? null : webhook.id)}
                      >
                        {showSecret === webhook.id ? (
                          <><EyeOff className="w-3.5 h-3.5" /> Hide Secret</>
                        ) : (
                          <><Eye className="w-3.5 h-3.5" /> Show Secret</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5"
                        onClick={() => handleDelete(webhook.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>

                  <AnimatePresence>
                    {selectedWebhook === webhook.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-border bg-muted/30 p-6"
                      >
                        <h3 className="text-sm font-medium text-foreground mb-3">Recent Deliveries</h3>
                        {loadingDeliveries ? (
                          <div className="text-sm text-muted-foreground">Loading...</div>
                        ) : deliveries.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No deliveries yet</div>
                        ) : (
                          <div className="space-y-2">
                            {deliveries.map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between bg-background p-3 rounded-xl border border-border"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      delivery.status === 'success'
                                        ? 'bg-emerald-500'
                                        : delivery.status === 'failed'
                                        ? 'bg-rose-500'
                                        : 'bg-amber-500'
                                    )}
                                  ></span>
                                  <span className="text-sm text-foreground">
                                    Ticket {delivery.ticketId.slice(-8)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="mt-8 border-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Code className="w-5 h-5 text-slate-600" />
              </div>
              <CardTitle>Webhook Payload Format</CardTitle>
            </div>
            <CardDescription>
              Events include ticket and message lifecycle notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-sm overflow-x-auto font-mono border border-slate-800 shadow-inner">
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
            <p className="mt-3 text-sm text-muted-foreground">
              Events: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">ticket.created</code>,{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">message.created</code>,{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">ticket.updated</code>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
