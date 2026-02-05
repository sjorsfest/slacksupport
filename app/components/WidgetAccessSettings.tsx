import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Globe,
  Sparkles,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London (UK)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (Japan)" },
  { value: "Asia/Shanghai", label: "Shanghai (China)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney (Australia)" },
];

type WidgetAccessSettingsProps = {
  allowedDomains: string[];
  config: {
    officeHoursStart?: string | null;
    officeHoursEnd?: string | null;
    officeHoursTimezone?: string | null;
  };
  isFreemiumUser: boolean;
  showContinue?: boolean;
  continueHref?: string;
};

export function WidgetAccessSettings({
  allowedDomains,
  config,
  isFreemiumUser,
  showContinue = false,
  continueHref = "/onboarding/connect",
}: WidgetAccessSettingsProps) {
  const [domains, setDomains] = useState(allowedDomains);
  const [newDomain, setNewDomain] = useState("");
  const hasDomains = domains.length > 0;

  const [officeHoursEnabled, setOfficeHoursEnabled] = useState(
    Boolean(config.officeHoursStart && config.officeHoursEnd)
  );
  const [officeHoursStart, setOfficeHoursStart] = useState(
    config.officeHoursStart || "09:00"
  );
  const [officeHoursEnd, setOfficeHoursEnd] = useState(
    config.officeHoursEnd || "17:00"
  );
  const [officeHoursTimezone, setOfficeHoursTimezone] = useState(
    config.officeHoursTimezone || "UTC"
  );

  const configFetcher = useFetcher();
  const domainsFetcher = useFetcher();
  const isSavingConfig = configFetcher.state !== "idle";
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (configFetcher.state === "idle" && configFetcher.data) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [configFetcher.state, configFetcher.data]);

  const handleSaveConfig = () => {
    configFetcher.submit(
      {
        officeHoursStart: officeHoursEnabled ? officeHoursStart : null,
        officeHoursEnd: officeHoursEnabled ? officeHoursEnd : null,
        officeHoursTimezone: officeHoursEnabled ? officeHoursTimezone : null,
      },
      {
        method: "PUT",
        action: "/api/account/widget-config",
        encType: "application/json",
      }
    );
  };

  const addDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !domains.includes(domain)) {
      const newDomains = [...domains, domain];
      setDomains(newDomains);
      setNewDomain("");
      domainsFetcher.submit(
        { domains: newDomains },
        {
          method: "PUT",
          action: "/api/account/allowed-domains",
          encType: "application/json",
        }
      );
    }
  };

  const removeDomain = (domain: string) => {
    if (domains.length <= 1) {
      return;
    }
    const newDomains = domains.filter((d) => d !== domain);
    setDomains(newDomains);
    domainsFetcher.submit(
      { domains: newDomains },
      {
        method: "PUT",
        action: "/api/account/allowed-domains",
        encType: "application/json",
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle>Allowed Domains</CardTitle>
            {isFreemiumUser && (
              <Badge variant="outline" className="ml-auto text-xs">
                {domains.length}/3 domains
              </Badge>
            )}
          </div>
          <CardDescription>
            Security first! Whitelist domains where your widget can live.
            {isFreemiumUser && (
              <span className="block text-xs mt-1 text-amber-600">
                Freemium accounts can have 1-3 domains.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addDomain())
              }
              placeholder="example.com"
              className="bg-muted/30"
              disabled={isFreemiumUser && domains.length >= 3}
            />
            <Button
              variant="secondary"
              onClick={addDomain}
              disabled={isFreemiumUser && domains.length >= 3}
            >
              Add Domain
            </Button>
          </div>

          {isFreemiumUser && domains.length >= 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 border border-purple-200 bg-purple-50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">
                      Domain limit reached
                    </p>
                    <p className="text-sm text-purple-700">
                      Upgrade to add unlimited domains.
                    </p>
                  </div>
                </div>
                <a
                  href="/upgrade"
                  className="flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-900"
                >
                  Upgrade <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          )}

          <div className="flex flex-wrap gap-2 min-h-[40px]">
            <AnimatePresence mode="popLayout">
              {hasDomains ? (
                domains.map((domain) => {
                  const canRemove = domains.length > 1;
                  return (
                    <motion.div
                      key={domain}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      layout
                    >
                      <Badge
                        variant="secondary"
                        className="gap-2 pl-3 pr-1 py-1.5 text-sm font-normal text-black bg-muted hover:bg-muted/80"
                      >
                        {domain}
                        <button
                          onClick={() => canRemove && removeDomain(domain)}
                          disabled={!canRemove}
                          title={
                            !canRemove
                              ? "At least 1 domain is required"
                              : "Remove domain"
                          }
                          className={cn(
                            "p-0.5 rounded-full transition-colors",
                            canRemove
                              ? "hover:bg-background text-muted-foreground hover:text-destructive"
                              : "opacity-30 cursor-not-allowed text-muted-foreground"
                          )}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </Badge>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full border border-amber-200 bg-amber-50 rounded-xl p-4"
                >
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        At least one domain is required
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Add a domain above to continue. This keeps your widget
                        restricted to approved sites.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <CardTitle>Office Hours</CardTitle>
          </div>
          <CardDescription>
            Let visitors know when you're available to chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <Label className="text-sm font-medium">
                Enable office hours
              </Label>
              <p className="text-xs text-muted-foreground">
                Show visitors when you're available
              </p>
            </div>
            <Switch
              checked={officeHoursEnabled}
              onChange={(e) => setOfficeHoursEnabled(e.target.checked)}
            />
          </div>

          {officeHoursEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={officeHoursStart}
                    onChange={(e) => setOfficeHoursStart(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={officeHoursEnd}
                    onChange={(e) => setOfficeHoursEnd(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <select
                  value={officeHoursTimezone}
                  onChange={(e) => setOfficeHoursTimezone(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-muted/30 text-sm"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                Outside these hours, visitors will see a message that you're
                away but can still leave messages.
              </p>
            </motion.div>
          )}

          <Button
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className={cn(
              "w-full font-bold transition-all duration-300",
              saved
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-secondary hover:bg-secondary/90 text-white"
            )}
          >
            {saved ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" /> Saved!
              </span>
            ) : isSavingConfig ? (
              "Saving..."
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {showContinue && (
        <div className="flex justify-end">
          {hasDomains ? (
            <Button asChild variant="secondary" className="px-6">
              <Link to={continueHref}>Continue</Link>
            </Button>
          ) : (
            <Button variant="secondary" className="px-6" disabled>
              Add a domain to continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
