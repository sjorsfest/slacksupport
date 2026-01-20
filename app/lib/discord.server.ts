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

/**
 * Create a new ticket thread in Discord.
 * Posts a message and creates a thread from it.
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

  // Build the ticket message content
  let content = `**🎫 New Support Ticket**\n\n`;
  content += `${ticket.firstMessage}\n\n`;

  if (ticket.visitorEmail || ticket.visitorName || ticket.metadata) {
    content += `───────────────\n`;
    if (ticket.visitorName) {
      content += `**Name:** ${ticket.visitorName}\n`;
    }
    if (ticket.visitorEmail) {
      content += `**Email:** ${ticket.visitorEmail}\n`;
    }
    if (ticket.metadata) {
      for (const [key, value] of Object.entries(ticket.metadata)) {
        content += `**${key}:** ${String(value)}\n`;
      }
    }
  }

  content += `\n[View in Dashboard](${dashboardUrl}) • Reply in this thread to respond`;

  try {
    // First, post the initial message
    const messageResponse = await discordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
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
