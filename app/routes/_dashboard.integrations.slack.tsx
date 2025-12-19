import { useState, useEffect } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';

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

  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';

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
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selected, setSelected] = useState(selectedChannel);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const success = searchParams.get('success') === 'true';
  const error = searchParams.get('error');

  useEffect(() => {
    if (installation) {
      loadChannels();
    }
  }, [installation]);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await fetch('/api/slack/channels');
      const data = await response.json();
      setChannels(data.channels || []);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSelectChannel = async (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    setIsSaving(true);
    try {
      await fetch('/api/slack/select-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id, channelName: channel.name }),
      });
      setSelected({ id: channel.id, name: channel.name });
    } catch (error) {
      console.error('Failed to select channel:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPost = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/slack/test-post', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: 'Test message sent successfully!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test message' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to send test message' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? This will stop all ticket notifications.')) {
      return;
    }
    await fetch('/api/slack/disconnect', { method: 'POST' });
    window.location.reload();
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Slack Integration</h1>
        <p className="text-gray-600 mt-1">Connect your Slack workspace to receive and respond to support tickets</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Slack connected successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          Failed to connect Slack: {error.replace(/_/g, ' ')}
        </div>
      )}

      {!installation ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#4A154B]/10 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-[#4A154B]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect to Slack</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Install the Support Widget app to your Slack workspace to receive ticket notifications and respond directly from Slack.
          </p>
          <a
            href={`${baseUrl}/slack/install?account_id=${accountId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#4A154B] text-white font-medium rounded-xl hover:bg-[#3D1141] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
            </svg>
            Add to Slack
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connected workspace */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Connected Workspace</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Connected
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#4A154B] rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {installation.slackTeamName[0].toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-900">{installation.slackTeamName}</div>
                <div className="text-sm text-gray-500">
                  Connected {new Date(installation.installedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={handleDisconnect}
                className="text-red-600 text-sm font-medium hover:text-red-700"
              >
                Disconnect Slack
              </button>
            </div>
          </div>

          {/* Channel selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Notification Channel</h2>
            <p className="text-gray-600 text-sm mb-4">
              Choose which channel to receive new ticket notifications. The bot will post new tickets and thread replies there.
            </p>

            {loadingChannels ? (
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading channels...
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selected?.id || ''}
                  onChange={(e) => handleSelectChannel(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent"
                >
                  <option value="">Select a channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.isPrivate ? '🔒' : '#'} {channel.name}
                    </option>
                  ))}
                </select>

                {selected && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Tickets will be posted to #{selected.name}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test */}
          {selected && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Test Connection</h2>
              <p className="text-gray-600 text-sm mb-4">
                Send a test message to verify the integration is working correctly.
              </p>
              
              <button
                onClick={handleTestPost}
                disabled={isTesting}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isTesting ? 'Sending...' : 'Send Test Message'}
              </button>

              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

