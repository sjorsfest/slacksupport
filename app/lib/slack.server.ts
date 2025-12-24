import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import type { ChatPostMessageResponse, ViewsOpenResponse } from '@slack/web-api';
import { TicketStatus } from '@prisma/client';
import { prisma } from './db.server';
import { encrypt, decrypt } from './crypto.server';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Scopes required for the Slack app
export const SLACK_SCOPES = [
  'channels:history',
  'channels:read',
  'channels:join',
  'chat:write',
  'users:read',
  'groups:history', // For private channels
  'groups:read',
].join(',');

/**
 * Verify Slack request signature.
 * Returns true if the signature is valid.
 */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): boolean {
  if (!timestamp || !signature || !SLACK_SIGNING_SECRET) {
    return false;
  }

  // Check timestamp is not too old (prevent replay attacks)
  const requestTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > 300) {
    console.warn('Slack request timestamp is too old');
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Generate the Slack OAuth authorization URL.
 */
export function getSlackAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    redirect_uri: `${BASE_URL}/slack/oauth/callback`,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

/**
 * Exchange OAuth code for access token.
 */
export async function exchangeSlackCode(code: string): Promise<{
  ok: boolean;
  access_token?: string;
  team?: { id: string; name: string };
  bot_user_id?: string;
  scope?: string;
  error?: string;
}> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: `${BASE_URL}/slack/oauth/callback`,
    }),
  });

  return response.json();
}

/**
 * Get a Slack WebClient for an account.
 */
export async function getSlackClient(accountId: string): Promise<WebClient | null> {
  const installation = await prisma.slackInstallation.findUnique({
    where: { accountId },
  });

  if (!installation) {
    return null;
  }

  const token = decrypt(installation.botAccessToken);
  return new WebClient(token, {
    retryConfig: {
      retries: 3,
      factor: 2,
      randomize: true,
    },
  });
}

/**
 * Get bot user ID for an account.
 */
export async function getBotUserId(accountId: string): Promise<string | null> {
  const installation = await prisma.slackInstallation.findUnique({
    where: { accountId },
    select: { botUserId: true },
  });
  return installation?.botUserId || null;
}

/**
 * Store Slack installation for an account.
 */
export async function storeSlackInstallation(
  accountId: string,
  data: {
    teamId: string;
    teamName: string;
    accessToken: string;
    botUserId: string;
    scopes: string[];
  }
): Promise<void> {
  const encryptedToken = encrypt(data.accessToken);

  await prisma.slackInstallation.upsert({
    where: { accountId },
    update: {
      slackTeamId: data.teamId,
      slackTeamName: data.teamName,
      botAccessToken: encryptedToken,
      botUserId: data.botUserId,
      scopes: data.scopes,
    },
    create: {
      accountId,
      slackTeamId: data.teamId,
      slackTeamName: data.teamName,
      botAccessToken: encryptedToken,
      botUserId: data.botUserId,
      scopes: data.scopes,
    },
  });
}

/**
 * Post a message to a Slack channel.
 */
export async function postToSlack(
  accountId: string,
  channelId: string,
  text: string,
  options?: {
    threadTs?: string;
    blocks?: unknown[];
  }
): Promise<ChatPostMessageResponse | null> {
  const client = await getSlackClient(accountId);
  if (!client) {
    console.error('No Slack installation found for account:', accountId);
    return null;
  }

  try {
    const result = await client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: options?.threadTs,
      blocks: options?.blocks as never[],
    });
    return result;
  } catch (error) {
    console.error('Failed to post to Slack:', error);
    throw error;
  }
}

/**
 * Create a new ticket root message in Slack.
 */
