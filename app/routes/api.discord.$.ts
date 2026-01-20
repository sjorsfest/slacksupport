import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import { listDiscordChannels, postToDiscord } from '~/lib/discord.server';
import { selectChannelSchema } from '~/types/schemas';
import { parseRequest } from '~/lib/request.server';

/**
 * GET /api/discord/channels - List available channels
 * GET /api/discord/installation - Get installation info
 * POST /api/discord/select-channel - Select default channel
 * POST /api/discord/test-post - Send test message
 * POST /api/discord/disconnect - Remove Discord integration
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (path === 'channels') {
    const channels = await listDiscordChannels(user.accountId);
    return Response.json({ channels });
  }

  if (path === 'installation') {
    const installation = await prisma.discordInstallation.findUnique({
      where: { accountId: user.accountId },
      select: {
        discordGuildName: true,
        installedAt: true,
      },
    });

    const channelConfig = await prisma.discordChannelConfig.findFirst({
      where: { accountId: user.accountId, isDefault: true },
    });

    return Response.json({
      installation,
      selectedChannel: channelConfig
        ? {
            id: channelConfig.discordChannelId,
            name: channelConfig.discordChannelName,
          }
        : null,
    });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const path = params['*'] || '';

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await requireUser(request);

  try {
    if (path === 'select-channel') {
      const data = await parseRequest(request, selectChannelSchema);

      // Verify Discord is connected
      const installation = await prisma.discordInstallation.findUnique({
        where: { accountId: user.accountId },
      });

      if (!installation) {
        return Response.json({ error: 'Discord not connected' }, { status: 400 });
      }

      // Set as default channel (remove old default first)
      await prisma.discordChannelConfig.updateMany({
        where: { accountId: user.accountId, isDefault: true },
        data: { isDefault: false },
      });

      const channelConfig = await prisma.discordChannelConfig.upsert({
        where: {
          accountId_discordChannelId: {
            accountId: user.accountId,
            discordChannelId: data.channelId,
          },
        },
        update: {
          discordChannelName: data.channelName,
          isDefault: true,
        },
        create: {
          accountId: user.accountId,
          discordChannelId: data.channelId,
          discordChannelName: data.channelName,
          isDefault: true,
        },
      });

      return Response.json({ channelConfig });
    }

    if (path === 'test-post') {
      // Get default channel
      const channelConfig = await prisma.discordChannelConfig.findFirst({
        where: { accountId: user.accountId, isDefault: true },
      });

      if (!channelConfig) {
        return Response.json({ error: 'No channel selected' }, { status: 400 });
      }

      const result = await postToDiscord(
        user.accountId,
        channelConfig.discordChannelId,
        '🧪 This is a test message from your support widget!'
      );

      if (!result) {
        return Response.json({ error: 'Failed to send test message' }, { status: 500 });
      }

      return Response.json({ success: true, messageId: result.id });
    }

    if (path === 'disconnect') {
      await prisma.discordInstallation.delete({
        where: { accountId: user.accountId },
      });

      await prisma.discordChannelConfig.deleteMany({
        where: { accountId: user.accountId },
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Discord API error:', error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
