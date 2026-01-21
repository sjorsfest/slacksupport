import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { exchangeDiscordCode, storeDiscordInstallation, getBotUser, getGuildInfo } from '~/lib/discord.server';

function getReturnTo(state: string): string | null {
  const parts = state.split('.', 2);
  if (parts.length < 2) return null;
  try {
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    return decoded.startsWith('/onboarding') ? decoded : null;
  } catch {
    return null;
  }
}

function buildRedirect(basePath: string, params: Record<string, string>) {
  const url = new URL(basePath, 'http://localhost');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.pathname + url.search;
}

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
  const returnTo = getReturnTo(state);
  const redirectBase = returnTo ?? '/connect/discord';

  // Delete used state
  await prisma.oAuthState.delete({ where: { id: oauthState.id } });

  try {
    // Exchange code for token
    const response = await exchangeDiscordCode(code);

    if (!response.ok) {
      console.error('Discord token exchange failed:', response.error);
      return redirect(buildRedirect(redirectBase, { error: 'token_exchange_failed' }));
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
      return redirect(buildRedirect(redirectBase, { error: 'no_guild' }));
    }

    // Get bot user info
    const botUser = await getBotUser();
    if (!botUser) {
      console.error('Discord: Failed to get bot user info');
      return redirect(buildRedirect(redirectBase, { error: 'bot_error' }));
    }

    // Store installation
    await storeDiscordInstallation(accountId, {
      guildId: guild.id,
      guildName: guild.name,
      accessToken: response.access_token || '',
      botUserId: botUser.id,
    });

    console.log('Discord installation successful for account:', accountId);
    return redirect(buildRedirect(redirectBase, { success: 'true' }));
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    return redirect(buildRedirect(redirectBase, { error: 'internal_error' }));
  }
}