export async function createTicketInSlack(
  accountId: string,
  channelId: string,
  ticket: {
    id: string;
    visitorEmail?: string;
    visitorName?: string;
    firstMessage: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ threadTs: string; permalink?: string } | null> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return null;
  }

  const dashboardUrl = `${BASE_URL}/tickets/${ticket.id}`;
  
  // Build metadata fields for Block Kit
  const metadataFields: Array<{ type: string; text: string }> = [];
  if (ticket.visitorEmail) {
    metadataFields.push({ type: 'mrkdwn', text: `*Email:* ${ticket.visitorEmail}` });
  }
  if (ticket.visitorName) {
    metadataFields.push({ type: 'mrkdwn', text: `*Name:* ${ticket.visitorName}` });
  }
  if (ticket.metadata) {
    for (const [key, value] of Object.entries(ticket.metadata)) {
      metadataFields.push({ type: 'mrkdwn', text: `*${key}:* ${String(value)}` });
    }
  }

  try {
    const result = await client.chat.postMessage({
      channel: channelId,
      text: `🎫 New Support Ticket`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎫 New Support Ticket',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ticket.firstMessage,
          },
        },
        ...(metadataFields.length > 0 ? [{
          type: 'section' as const,
          fields: metadataFields as Array<{ type: 'mrkdwn'; text: string }>,
        }] : []),
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<${dashboardUrl}|View in Dashboard> • Reply in this thread to respond`,
            },
          ],
        },
      ] as never[],
    });

    // Add interactive button
    if (result.ok && result.ts) {
      await client.chat.update({
        channel: channelId,
        ts: result.ts,
        text: `🎫 New Support Ticket`, // Fallback text
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎫 New Support Ticket',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ticket.firstMessage,
            },
          },
          ...(metadataFields.length > 0 ? [{
            type: 'section' as const,
            fields: metadataFields as Array<{ type: 'mrkdwn'; text: string }>,
          }] : []),
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Update Status',
                  emoji: true,
                },
                value: ticket.id,
                action_id: 'update_status',
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `<${dashboardUrl}|View in Dashboard> • Reply in this thread to respond`,
              },
            ],
          },
        ] as never[],
      });
    }

    if (result.ok && result.ts) {
      // Get permalink
      let permalink: string | undefined;
      try {
        const linkResult = await client.chat.getPermalink({
          channel: channelId,
          message_ts: result.ts,
        });
        permalink = linkResult.permalink;
      } catch {
        // Permalink is optional
      }

      return { threadTs: result.ts, permalink };
    }
    return null;
  } catch (error) {
    console.error('Failed to create ticket in Slack:', error);
    throw error;
  }
}

/**
 * List available channels in a Slack workspace.
 */
export async function listSlackChannels(accountId: string): Promise<Array<{
  id: string;
  name: string;
  isPrivate: boolean;
}>> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return [];
  }

  try {
    const publicResult = await client.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 200,
    });

    const privateResult = await client.conversations.list({
      types: 'private_channel',
      exclude_archived: true,
      limit: 200,
    });

    const channels: Array<{ id: string; name: string; isPrivate: boolean }> = [];

    for (const channel of publicResult.channels || []) {
      if (channel.id && channel.name) {
        channels.push({ id: channel.id, name: channel.name, isPrivate: false });
      }
    }

    for (const channel of privateResult.channels || []) {
      if (channel.id && channel.name) {
        channels.push({ id: channel.id, name: channel.name, isPrivate: true });
      }
    }

    return channels;
  } catch (error) {
    console.error('Failed to list Slack channels:', error);
    return [];
  }
}

/**
 * Join a channel (for public channels).
 */
export async function joinSlackChannel(accountId: string, channelId: string): Promise<boolean> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return false;
  }

  try {
    await client.conversations.join({ channel: channelId });
    return true;
  } catch (error) {
    console.error('Failed to join channel:', error);
    return false;
  }
}

/**
 * Get user info from Slack.
 */
export async function getSlackUserInfo(accountId: string, userId: string): Promise<{
  name: string;
  realName?: string;
  displayName?: string;
} | null> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return null;
  }

  try {
    const result = await client.users.info({ user: userId });
    if (result.ok && result.user) {
      return {
        name: result.user.name || userId,
        realName: result.user.real_name,
        displayName: result.user.profile?.display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get Slack user info:', error);
    return null;
  }
}

// Types for Slack events
export type SlackMessageEvent = {
  type: 'message';
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  team?: string;
  event_ts: string;
};

export type SlackEventPayload = {
  type: 'url_verification' | 'event_callback';
  challenge?: string;
  token?: string;
  team_id?: string;
  event_id?: string;
  event?: SlackMessageEvent;
};

/**
 * Open a modal to update ticket status.
 */
export async function openStatusModal(
  accountId: string,
  triggerId: string,
  ticketId: string,
  currentStatus: string
): Promise<ViewsOpenResponse | null> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return null;
  }

  try {
    const result = await client.views.open({
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'update_status_modal',
        private_metadata: ticketId,
        title: {
          type: 'plain_text',
          text: 'Update Ticket Status',
        },
        submit: {
          type: 'plain_text',
          text: 'Update',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        blocks: [
          {
            type: 'input',
            block_id: 'status_block',
            label: {
              type: 'plain_text',
              text: 'Select new status',
            },
            element: {
              type: 'static_select',
              action_id: 'status_selection',
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: currentStatus,
                },
                value: currentStatus,
              },
              options: Object.values(TicketStatus).map((status) => ({
                text: {
                  type: 'plain_text',
                  text: status,
                },
                value: status,
              })),
            },
          },
        ],
      },
    });
    return result;
  } catch (error) {
    console.error('Failed to open status modal:', error);
    return null;
  }
}

/**
 * Update the original Slack message to reflect the new status.
 */
export async function updateSlackMessage(
  accountId: string,
  channelId: string,
  ts: string,
  ticket: {
    id: string;
    status: TicketStatus;
    firstMessage: string;
    visitorEmail?: string;
    visitorName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const client = await getSlackClient(accountId);
  if (!client) {
    return;
  }

  const dashboardUrl = `${BASE_URL}/tickets/${ticket.id}`;
  
  // Rebuild metadata fields
  const metadataFields: Array<{ type: string; text: string }> = [];
  if (ticket.visitorEmail) {
    metadataFields.push({ type: 'mrkdwn', text: `*Email:* ${ticket.visitorEmail}` });
  }
  if (ticket.visitorName) {
    metadataFields.push({ type: 'mrkdwn', text: `*Name:* ${ticket.visitorName}` });
  }
  if (ticket.metadata) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = ticket.metadata as Record<string, any>;
    for (const [key, value] of Object.entries(meta)) {
      metadataFields.push({ type: 'mrkdwn', text: `*${key}:* ${String(value)}` });
    }
  }

  // Add status to metadata
  metadataFields.push({ type: 'mrkdwn', text: `*Status:* ${ticket.status}` });

  try {
    await client.chat.update({
      channel: channelId,
      ts: ts,
      text: `🎫 Support Ticket (${ticket.status})`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🎫 Support Ticket (${ticket.status})`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ticket.firstMessage,
          },
        },
        ...(metadataFields.length > 0 ? [{
          type: 'section' as const,
          fields: metadataFields as Array<{ type: 'mrkdwn'; text: string }>,
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Update Status',
                emoji: true,
              },
              value: ticket.id,
              action_id: 'update_status',
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<${dashboardUrl}|View in Dashboard> • Reply in this thread to respond`,
            },
          ],
        },
      ] as never[],
    });
  } catch (error) {
    console.error('Failed to update Slack message:', error);
  }
}
