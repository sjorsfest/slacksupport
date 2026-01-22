import { prisma } from './db.server';
import { encrypt, decrypt } from './crypto.server';
import { settings } from './settings.server';

const DISCORD_CLIENT_ID = settings.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = settings.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = settings.DISCORD_BOT_TOKEN;
const BASE_URL = settings.BASE_URL;

// Discord API base URL
const DISCORD_API = 'https://discord.com/api/v10';

// Bot permissions required for ticket management
// Send Messages, Create Public Threads, Send Messages in Threads, Read Message History, View Channels
export const DISCORD_BOT_PERMISSIONS = '326417591360';

// OAuth2 scopes
export const DISCORD_SCOPES = 'bot';

/**
 * Generate the Discord OAuth2 authorization URL for bot installation.
 */
export function getDiscordAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    permissions: DISCORD_BOT_PERMISSIONS,
    scope: DISCORD_SCOPES,
    redirect_uri: `${BASE_URL}/discord/oauth/callback`,
    response_type: 'code',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

/**
 * Exchange OAuth2 code for access token and guild info.
 */
export async function exchangeDiscordCode(code: string): Promise<{
  ok: boolean;
  access_token?: string;
  token_type?: string;
  guild?: { id: string; name: string };
  error?: string;
}> {
  try {
    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${BASE_URL}/discord/oauth/callback`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error_description || data.error || 'Unknown error' };
    }

    // The guild info comes from the OAuth response when using bot scope
    return {
      ok: true,
      access_token: data.access_token,
      token_type: data.token_type,
      guild: data.guild,
    };
  } catch (error) {
    console.error('Discord code exchange error:', error);
    return { ok: false, error: 'Failed to exchange code' };
  }
}

/**
 * Get guild info using bot token.
 */
export async function getGuildInfo(guildId: string): Promise<{
  id: string;
  name: string;
  icon?: string;
} | null> {
  try {
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to get guild info:', await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Get guild info error:', error);
    return null;
  }
}

/**
 * Get bot user info.
 */
export async function getBotUser(): Promise<{
  id: string;
  username: string;
} | null> {
  try {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Get bot user error:', error);
    return null;
  }
}

/**
 * Store Discord installation for an account.
 */
export async function storeDiscordInstallation(
  accountId: string,
  data: {
    guildId: string;
    guildName: string;
    accessToken: string;
    botUserId: string;
  }
): Promise<void> {
  const encryptedToken = encrypt(data.accessToken);

  await prisma.discordInstallation.upsert({
    where: { accountId },
    update: {
      discordGuildId: data.guildId,
      discordGuildName: data.guildName,
      botAccessToken: encryptedToken,
      botUserId: data.botUserId,
    },
    create: {
      accountId,
      discordGuildId: data.guildId,
      discordGuildName: data.guildName,
      botAccessToken: encryptedToken,
      botUserId: data.botUserId,
    },
  });
}

/**
 * Get Discord installation for an account.
 */
export async function getDiscordInstallation(accountId: string) {
  return prisma.discordInstallation.findUnique({
    where: { accountId },
  });
}

/**
 * Get bot user ID for an account.
 */
export async function getDiscordBotUserId(accountId: string): Promise<string | null> {
  const installation = await prisma.discordInstallation.findUnique({
    where: { accountId },
    select: { botUserId: true },
  });
  return installation?.botUserId || null;
}

/**
 * Make an authenticated Discord API request.
 */
async function discordRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${DISCORD_API}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

/**
 * List available text channels in a Discord guild.
 */
export async function listDiscordChannels(accountId: string): Promise<Array<{
  id: string;
  name: string;
  type: number;
}>> {
  const installation = await getDiscordInstallation(accountId);
  if (!installation) {
    return [];
  }

  try {
    const response = await discordRequest(`/guilds/${installation.discordGuildId}/channels`);

    if (!response.ok) {
      console.error('Failed to list Discord channels:', await response.text());
      return [];
    }

    const channels = await response.json();

    // Filter to only text channels (type 0) where bot can send messages
    // Channel types: 0 = text, 2 = voice, 4 = category, 5 = announcement, etc.
    return channels
      .filter((ch: { type: number }) => ch.type === 0)
      .map((ch: { id: string; name: string; type: number }) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
      }));
  } catch (error) {
    console.error('List Discord channels error:', error);
    return [];
  }
}

/**
 * Post a message to a Discord channel or thread.
 */
export async function postToDiscord(
  accountId: string,
  channelId: string,
  content: string,
  options?: {
    threadId?: string;
  }
): Promise<{ id: string; channel_id: string } | null> {
  const installation = await getDiscordInstallation(accountId);
  if (!installation) {
    console.error('No Discord installation found for account:', accountId);
    return null;
  }

  try {
    // If posting to a thread, use the thread ID as the channel
    const targetChannel = options?.threadId || channelId;

    const response = await discordRequest(`/channels/${targetChannel}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.error('Failed to post to Discord:', await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Post to Discord error:', error);
    return null;
  }
}

// Status colors for Discord embeds
const STATUS_COLORS: Record<string, number> = {
  OPEN: 0x3b82f6, // Blue
  CLOSED: 0x6b7280, // Gray
};

/**
 * Build an embed for a ticket message.
 */
function buildTicketEmbed(
  ticket: {
    id: string;
    status?: string;
    visitorEmail?: string;
    visitorName?: string;
    firstMessage: string;
    metadata?: Record<string, unknown>;
  },
  dashboardUrl: string
) {
  const status = ticket.status || 'OPEN';
  const color = STATUS_COLORS[status] || STATUS_COLORS.OPEN;

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  if (ticket.visitorName) {
    fields.push({ name: 'Name', value: ticket.visitorName, inline: true });
  }
  if (ticket.visitorEmail) {
    fields.push({ name: 'Email', value: ticket.visitorEmail, inline: true });
  }
  fields.push({ name: 'Status', value: status, inline: true });

  if (ticket.metadata) {
    for (const [key, value] of Object.entries(ticket.metadata)) {
      fields.push({ name: key, value: String(value), inline: true });
    }
  }

  return {
    title: '🎫 Support Ticket',
    description: ticket.firstMessage,
    color,
    fields,
    footer: {
      text: 'Reply in this thread to respond',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build the status toggle button component.
 */
function buildStatusButton(ticketId: string, currentStatus: string = 'OPEN') {
  const isOpen = currentStatus === 'OPEN';

  return {
    type: 1, // Action row
    components: [
      {
        type: 2, // Button
        style: isOpen ? 2 : 3, // Secondary (gray) for close, Success (green) for reopen
        label: isOpen ? 'Close Ticket' : 'Reopen Ticket',
        custom_id: `toggle_status:${ticketId}`,
      },
    ],
  };
}

/**
 * Build the dashboard link button component.
 */
function buildDashboardButton(dashboardUrl: string) {
  return {
    type: 1, // Action row
    components: [
      {
        type: 2, // Button
        style: 5, // Link button
        label: 'View in Dashboard',
        url: dashboardUrl,
      },
    ],
  };
}

/**
 * Create a new ticket thread in Discord.
 * Posts a message with an embed and creates a thread from it.
 */
export async function createTicketInDiscord(
  accountId: string,
  channelId: string,
  ticket: {
    id: string;
    visitorEmail?: string;
    visitorName?: string;
    firstMessage: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ threadId: string; messageId: string; permalink?: string } | null> {
  const installation = await getDiscordInstallation(accountId);
  if (!installation) {
    return null;
  }

  const dashboardUrl = `${BASE_URL}/tickets/${ticket.id}`;
  const embed = buildTicketEmbed({ ...ticket, status: 'OPEN' }, dashboardUrl);

  try {
    // Post the initial message with embed and components
    const messageResponse = await discordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        embeds: [embed],
        components: [
          buildStatusButton(ticket.id, 'OPEN'),
          buildDashboardButton(dashboardUrl),
        ],
      }),
    });

    if (!messageResponse.ok) {
      console.error('Failed to create ticket message in Discord:', await messageResponse.text());
      return null;
    }

    const message = await messageResponse.json();

    // Create a thread from the message
    const threadName = ticket.visitorName
      ? `Support: ${ticket.visitorName}`
      : `Support Ticket`;

    const threadResponse = await discordRequest(`/channels/${channelId}/messages/${message.id}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        name: threadName.substring(0, 100), // Discord thread names max 100 chars
        auto_archive_duration: 10080, // 7 days in minutes
      }),
    });

    if (!threadResponse.ok) {
      console.error('Failed to create thread in Discord:', await threadResponse.text());
      // Return the message info even if thread creation fails
      return {
        threadId: message.id,
        messageId: message.id,
        permalink: `https://discord.com/channels/${installation.discordGuildId}/${channelId}/${message.id}`,
      };
    }

    const thread = await threadResponse.json();

    return {
      threadId: thread.id,
      messageId: message.id,
      permalink: `https://discord.com/channels/${installation.discordGuildId}/${channelId}/${thread.id}`,
    };
  } catch (error) {
    console.error('Failed to create ticket in Discord:', error);
    return null;
  }
}

