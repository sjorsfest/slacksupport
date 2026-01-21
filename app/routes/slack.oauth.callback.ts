import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { exchangeSlackCode, storeSlackInstallation } from '~/lib/slack.server';

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
 * GET /slack/oauth/callback
 * Handles the OAuth callback from Slack.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');


  // Handle Slack errors (e.g., user cancelled)
  if (error) {
    console.error('Slack OAuth error:', error);
    return redirect('/connect/slack?error=oauth_cancelled');
  }

  if (!code || !state) {
    return redirect('/connect/slack?error=missing_params');
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
    return redirect('/connect/slack?error=invalid_state');
  }

  const accountId = oauthState.accountId;
  const returnTo = getReturnTo(state);
  const redirectBase = returnTo ?? '/connect/slack';

  // Delete used state
  await prisma.oAuthState.delete({ where: { id: oauthState.id } });

  try {
    // Exchange code for token
    const response = await exchangeSlackCode(code);

    if (!response.ok || !response.access_token || !response.team || !response.bot_user_id) {
      console.error('Slack token exchange failed:', response.error);
      return redirect(buildRedirect(redirectBase, { error: 'token_exchange_failed' }));
    }

    // Store installation
    await storeSlackInstallation(accountId, {
      teamId: response.team.id,
      teamName: response.team.name,
      accessToken: response.access_token,
      botUserId: response.bot_user_id,
      scopes: response.scope?.split(',') || [],
    });

    console.log('Slack installation successful for account:', accountId);
    return redirect(buildRedirect(redirectBase, { success: 'true' }));
  } catch (err) {
    console.error('Slack OAuth callback error:', err);
    return redirect(buildRedirect(redirectBase, { error: 'internal_error' }));
  }
}
