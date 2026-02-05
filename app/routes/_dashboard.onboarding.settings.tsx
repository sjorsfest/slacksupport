import { useLoaderData } from "react-router";
import { WidgetAccessSettings } from "~/components/WidgetAccessSettings";
import { loader as settingsLoader } from "./_dashboard.settings";

export const loader = settingsLoader;

export default function OnboardingSettings() {
  const { allowedDomains, config, isFreemiumUser } =
    useLoaderData<typeof settingsLoader>();

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
          Settings
        </h1>
        <p className="text-muted-foreground text-base lg:text-lg">
          Set up office hours and allowed domains after connecting an integration.
        </p>
      </div>

      <WidgetAccessSettings
        allowedDomains={allowedDomains}
        config={config}
        isFreemiumUser={isFreemiumUser}
        showContinue
        continueHref="/onboarding/embed"
      />
    </div>
  );
}
