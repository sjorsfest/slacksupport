import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { exchangeDiscordCode, storeDiscordInstallation, getBotUser, getGuildInfo } from '~/lib/discord.server';

/**
 * GET /discord/oauth/callback
 * Handles the OAuth callback from Discord.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const guildId = url.searchParams.get('guild_id');
  const error = url.searchParams.get('error');

  // Handle Discord errors (e.g., user cancelled)
  if (error) {
    console.error('Discord OAuth error:', error);
    return redirect('/connect/discord?error=oauth_cancelled');
  }

  if (!code || !state) {
    return redirect('/connect/discord?error=missing_params');
  }

  // Verify state token
  const oauthState = await prisma.oAuthState.findUnique({
    where: { state },
  });

  if (!oauthState || oauthState.expiresAt < new Date()) {
    // Clean up expired state
    if (oauthState) {
      await prisma.oAuthState.delete({ where: { id: oauthState.id } });
    }
    return redirect('/connect/discord?error=invalid_state');
  }

  const accountId = oauthState.accountId;

  // Delete used state
  await prisma.oAuthState.delete({ where: { id: oauthState.id } });

  try {
    // Exchange code for token
    const response = await exchangeDiscordCode(code);

    if (!response.ok) {
      console.error('Discord token exchange failed:', response.error);
      return redirect('/connect/discord?error=token_exchange_failed');
    }

    // Get guild info - either from response or from guild_id param
    let guild = response.guild;
    if (!guild && guildId) {
      const guildInfo = await getGuildInfo(guildId);
      if (guildInfo) {
        guild = { id: guildInfo.id, name: guildInfo.name };
      }
    }

    if (!guild) {
      console.error('Discord: No guild info available');
      return redirect('/connect/discord?error=no_guild');
    }

    // Get bot user info
    const botUser = await getBotUser();
    if (!botUser) {
      console.error('Discord: Failed to get bot user info');
      return redirect('/connect/discord?error=bot_error');
    }

    // Store installation
    await storeDiscordInstallation(accountId, {
      guildId: guild.id,
      guildName: guild.name,
      accessToken: response.access_token || '',
      botUserId: botUser.id,
    });

    console.log('Discord installation successful for account:', accountId);
    return redirect('/connect/discord?success=true');
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    return redirect('/connect/discord?error=internal_error');
  }
}
