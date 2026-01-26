import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { prisma } from '~/lib/db.server';
import { requireUser } from '~/lib/auth.server';
import {
  getTelegramGroupConfigs,
  setDefaultTelegramGroup,
  sendTelegramMessage,
  isTelegramConfigured,
  getChatInfo,
  storeTelegramGroupConfig,
  removeTelegramGroupConfig,
  createForumTopic,
} from '~/lib/telegram.server';
import { parseRequest } from '~/lib/request.server';
import { z } from 'zod';

const selectGroupSchema = z.object({
  chatId: z.string(),
  chatTitle: z.string(),
});

const addGroupSchema = z.object({
  chatId: z.string(),
});

/**
 * GET /api/telegram/status - Check if Telegram is configured
 * GET /api/telegram/groups - List available groups
 * GET /api/telegram/installation - Get installation info
 * POST /api/telegram/add-group - Add a group by chat ID
 * POST /api/telegram/select-group - Select default group
 * POST /api/telegram/test-post - Send test message
 * POST /api/telegram/disconnect - Remove Telegram integration
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const path = params['*'] || '';
  const user = await requireUser(request);

  if (path === 'status') {
    return Response.json({ configured: isTelegramConfigured() });
  }

  if (path === 'groups') {
    const groups = await getTelegramGroupConfigs(user.accountId);
    return Response.json({
      groups: groups.map((g) => ({
        id: g.telegramChatId,
        title: g.telegramChatTitle,
        isForumEnabled: g.isForumEnabled,
        isDefault: g.isDefault,
      })),
    });
  }

  if (path === 'installation') {
    const groups = await getTelegramGroupConfigs(user.accountId);
    const defaultGroup = groups.find((g) => g.isDefault);

    return Response.json({
      configured: isTelegramConfigured(),
      hasGroups: groups.length > 0,
      selectedGroup: defaultGroup
        ? {
            id: defaultGroup.telegramChatId,
            title: defaultGroup.telegramChatTitle,
            isForumEnabled: defaultGroup.isForumEnabled,
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
    if (path === 'add-group') {
      if (!isTelegramConfigured()) {
        return Response.json({ error: 'Telegram not configured' }, { status: 400 });
      }

      const data = await parseRequest(request, addGroupSchema);

      // Get chat info from Telegram
      const chatInfo = await getChatInfo(data.chatId);

      if (!chatInfo) {
        return Response.json(
          { error: 'Could not find this group. Make sure the bot is added to the group.' },
          { status: 400 }
        );
      }

      if (chatInfo.type !== 'supergroup') {
        return Response.json(
          { error: 'Only supergroups are supported. Please convert your group to a supergroup.' },
          { status: 400 }
        );
      }

      // Store the group config
      await storeTelegramGroupConfig(user.accountId, {
        chatId: String(chatInfo.id),
        chatTitle: chatInfo.title,
        isForumEnabled: chatInfo.is_forum || false,
      });

      return Response.json({
        success: true,
        group: {
          id: String(chatInfo.id),
          title: chatInfo.title,
          isForumEnabled: chatInfo.is_forum || false,
        },
      });
    }

    if (path === 'select-group') {
      if (!isTelegramConfigured()) {
        return Response.json({ error: 'Telegram not configured' }, { status: 400 });
      }

      const data = await parseRequest(request, selectGroupSchema);

      // Verify group exists for this account
      const groups = await getTelegramGroupConfigs(user.accountId);
      const group = groups.find((g) => g.telegramChatId === data.chatId);

      if (!group) {
        return Response.json({ error: 'Group not found' }, { status: 404 });
      }

      // Set as default
      await setDefaultTelegramGroup(user.accountId, data.chatId);

      return Response.json({ success: true });
    }

    if (path === 'test-post') {
      if (!isTelegramConfigured()) {
        return Response.json({ error: 'Telegram not configured' }, { status: 400 });
      }

      // Get default group
      const groups = await getTelegramGroupConfigs(user.accountId);
      const defaultGroup = groups.find((g) => g.isDefault);

      if (!defaultGroup) {
        return Response.json({ error: 'No group selected' }, { status: 400 });
      }

      let topicId: number | undefined;

      // For forum-enabled groups, create a test topic (General topic may be hidden)
      if (defaultGroup.isForumEnabled) {
        const topic = await createForumTopic(
          defaultGroup.telegramChatId,
          '🧪 Test Connection'
        );
        if (!topic) {
          return Response.json(
            { error: 'Failed to create test topic. Make sure the bot has "Manage Topics" permission.' },
            { status: 500 }
          );
        }
        topicId = topic.message_thread_id;
      }

      // Send test message
      const result = await sendTelegramMessage(
        defaultGroup.telegramChatId,
        '✅ Connection successful! Your support widget is connected to this Telegram group.',
        { topicId }
      );

      if (!result.success) {
        return Response.json({ error: result.error || 'Failed to send test message' }, { status: 500 });
      }

      return Response.json({ success: true, messageId: result.messageId });
    }

    if (path === 'remove-group') {
      const data = await parseRequest(request, z.object({ chatId: z.string() }));

      await removeTelegramGroupConfig(user.accountId, data.chatId);

      return Response.json({ success: true });
    }

    if (path === 'disconnect') {
      // Remove all group configs for this account
      await prisma.telegramGroupConfig.deleteMany({
        where: { accountId: user.accountId },
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Telegram API error:', error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
