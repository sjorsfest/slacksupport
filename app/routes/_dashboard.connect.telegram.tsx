import { useState, useEffect } from 'react';
import { Link, useLoaderData, useSearchParams, useFetcher, useLocation } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Link2Off, Send, Plus, MessageSquare } from 'lucide-react';
import { FaTelegram } from 'react-icons/fa';

import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import { isTelegramConfigured, getBotInfo } from '~/lib/telegram.server';
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

  const [groups, slackInstallation, discordInstallation] = await Promise.all([
    prisma.telegramGroupConfig.findMany({
      where: { accountId: user.accountId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.slackInstallation.findUnique({
      where: { accountId: user.accountId },
      select: { id: true },
    }),
    prisma.discordInstallation.findUnique({
      where: { accountId: user.accountId },
      select: { id: true },
    }),
  ]);

  const configured = isTelegramConfigured();
  const botInfo = configured ? await getBotInfo() : null;
  const baseUrl = settings.BASE_URL;

  const defaultGroup = groups.find((g) => g.isDefault);

  return {
    accountId: user.accountId,
    configured,
    botUsername: botInfo?.username || null,
    groups: groups.map((g) => ({
      id: g.telegramChatId,
      title: g.telegramChatTitle,
      isForumEnabled: g.isForumEnabled,
      isDefault: g.isDefault,
    })),
    hasSlackInstallation: !!slackInstallation,
    hasDiscordInstallation: !!discordInstallation,
    selectedGroup: defaultGroup
      ? {
          id: defaultGroup.telegramChatId,
          title: defaultGroup.telegramChatTitle,
          isForumEnabled: defaultGroup.isForumEnabled,
        }
      : null,
    baseUrl,
  };
}

type Group = { id: string; title: string; isForumEnabled: boolean; isDefault: boolean };

export default function TelegramIntegration() {
  const {
    accountId,
    configured,
    botUsername,
    groups,
    hasSlackInstallation,
    hasDiscordInstallation,
    selectedGroup: initialSelected,
    baseUrl,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [selected, setSelected] = useState(initialSelected);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [chatId, setChatId] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const addGroupFetcher = useFetcher();
  const selectFetcher = useFetcher();
  const testFetcher = useFetcher();
  const disconnectFetcher = useFetcher();

  const success = searchParams.get('success') === 'true';
  const error = searchParams.get('error');
  const isOnboarding = location.pathname.startsWith('/onboarding');
  const installUrl = `${baseUrl}/telegram/install?account_id=${accountId}`;

  const isAdding = addGroupFetcher.state !== 'idle';
  const isSaving = selectFetcher.state !== 'idle';
  const isTesting = testFetcher.state !== 'idle';

  useEffect(() => {
    if (addGroupFetcher.state === 'idle' && addGroupFetcher.data) {
      const data = addGroupFetcher.data as { error?: string; success?: boolean; group?: Group };
      if (data.error) {
        setAddError(data.error);
      } else if (data.success) {
        setAddError(null);
        setShowAddGroup(false);
        setChatId('');
        window.location.reload();
      }
    }
  }, [addGroupFetcher.state, addGroupFetcher.data]);

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

  const handleAddGroup = () => {
    if (!chatId.trim()) {
      setAddError('Please enter a chat ID');
      return;
    }
    setAddError(null);
    addGroupFetcher.submit(
      { chatId: chatId.trim() },
      { method: 'POST', action: '/api/telegram/add-group', encType: 'application/json' }
    );
  };

  const handleSelectGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    setSelected({ id: group.id, title: group.title, isForumEnabled: group.isForumEnabled });
    selectFetcher.submit(
      { chatId: group.id, chatTitle: group.title },
      { method: 'POST', action: '/api/telegram/select-group', encType: 'application/json' }
    );
  };

  const handleTestPost = () => {
    setTestResult(null);
    testFetcher.submit(null, { method: 'POST', action: '/api/telegram/test-post' });
  };

  const handleDisconnect = () => {
    if (
      !confirm(
        'Are you sure you want to disconnect Telegram? This will stop all ticket notifications.'
      )
    ) {
      return;
    }
    disconnectFetcher.submit(null, { method: 'POST', action: '/api/telegram/disconnect' });
  };

  // If another integration is already connected, show a message
  if ((hasSlackInstallation || hasDiscordInstallation) && groups.length === 0) {
    const otherIntegration = hasSlackInstallation ? 'Slack' : 'Discord';
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
            Telegram Integration
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Connect your Telegram supergroup to respond to tickets from forum topics.
          </p>
        </div>

        <Card className="text-center border-border shadow-sm">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-2xl mb-4 mx-auto">
              <FaTelegram className="w-10 h-10 text-amber-600" />
            </div>
            <CardTitle>{otherIntegration} is Already Connected</CardTitle>
            <CardDescription>
              Only one integration can be active at a time. Disconnect {otherIntegration} first to
              use Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <a
                href={
                  isOnboarding
                    ? `/onboarding/connect/${otherIntegration.toLowerCase()}`
                    : `/connect/${otherIntegration.toLowerCase()}`
                }
              >
                Go to {otherIntegration} Settings
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If Telegram is not configured on the server
  if (!configured) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
            Telegram Integration
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Connect your Telegram supergroup to respond to tickets from forum topics.
          </p>
        </div>

        <Card className="text-center border-border shadow-sm">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-2xl mb-4 mx-auto">
              <FaTelegram className="w-10 h-10 text-gray-400" />
            </div>
            <CardTitle>Telegram Not Configured</CardTitle>
            <CardDescription>
              The server administrator needs to set up Telegram bot credentials first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
          Telegram Integration
        </h1>
        <p className="text-muted-foreground text-base lg:text-lg">
          Connect your Telegram supergroup to respond to tickets from forum topics.
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
            Telegram group connected successfully!
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
            Failed to connect Telegram: {error.replace(/_/g, ' ')}
          </motion.div>
        )}
      </AnimatePresence>

      {groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <Card className="text-center border-border shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#0088cc]/10 rounded-2xl mb-4 mx-auto">
                <FaTelegram className="w-10 h-10 text-[#0088cc]" />
              </div>
              <CardTitle>Connect to Telegram</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Add the bot to your Telegram supergroup to receive ticket notifications and respond
                from forum topics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-left bg-gray-50 rounded-xl p-4 space-y-3 max-w-md mx-auto">
                <h3 className="font-medium text-secondary-300">Setup Instructions:</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Create a supergroup in Telegram (or use existing)</li>
                  <li>Enable "Topics" in group settings</li>
                  <li>
                    Add <span className="font-mono text-foreground">@{botUsername}</span> as admin
                  </li>
                  <li>Grant "Manage Topics" permission</li>
                  <li>Enter your group's Chat ID below</li>
                  <li>
                    The ID must start with <span className="font-mono text-foreground">-100</span> (e.g., if you get -54328509, enter -10054328509)
                  </li>
                </ol>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Enter Chat ID (e.g., -1001234567890)"
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                  />
                  <Button
                    onClick={handleAddGroup}
                    disabled={isAdding}
                    className="bg-[#0088cc] hover:bg-[#006699] text-white"
                  >
                    {isAdding ? 'Adding...' : 'Add Group'}
                  </Button>
                </div>
                {addError && <p className="text-sm text-rose-600">{addError}</p>}
                <p className="text-xs text-muted-foreground">
                  Tip: Get your Chat ID by adding <span className="font-mono text-foreground">@userinfobot</span> to your group.
                </p>
              </div>
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
                    <FaTelegram className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Connected Groups</CardTitle>
                    <CardDescription>Your Telegram groups are configured.</CardDescription>
                  </div>
                </div>
                <Badge variant="success">Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#0088cc] rounded-xl flex items-center justify-center text-white font-bold">
                        {group.title[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{group.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.isForumEnabled ? 'Forum enabled' : 'No forum mode'}
                          {group.isDefault && ' • Default'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!showAddGroup ? (
                <Button
                  variant="ghost"
                  className="mt-3 text-[#0088cc] hover:text-[#006699] gap-2"
                  onClick={() => setShowAddGroup(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Another Group
                </Button>
              ) : (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      placeholder="Enter Chat ID"
                      className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                    />
                    <Button
                      onClick={handleAddGroup}
                      disabled={isAdding}
                      size="sm"
                      className="bg-[#0088cc] hover:bg-[#006699] text-white"
                    >
                      {isAdding ? 'Adding...' : 'Add'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddGroup(false);
                        setChatId('');
                        setAddError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {addError && <p className="text-sm text-rose-600">{addError}</p>}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-2"
                  onClick={handleDisconnect}
                >
                  <Link2Off className="w-4 h-4" />
                  Disconnect Telegram
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle>Default Group</CardTitle>
              </div>
              <CardDescription>
                Choose where new ticket notifications should be posted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Select
                  value={selected?.id || ''}
                  onChange={(e) => handleSelectGroup(e.target.value)}
                  disabled={isSaving}
                >
                  <option value="">Select a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title} {!group.isForumEnabled && '(No forum mode)'}
                    </option>
                  ))}
                </Select>

                {selected && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      selected.isForumEnabled ? 'text-emerald-600' : 'text-amber-600'
                    )}
                  >
                    {selected.isForumEnabled ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Tickets will create forum topics in {selected.title}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Enable "Topics" in group settings for best experience
                      </>
                    )}
                  </motion.div>
                )}
              </div>
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
                  className="bg-[#0088cc] hover:bg-[#006699] text-white"
                >
                  {isTesting ? 'Sending...' : 'Send Test Message'}
                </Button>

                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-3 p-3 rounded-xl text-sm flex items-center gap-2',
                      testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
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

          {isOnboarding && (
            <div className="pt-2 flex justify-end">
              <Button asChild className="bg-secondary hover:bg-secondary/90 text-white">
                <Link to="/onboarding/embed">Embed the widget!</Link>
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
