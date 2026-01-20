/**
 * Discord Gateway Client
 *
 * Connects to Discord's Gateway WebSocket to receive real-time events
 * like MESSAGE_CREATE when users reply in Discord threads.
 *
 * This is required because Discord doesn't send message events via HTTP webhooks -
 * they only come through the Gateway WebSocket connection.
 */
import { Client, GatewayIntentBits, Events, type Message as DiscordMessage } from 'discord.js';
import { processDiscordEvent, type DiscordEventPayload } from './discord-processor.server';
import { settings } from './settings.server';

let discordClient: Client | null = null;

/**
 * Initialize and connect the Discord Gateway client.
 * This should be called once when the server starts.
 */
export async function initializeDiscordGateway(): Promise<Client | null> {
  const botToken = settings.DISCORD_BOT_TOKEN;

  if (!botToken) {
    console.warn('⚠️ DISCORD_BOT_TOKEN not configured - Discord Gateway will not connect');
    return null;
  }

  // Create Discord client with required intents
  // - Guilds: Required for basic guild information
  // - GuildMessages: Required to receive message events in guilds
  // - MessageContent: Required to read message content (privileged intent)
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Handle client ready event
  discordClient.once(Events.ClientReady, (client) => {
    console.log(`✅ Discord Gateway connected as ${client.user?.tag}`);
    console.log(`   Watching ${client.guilds.cache.size} guild(s)`);
  });

  // Handle message creation events
  discordClient.on(Events.MessageCreate, async (message: DiscordMessage) => {
    // Skip bot messages (including our own)
    if (message.author.bot) {
      return;
    }

    // Only process messages in threads (channel type 11 = public thread, 12 = private thread)
    // This is where support ticket replies come from
    if (message.channel.type !== 11 && message.channel.type !== 12) {
      return;
    }

    // Build the event payload in the format our processor expects
    const eventPayload: DiscordEventPayload = {
      t: 'MESSAGE_CREATE',
      d: {
        id: message.id,
        type: message.type,
        content: message.content,
        channel_id: message.channelId,
        author: {
          id: message.author.id,
          username: message.author.username,
          global_name: message.author.globalName || undefined,
          bot: message.author.bot,
        },
        timestamp: message.createdAt.toISOString(),
        guild_id: message.guildId || undefined,
        message_reference: message.reference ? {
          message_id: message.reference.messageId || undefined,
          channel_id: message.reference.channelId || undefined,
          guild_id: message.reference.guildId || undefined,
        } : undefined,
      },
    };

    // Process the event using the existing processor
    try {
      const result = await processDiscordEvent(message.id, eventPayload);

      if (result.processed) {
        console.log(`[Discord Gateway] Processed message ${message.id} -> DB message ${result.messageId}`);
      } else if (result.skipped) {
        // Only log skipped messages if it's not a common skip reason
        if (result.reason !== 'No matching ticket found' && result.reason !== 'Message from a bot') {
          console.log(`[Discord Gateway] Skipped message ${message.id}: ${result.reason}`);
        }
      }
    } catch (error) {
      console.error(`[Discord Gateway] Error processing message ${message.id}:`, error);
    }
  });

  // Handle errors
  discordClient.on(Events.Error, (error) => {
    console.error('[Discord Gateway] Client error:', error);
  });

  // Handle warnings
  discordClient.on(Events.Warn, (warning) => {
    console.warn('[Discord Gateway] Warning:', warning);
  });

  // Handle disconnection
  discordClient.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(`[Discord Gateway] Shard ${shardId} disconnected:`, event);
  });

  // Handle reconnection
  discordClient.on(Events.ShardReconnecting, (shardId) => {
    console.log(`[Discord Gateway] Shard ${shardId} reconnecting...`);
  });

  // Connect to Discord Gateway
  try {
    await discordClient.login(botToken);
    return discordClient;
  } catch (error) {
    console.error('[Discord Gateway] Failed to connect:', error);
    discordClient = null;
    return null;
  }
}

/**
 * Get the current Discord client instance.
 */
export function getDiscordClient(): Client | null {
  return discordClient;
}

/**
 * Disconnect the Discord Gateway client.
 * Should be called during graceful shutdown.
 */
export async function disconnectDiscordGateway(): Promise<void> {
  if (discordClient) {
    console.log('[Discord Gateway] Disconnecting...');
    discordClient.destroy();
    discordClient = null;
    console.log('[Discord Gateway] Disconnected');
  }
}
