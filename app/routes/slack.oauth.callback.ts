import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { exchangeSlackCode, storeSlackInstallation } from '~/lib/slack.server';

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

  // Delete used state
  await prisma.oAuthState.delete({ where: { id: oauthState.id } });

  try {
    // Exchange code for token
    const response = await exchangeSlackCode(code);

    if (!response.ok || !response.access_token || !response.team || !response.bot_user_id) {
      console.error('Slack token exchange failed:', response.error);
      return redirect('/connect/slack?error=token_exchange_failed');
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
    return redirect('/connect/slack?success=true');
  } catch (err) {
    console.error('Slack OAuth callback error:', err);
    return redirect('/connect/slack?error=internal_error');
  }
}

