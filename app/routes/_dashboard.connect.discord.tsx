import { useState, useEffect } from 'react';
import { useLoaderData, useSearchParams, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, CheckCircle2, XCircle, Link2Off, Send } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';

import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Select } from '~/components/ui/select';
import { cn } from '~/lib/utils';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const [installation, slackInstallation] = await Promise.all([
    prisma.discordInstallation.findUnique({
      where: { accountId: user.accountId },
      select: {
        discordGuildName: true,
        installedAt: true,
      },
    }),
    prisma.slackInstallation.findUnique({
      where: { accountId: user.accountId },
      select: { id: true },
    }),
  ]);

  const channelConfig = await prisma.discordChannelConfig.findFirst({
    where: { accountId: user.accountId, isDefault: true },
  });

  const baseUrl = settings.BASE_URL;

  return {
    accountId: user.accountId,
    installation,
    hasSlackInstallation: !!slackInstallation,
    selectedChannel: channelConfig
      ? {
          id: channelConfig.discordChannelId,
          name: channelConfig.discordChannelName,
        }
      : null,
    baseUrl,
  };
}

type Channel = { id: string; name: string; type: number };

export default function DiscordIntegration() {
  const { accountId, installation, hasSlackInstallation, selectedChannel, baseUrl } =
    useLoaderData<typeof loader>();
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
    channelsFetcher.load('/api/discord/channels');
  };

  const handleSelectChannel = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    setSelected({ id: channel.id, name: channel.name });
    selectFetcher.submit(
      { channelId: channel.id, channelName: channel.name },
      { method: 'POST', action: '/api/discord/select-channel', encType: 'application/json' }
    );
  };

  const handleTestPost = () => {
    setTestResult(null);
    testFetcher.submit(null, { method: 'POST', action: '/api/discord/test-post' });
  };

  const handleDisconnect = () => {
    if (
      !confirm(
        'Are you sure you want to disconnect Discord? This will stop all ticket notifications.'
      )
    ) {
      return;
    }
    disconnectFetcher.submit(null, { method: 'POST', action: '/api/discord/disconnect' });
  };

  // If Slack is already connected, show a message
  if (hasSlackInstallation && !installation) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
            Discord Integration
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Connect your server to respond to tickets from Discord.
          </p>
        </div>

        <Card className="text-center border-border shadow-sm">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-2xl mb-4 mx-auto">
              <FaDiscord className="w-10 h-10 text-amber-600" />
            </div>
            <CardTitle>Slack is Already Connected</CardTitle>
            <CardDescription>
              Only one integration can be active at a time. Disconnect Slack first to use Discord.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <a href="/connect/slack">Go to Slack Settings</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
          Discord Integration
        </h1>
        <p className="text-muted-foreground text-base lg:text-lg">
          Connect your server to respond to tickets from Discord threads.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            Discord connected successfully!
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3"
          >
            <XCircle className="w-5 h-5 flex-shrink-0" />
            Failed to connect Discord: {error.replace(/_/g, ' ')}
          </motion.div>
        )}
      </AnimatePresence>

      {!installation ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="text-center border-border shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#5865F2]/10 rounded-2xl mb-4 mx-auto">
                <FaDiscord className="w-10 h-10 text-[#5865F2]" />
              </div>
              <CardTitle>Connect to Discord</CardTitle>
              <CardDescription>
                Add the bot to your server to receive ticket notifications and respond from Discord.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <a href={`${baseUrl}/discord/install?account_id=${accountId}`} className="inline-flex">
                <Button className="gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white">
                  <FaDiscord className="w-5 h-5" />
                  Add to Discord
                </Button>
              </a>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <FaDiscord className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Connected Server</CardTitle>
                    <CardDescription>Your Discord server is live.</CardDescription>
                  </div>
                </div>
                <Badge variant="success">Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#5865F2] rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                  {installation.discordGuildName[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-foreground">{installation.discordGuildName}</div>
                  <div className="text-sm text-muted-foreground">
                    Connected {new Date(installation.installedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-2"
                  onClick={handleDisconnect}
                >
                  <Link2Off className="w-4 h-4" />
                  Disconnect Discord
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Hash className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle>Notification Channel</CardTitle>
              </div>
              <CardDescription>
                Choose where new ticket notifications should be posted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChannels ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
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
                        # {channel.name}
                      </option>
                    ))}
                  </Select>

                  {selected && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-emerald-600"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Tickets will be posted to #{selected.name}
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selected && (
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Send className="w-5 h-5 text-orange-600" />
                  </div>
                  <CardTitle>Test Connection</CardTitle>
                </div>
                <CardDescription>Send a test message to verify the integration.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleTestPost}
                  disabled={isTesting}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
                >
                  {isTesting ? 'Sending...' : 'Send Test Message'}
                </Button>

                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-3 p-3 rounded-xl text-sm flex items-center gap-2',
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    )}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {testResult.message}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
