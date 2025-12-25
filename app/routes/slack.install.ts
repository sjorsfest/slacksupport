import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { getSlackAuthUrl } from '~/lib/slack.server';
import { generateSecureToken } from '~/lib/crypto.server';

/**
 * GET /slack/install
 * Initiates the Slack OAuth flow.
 * Requires account_id query parameter.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('account_id');

  if (!accountId) {
    return new Response('Missing account_id parameter', { status: 400 });
  }

  // Verify account exists
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return new Response('Account not found', { status: 404 });
  }

  console.log('Slack install for account:', accountId);

  // Generate state token for CSRF protection
  const state = generateSecureToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store state in database
  await prisma.oAuthState.create({
    data: {
      state,
      accountId,
      expiresAt,
    },
  });
  console.log('Slack install state created:', state);
  // Redirect to Slack authorization
  const authUrl = getSlackAuthUrl(state);
  return redirect(authUrl);
}

