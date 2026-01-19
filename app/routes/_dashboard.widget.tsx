import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  Palette,
  Globe,
  Code,
} from "lucide-react";

import { requireUser } from "~/lib/auth.server";
import { prisma } from "~/lib/db.server";
import { settings } from "~/lib/settings.server";
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
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { ColorPicker } from "~/components/ui/color-picker";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const [account, widgetConfig] = await Promise.all([
    prisma.account.findUnique({
      where: { id: user.accountId },
      select: { id: true, allowedDomains: true },
    }),
    prisma.widgetConfig.findUnique({
      where: { accountId: user.accountId },
    }),
  ]);

  const baseUrl = settings.BASE_URL;

  return {
    accountId: user.accountId,
    allowedDomains: account?.allowedDomains || [],
    config: widgetConfig || {
      primaryColor: "#D0FAA2",
      accentColor: "#FF4FA3",
      greetingText: "Hi! How can we help you today?",
      companyName: "donkey support",
      controlledByHost: false,
    },
    baseUrl,
  };
}

export default function WidgetSettings() {
  const { accountId, allowedDomains, config, baseUrl } =
    useLoaderData<typeof loader>();
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor);
  const [accentColor, setAccentColor] = useState(config.accentColor);
  const [greetingText, setGreetingText] = useState(config.greetingText);
  const [companyName, setCompanyName] = useState(config.companyName || "");
  const [controlledByHost, setControlledByHost] = useState(
    config.controlledByHost || false
  );
  const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState(allowedDomains);
  const [newDomain, setNewDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "preview">(
    "settings"
  );

  const configFetcher = useFetcher();
  const domainsFetcher = useFetcher();

  const isSavingConfig = configFetcher.state !== "idle";

  useEffect(() => {
    if (configFetcher.state === "idle" && configFetcher.data) {
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [configFetcher.state, configFetcher.data]);

  const baseConfigLines = [
    `accountId: ${JSON.stringify(accountId)}`,
    controlledByHost ? "controlledByHost: true" : null,
    controlledByHost ? "widgetIsOpen: false" : null,
  ].filter(Boolean);

  const embedCode = `<script>
  window.SupportWidget = {
    ${baseConfigLines.join(",\n    ")}
  };
</script>
<script async src="${baseUrl}/widget/loader.js"></script>`;

  const embedCodeWithMetadata = `<script>
  window.SupportWidget = {
    ${baseConfigLines.join(",\n    ")},
    // Optional: Identify the visitor
    email: "user@example.com",
    name: "John Doe",
    // Optional: Custom metadata visible in Slack
    metadata: {
      userId: "12345",
      plan: "pro"
    }
  };
</script>
<script async src="${baseUrl}/widget/loader.js"></script>`;

  const handleSaveConfig = () => {
    configFetcher.submit(
      {
        primaryColor,
        accentColor,
        greetingText,
        companyName: companyName || null,
        controlledByHost,
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
      // Auto-save
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-24 lg:pb-8">
      <div className="mb-6 lg:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-secondary-300 mb-2">
            Widget Studio
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Customize your widget to match your brand's vibe 🎨
          </p>
        </div>

        {/* Mobile Tabs */}
        <div className="flex xl:hidden bg-muted p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === "settings"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === "preview"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Settings Column */}
        <div
          className={cn(
            "xl:col-span-7 space-y-6",
            activeTab === "settings" ? "block" : "hidden xl:block"
          )}
        >
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Palette className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle>Appearance</CardTitle>
              </div>
              <CardDescription>
                Make it yours! Choose colors that pop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Donkey Support"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Greeting Text</Label>
                  <Input
                    value={greetingText}
                    onChange={(e) => setGreetingText(e.target.value)}
                    placeholder="e.g. Hi! How can we help?"
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ColorPicker
                  label="Primary Color (Backgrounds)"
                  description="Widget button & header"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                />

                <ColorPicker
                  label="Accent Color (Buttons/Highlights)"
                  description="Send button & links"
                  value={accentColor}
                  onChange={setAccentColor}
                />
              </div>

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

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-amber-700" />
                </div>
                <CardTitle>Behavior</CardTitle>
              </div>
              <CardDescription>
                Hide the bubble and let your site control open/close state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">
                    Control widget from your site
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Toggle with{" "}
                    <code className="font-mono">
                      window.SupportWidget.widgetIsOpen
                    </code>
                  </p>
                </div>
                <Switch
                  checked={controlledByHost}
                  onChange={(e) => setControlledByHost(e.target.checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle>Allowed Domains</CardTitle>
              </div>
              <CardDescription>
                Security first! Whitelist domains where your widget can live.
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
                />
                <Button variant="secondary" onClick={addDomain}>
                  Add Domain
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[40px]">
                <AnimatePresence mode="popLayout">
                  {domains.length > 0 ? (
                    domains.map((domain) => (
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
                            onClick={() => removeDomain(domain)}
                            className="p-0.5 hover:bg-background rounded-full transition-colors text-muted-foreground hover:text-destructive"
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
                    ))
                  ) : (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-muted-foreground italic flex items-center gap-2"
                    >
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      No domains restricted. Widget works everywhere.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Code className="w-5 h-5 text-slate-600" />
                </div>
                <CardTitle>Installation</CardTitle>
              </div>
              <CardDescription>
                Copy-paste this magic code before the closing{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                  &lt;/body&gt;
                </code>{" "}
                tag.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative group">
                <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-sm overflow-x-auto font-mono border border-slate-800 shadow-inner">
                  <code>{embedCode}</code>
                </pre>
                <Button
                  onClick={() => copyToClipboard(embedCode)}
                  variant="secondary"
                  size="sm"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <details className="group">
                <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs group-open:rotate-90 transition-transform">
                    ▶
                  </div>
                  Advanced: Identify your users
                </summary>
                <div className="mt-3 relative group">
                  <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-sm overflow-x-auto font-mono border border-slate-800 shadow-inner">
                    <code>{embedCodeWithMetadata}</code>
                  </pre>
                  <Button
                    onClick={() => copyToClipboard(embedCodeWithMetadata)}
                    variant="secondary"
                    size="sm"
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>

        {/* Preview Column */}
        <div
          className={cn(
            "xl:col-span-5",
            activeTab === "preview" ? "block" : "hidden xl:block"
          )}
        >
          <div className="sticky top-8">
            <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-900 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
              <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
              <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
              <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
              <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
              <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>

              <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative">
                {/* Mock Website Content */}
                <div className="absolute inset-0 bg-slate-50 p-4 overflow-hidden opacity-50 pointer-events-none">
                  <div className="h-8 w-24 bg-slate-200 rounded-lg mb-8" />
                  <div className="space-y-4">
                    <div className="h-32 bg-slate-200 rounded-2xl" />
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    <div className="h-4 w-1/2 bg-slate-200 rounded" />
                  </div>
                </div>

                {/* Widget Preview */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4">
                  <motion.div
                    layout
                    className="bg-white rounded-2xl overflow-hidden border-2 border-black mb-4 origin-bottom-right"
                    style={{ boxShadow: "4px 4px 0px 0px #1a1a1a" }}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {/* Widget Header */}
                    <div
                      className="p-4 text-white border-b-2 border-black"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            {companyName || "Donkey Support"}
                          </div>
                          <div className="text-[10px] opacity-90">
                            We reply fast!
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Widget Body */}
                    <div className="p-4 bg-slate-50 h-64 flex flex-col">
                      <div className="flex-1 flex items-center justify-center text-center p-4">
                        <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100">
                          <div className="text-2xl mb-2">👋</div>
                          <p
                            className="font-bold mb-1"
                            style={{ color: accentColor }}
                          >
                            Hi there!
                          </p>
                          <p className="text-xs text-slate-500">
                            {greetingText}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Widget Footer */}
                    <div className="p-3 bg-white border-t border-black">
                      <div className="flex gap-2">
                        <div className="flex-1 h-9 bg-slate-50 rounded-full px-3 flex items-center text-xs text-muted-foreground border border-slate-200">
                          Type a message...
                        </div>
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-sm"
                          style={{ backgroundColor: accentColor }}
                        >
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Widget Toggle Button */}
                  <div className="flex justify-end">
                    <motion.div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white cursor-pointer border-2 border-black"
                      style={{
                        backgroundColor: primaryColor,
                        boxShadow: "3px 3px 0px 0px #1a1a1a",
                      }}
                      whileHover={{
                        scale: 1.08,
                        rotate: -8,
                        boxShadow: "4px 4px 0px 0px #1a1a1a",
                      }}
                      whileTap={{
                        scale: 0.92,
                        boxShadow: "1px 1px 0px 0px #1a1a1a",
                      }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        scale: { type: "spring", stiffness: 400, damping: 17 },
                      }}
                    >
                      <MessageSquare className="w-7 h-7 drop-shadow-[1px_1px_0px_rgba(0,0,0,0.2)]" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
