import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { prisma } from "~/lib/db.server";
import { settings } from "~/lib/settings.server";
import { WidgetAccessSettings } from "~/components/WidgetAccessSettings";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const [account, widgetConfig, subscription] = await Promise.all([
    prisma.account.findUnique({
      where: { id: user.accountId },
      select: { allowedDomains: true },
    }),
    prisma.widgetConfig.findUnique({
      where: { accountId: user.accountId },
    }),
    prisma.subscription.findUnique({
      where: { accountId: user.accountId },
      select: { stripeProductId: true, status: true },
    }),
  ]);

  const isFreemiumUser = subscription &&
    ["active", "trialing"].includes(subscription.status) &&
    subscription.stripeProductId === settings.STRIPE_FREEMIUM_PRODUCT_ID;

  return {
    allowedDomains: account?.allowedDomains || [],
    config: widgetConfig || {
      officeHoursStart: null,
      officeHoursEnd: null,
      officeHoursTimezone: "UTC",
    },
    isFreemiumUser: !!isFreemiumUser,
  };
}

export default function SettingsPage() {
  const { allowedDomains, config, isFreemiumUser } =
    useLoaderData<typeof loader>();

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
          Settings
        </h1>
        <p className="text-muted-foreground text-base lg:text-lg">
          Configure office hours and widget access rules.
        </p>
      </div>

      <WidgetAccessSettings
        allowedDomains={allowedDomains}
        config={config}
        isFreemiumUser={isFreemiumUser}
      />
    </div>
  );
}