/**
 * Update a Discord message with new ticket status.
 */
export async function updateDiscordMessage(
  accountId: string,
  channelId: string,
  messageId: string,
  ticket: {
    id: string;
    status: string;
    firstMessage: string;
    visitorEmail?: string;
    visitorName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const installation = await getDiscordInstallation(accountId);
  if (!installation) {
    return false;
  }

  const dashboardUrl = `${BASE_URL}/tickets/${ticket.id}`;
  const embed = buildTicketEmbed(ticket, dashboardUrl);

  try {
    const response = await discordRequest(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        embeds: [embed],
        components: [
          buildStatusButton(ticket.id, ticket.status),
          buildDashboardButton(dashboardUrl),
        ],
      }),
    });

    if (!response.ok) {
      console.error('Failed to update Discord message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to update Discord message:', error);
    return false;
  }
}

/**
 * Get Discord user info.
 */
export async function getDiscordUserInfo(userId: string): Promise<{
  id: string;
  username: string;
  global_name?: string;
} | null> {
  try {
    const response = await discordRequest(`/users/${userId}`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Get Discord user info error:', error);
    return null;
  }
}

// Types for Discord events
export type DiscordMessageEvent = {
  id: string;
  type: number;
  content: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
    bot?: boolean;
  };
  timestamp: string;
  guild_id?: string;
  message_reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
};

export type DiscordGatewayEvent = {
  t: string; // Event type (MESSAGE_CREATE, etc.)
  s: number; // Sequence number
  op: number; // Opcode
  d: DiscordMessageEvent | unknown; // Event data
};

/**
 * Archive or unarchive a Discord thread.
 * @param threadId - The thread ID to modify
 * @param archived - true to archive, false to unarchive
 */
export async function setDiscordThreadArchived(
  threadId: string,
  archived: boolean
): Promise<boolean> {
  try {
    const response = await discordRequest(`/channels/${threadId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        archived,
        // When unarchiving, also unlock the thread so people can send messages
        locked: archived,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to ${archived ? 'archive' : 'unarchive'} Discord thread:`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to ${archived ? 'archive' : 'unarchive'} Discord thread:`, error);
    return false;
  }
}
