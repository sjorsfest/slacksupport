import { useState, useEffect } from 'react';
import { useLoaderData, useSearchParams, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Select } from "~/components/ui/select";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const installation = await prisma.slackInstallation.findUnique({
    where: { accountId: user.accountId },
    select: {
      slackTeamName: true,
      installedAt: true,
      scopes: true,
    },
  });

  const channelConfig = await prisma.slackChannelConfig.findFirst({
    where: { accountId: user.accountId, isDefault: true },
  });

  const baseUrl = settings.BASE_URL;

  return {
    accountId: user.accountId,
    installation,
    selectedChannel: channelConfig ? {
      id: channelConfig.slackChannelId,
      name: channelConfig.slackChannelName,
    } : null,
    baseUrl,
  };
}

type Channel = { id: string; name: string; isPrivate: boolean };

export default function SlackIntegration() {
  const { accountId, installation, selectedChannel, baseUrl } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState(selectedChannel);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const channelsFetcher = useFetcher();
  const selectFetcher = useFetcher();
  const testFetcher = useFetcher();
  const disconnectFetcher = useFetcher();

  const success = searchParams.get('success') === 'true';
  const error = searchParams.get('error');

  const loadingChannels = channelsFetcher.state !== 'idle';
  const isSaving = selectFetcher.state !== 'idle';
  const isTesting = testFetcher.state !== 'idle';

  useEffect(() => {
    if (installation) {
      loadChannels();
    }
  }, [installation]);

  useEffect(() => {
    if (channelsFetcher.state === 'idle' && channelsFetcher.data) {
      const data = channelsFetcher.data as { channels: Channel[] };
      setChannels(data.channels || []);
    }
  }, [channelsFetcher.state, channelsFetcher.data]);

  useEffect(() => {
    if (testFetcher.state === 'idle' && testFetcher.data) {
      const data = testFetcher.data as { error?: string };
      if (data.error) {
        setTestResult({ success: false, message: data.error || 'Failed to send test message' });
      } else {
        setTestResult({ success: true, message: 'Test message sent successfully!' });
      }
    }
  }, [testFetcher.state, testFetcher.data]);

  useEffect(() => {
    if (disconnectFetcher.state === 'idle' && disconnectFetcher.data) {
      window.location.reload();
    }
  }, [disconnectFetcher.state, disconnectFetcher.data]);

  const loadChannels = () => {
    channelsFetcher.load('/api/slack/channels');
  };

  const handleSelectChannel = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    setSelected({ id: channel.id, name: channel.name });
    selectFetcher.submit(
      { channelId: channel.id, channelName: channel.name },
      { method: 'POST', action: '/api/slack/select-channel', encType: 'application/json' }
    );
  };

  const handleTestPost = () => {
    setTestResult(null);
    testFetcher.submit(null, { method: 'POST', action: '/api/slack/test-post' });
  };

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect Slack? This will stop all ticket notifications.')) {
      return;
    }
    disconnectFetcher.submit(null, { method: 'POST', action: '/api/slack/disconnect' });
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl fun-gradient-text">Slack Integration</h1>
        <p className="text-slate-600 mt-1">
          Connect your workspace to respond to tickets in seconds.
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Slack connected successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
          Failed to connect Slack: {error.replace(/_/g, ' ')}
        </div>
      )}

      {!installation ? (
        <Card className="text-center">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4 mx-auto">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
            </div>
            <CardTitle>Connect to Slack</CardTitle>
            <CardDescription>
              Install the app to receive ticket notifications and respond from Slack.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <a
              href={`${baseUrl}/slack/install?account_id=${accountId}`}
              className="inline-flex"
            >
              <Button className="gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
                </svg>
                Add to Slack
              </Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Connected Workspace</CardTitle>
                <CardDescription>Your Slack workspace is live.</CardDescription>
              </div>
              <Badge variant="success">Connected</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                  {installation.slackTeamName[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-slate-900">{installation.slackTeamName}</div>
                  <div className="text-sm text-slate-500">
                    Connected {new Date(installation.installedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={handleDisconnect}
                >
                  Disconnect Slack
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Channel</CardTitle>
              <CardDescription>
                Choose where new ticket notifications should be posted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChannels ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading channels...
                </div>
              ) : (
                <div className="space-y-3">
                  <Select
                    value={selected?.id || ''}
                    onChange={(e) => handleSelectChannel(e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="">Select a channel</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.isPrivate ? '🔒' : '#'} {channel.name}
                      </option>
                    ))}
                  </Select>

                  {selected && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Tickets will be posted to #{selected.name}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>Test Connection</CardTitle>
                <CardDescription>
                  Send a test message to verify the integration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleTestPost}
                  disabled={isTesting}
                  variant="secondary"
                >
                  {isTesting ? 'Sending...' : 'Send Test Message'}
                </Button>

                {testResult && (
                  <div className={`mt-3 p-3 rounded-xl text-sm ${
                    testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {testResult.message}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
