import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { motion } from 'framer-motion';
import { Slack as SlackIcon, CheckCircle2, ChevronRight, Plug } from 'lucide-react';
import { FaDiscord, FaTelegram } from 'react-icons/fa';

import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { isTelegramConfigured } from '~/lib/telegram.server';
import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const [slackInstallation, discordInstallation, telegramGroups] = await Promise.all([
    prisma.slackInstallation.findUnique({
      where: { accountId: user.accountId },
      select: { slackTeamName: true, installedAt: true },
    }),
    prisma.discordInstallation.findUnique({
      where: { accountId: user.accountId },
      select: { discordGuildName: true, installedAt: true },
    }),
    prisma.telegramGroupConfig.findMany({
      where: { accountId: user.accountId },
      select: { telegramChatTitle: true, createdAt: true, isDefault: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const telegramConfigured = isTelegramConfigured();
  const defaultTelegramGroup = telegramGroups.find((g) => g.isDefault) || telegramGroups[0];

  return {
    slackInstallation,
    discordInstallation,
    telegramGroup: defaultTelegramGroup || null,
    telegramConfigured,
  };
}

export default function ConnectHub() {
  const { slackInstallation, discordInstallation, telegramGroup, telegramConfigured } =
    useLoaderData<typeof loader>();

  const hasAnyIntegration = slackInstallation || discordInstallation || telegramGroup;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Plug className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300">
            Connect
          </h1>
        </div>
        <p className="text-muted-foreground text-base lg:text-lg">
          Connect your team's communication platform to respond to tickets. 🎫 
        </p>
        {hasAnyIntegration && (
          <p className="text-sm text-amber-600 mt-2">
            Note: Only one integration can be active at a time.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Slack Integration Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <Link to="/connect/slack" className="block group">
            <Card className={`border-border shadow-sm hover:shadow-md transition-all duration-300 h-full ${(discordInstallation || telegramGroup) && !slackInstallation ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#4A154B]/10 rounded-xl group-hover:scale-105 transition-transform">
                    <SlackIcon className="w-8 h-8 text-[#4A154B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Slack</CardTitle>
                    <CardDescription>
                      Respond to tickets from Slack threads
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {slackInstallation ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4A154B] rounded-xl flex items-center justify-center text-white font-bold">
                      {slackInstallation.slackTeamName[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">
                        {slackInstallation.slackTeamName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Connected {new Date(slackInstallation.installedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ) : discordInstallation || telegramGroup ? (
                  <p className="text-sm text-muted-foreground">
                    Disconnect {discordInstallation ? 'Discord' : 'Telegram'} to enable Slack integration.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to connect your Slack workspace.
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  {slackInstallation ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                  ) : discordInstallation || telegramGroup ? (
                    <Badge variant="muted">Disabled</Badge>
                  ) : (
                    <span />
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Discord Integration Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link to="/connect/discord" className="block group">
            <Card className={`border-border shadow-sm hover:shadow-md transition-all duration-300 h-full ${(slackInstallation || telegramGroup) && !discordInstallation ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#5865F2]/10 rounded-xl group-hover:scale-105 transition-transform">
                    <FaDiscord className="w-8 h-8 text-[#5865F2]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Discord</CardTitle>
                    <CardDescription>
                      Respond to tickets from Discord threads
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {discordInstallation ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5865F2] rounded-xl flex items-center justify-center text-white font-bold">
                      {discordInstallation.discordGuildName[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">
                        {discordInstallation.discordGuildName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Connected {new Date(discordInstallation.installedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ) : slackInstallation || telegramGroup ? (
                  <p className="text-sm text-muted-foreground">
                    Disconnect {slackInstallation ? 'Slack' : 'Telegram'} to enable Discord integration.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click to connect your Discord server.
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  {discordInstallation ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                  ) : slackInstallation || telegramGroup ? (
                    <Badge variant="muted">Disabled</Badge>
                  ) : (
                    <span />
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Telegram Integration Card */}
        {telegramConfigured && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Link to="/connect/telegram" className="block group">
              <Card
                className={`border-border shadow-sm hover:shadow-md transition-all duration-300 h-full ${(slackInstallation || discordInstallation) && !telegramGroup ? 'opacity-60' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#0088cc]/10 rounded-xl group-hover:scale-105 transition-transform">
                      <FaTelegram className="w-8 h-8 text-[#0088cc]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Telegram</CardTitle>
                      <CardDescription>Respond to tickets from forum topics</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {telegramGroup ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#0088cc] rounded-xl flex items-center justify-center text-white font-bold">
                        {telegramGroup.telegramChatTitle[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {telegramGroup.telegramChatTitle}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Connected {new Date(telegramGroup.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ) : slackInstallation || discordInstallation ? (
                    <p className="text-sm text-muted-foreground">
                      Disconnect{' '}
                      {slackInstallation ? 'Slack' : 'Discord'} to enable Telegram integration.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click to connect your Telegram supergroup.
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    {telegramGroup ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </Badge>
                    ) : slackInstallation || discordInstallation ? (
                      <Badge variant="muted">Disabled</Badge>
                    ) : (
                      <span />
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
