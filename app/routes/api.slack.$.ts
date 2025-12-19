import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import { listSlackChannels, joinSlackChannel, postToSlack } from '~/lib/slack.server';
import { selectChannelSchema } from '~/types/schemas';

/**
 * GET /api/slack/channels - List available channels
 * POST /api/slack/select-channel - Select default channel
 * POST /api/slack/test-post - Send test message
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (path === 'channels') {
    const channels = await listSlackChannels(user.accountId);
    return Response.json({ channels });
  }

  if (path === 'installation') {
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

    return Response.json({ 
      installation, 
      selectedChannel: channelConfig ? {
        id: channelConfig.slackChannelId,
        name: channelConfig.slackChannelName,
      } : null,
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
      const body = await request.json();
      const data = selectChannelSchema.parse(body);

      // Verify Slack is connected
      const installation = await prisma.slackInstallation.findUnique({
        where: { accountId: user.accountId },
      });

      if (!installation) {
        return Response.json({ error: 'Slack not connected' }, { status: 400 });
      }

      // Try to join the channel (for public channels)
      await joinSlackChannel(user.accountId, data.channelId);

      // Set as default channel (remove old default first)
      await prisma.slackChannelConfig.updateMany({
        where: { accountId: user.accountId, isDefault: true },
        data: { isDefault: false },
      });

      const channelConfig = await prisma.slackChannelConfig.upsert({
        where: {
          accountId_slackChannelId: {
            accountId: user.accountId,
            slackChannelId: data.channelId,
          },
        },
        update: {
          slackChannelName: data.channelName,
          isDefault: true,
        },
        create: {
          accountId: user.accountId,
          slackChannelId: data.channelId,
          slackChannelName: data.channelName,
          isDefault: true,
        },
      });

      return Response.json({ channelConfig });
    }

    if (path === 'test-post') {
      // Get default channel
      const channelConfig = await prisma.slackChannelConfig.findFirst({
        where: { accountId: user.accountId, isDefault: true },
      });

      if (!channelConfig) {
        return Response.json({ error: 'No channel selected' }, { status: 400 });
      }

      const result = await postToSlack(
        user.accountId,
        channelConfig.slackChannelId,
        '🧪 This is a test message from your support widget!'
      );

      if (!result) {
        return Response.json({ error: 'Failed to send test message' }, { status: 500 });
      }

      return Response.json({ success: true, messageTs: result.ts });
    }

    if (path === 'disconnect') {
      await prisma.slackInstallation.delete({
        where: { accountId: user.accountId },
      });

      await prisma.slackChannelConfig.deleteMany({
        where: { accountId: user.accountId },
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Slack API error:', error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

