import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { prisma } from '~/lib/db.server';
import { getTelegramInstallUrl, isTelegramConfigured } from '~/lib/telegram.server';

/**
 * GET /telegram/install
 * Redirects to Telegram deep link for adding bot to a group.
 * Requires account_id query parameter.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('account_id');

  if (!accountId) {
    return new Response('Missing account_id parameter', { status: 400 });
  }

  // Check if Telegram is configured
  if (!isTelegramConfigured()) {
    return redirect('/connect?error=telegram_not_configured');
  }

  // Verify account exists
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      slackInstallation: true,
      discordInstallation: true,
    },
  });

  if (!account) {
    return new Response('Account not found', { status: 404 });
  }

  // Check if another integration is already connected (only one allowed)
  if (account.slackInstallation) {
    return redirect('/connect?error=slack_connected');
  }
  if (account.discordInstallation) {
    return redirect('/connect?error=discord_connected');
  }

  console.log('Telegram install for account:', accountId);

  // Get the Telegram deep link URL
  const telegramUrl = await getTelegramInstallUrl(accountId);

  if (!telegramUrl) {
    return redirect('/connect?error=telegram_bot_error');
  }

  // Redirect to Telegram
  // Note: Unlike OAuth, there's no callback - user must return to dashboard manually
  return redirect(telegramUrl);
}
