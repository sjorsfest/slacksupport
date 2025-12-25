import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { prisma } from "~/lib/db.server";
import { settings } from "~/lib/settings.server";

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
      primaryColor: "#4A154B",
      accentColor: "#1264A3",
      greetingText: "Hi! How can we help you today?",
      companyName: "",
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
  const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState(allowedDomains);
  const [newDomain, setNewDomain] = useState("");
  const [copied, setCopied] = useState(false);

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

  const embedCode = `<script>
  window.SupportWidget = { accountId: "${accountId}" };
</script>
<script async src="${baseUrl}/widget/loader.js"></script>`;

  const embedCodeWithMetadata = `<script>
  window.SupportWidget = {
    accountId: "${accountId}",
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
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Widget Settings</h1>
        <p className="text-gray-600 mt-1">
          Customize and embed your support widget
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Settings */}
        <div className="space-y-6">
          {/* Appearance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Appearance
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Greeting Text
                </label>
                <textarea
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="w-full py-2.5 bg-[#4A154B] text-white font-medium rounded-lg hover:bg-[#3D1141] transition-colors disabled:opacity-50"
              >
                {saved ? "✓ Saved!" : isSavingConfig ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Allowed Domains */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Allowed Domains
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Only these domains can embed your widget
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addDomain())
                }
                placeholder="example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent"
              />
              <button
                onClick={addDomain}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>

            {domains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {domains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
                  >
                    {domain}
                    <button
                      onClick={() => removeDomain(domain)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-4 h-4"
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
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No domains configured. Widget will work on any domain.
              </p>
            )}
          </div>

          {/* Embed Code */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Embed Code
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Add this snippet before the closing{" "}
              <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>{" "}
              tag
            </p>

            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{embedCode}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(embedCode)}
                className="absolute top-2 right-2 p-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
              >
                {copied ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>

            <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                With visitor identification (optional)
              </summary>
              <pre className="mt-2 bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{embedCodeWithMetadata}</code>
              </pre>
            </details>
          </div>
        </div>

        {/* Right column: Preview */}
        <div className="lg:sticky lg:top-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preview
            </h2>

            <div className="relative bg-gray-100 rounded-lg h-[500px] overflow-hidden">
              {/* Fake website background */}
              <div className="absolute inset-0 p-4">
                <div className="h-4 w-32 bg-gray-300 rounded mb-4"></div>
                <div className="h-3 w-full bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-3/4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
              </div>

              {/* Widget preview */}
              <div className="absolute bottom-4 right-4">
                {/* Chat panel */}
                <div className="mb-3 w-80 bg-white rounded-2xl shadow-xl overflow-hidden">
                  <div
                    className="px-4 py-3 text-white font-medium text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
                    }}
                  >
                    {companyName || "Support"}
                  </div>
                  <div className="p-4 bg-gray-50">
                    <div className="text-center text-gray-600 text-sm py-4">
                      <div className="text-lg mb-1">👋 Hi there!</div>
                      <div className="text-gray-500">{greetingText}</div>
                    </div>
                  </div>
                  <div className="p-3 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-gray-400 text-sm">
                        Send a message...
                      </div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: accentColor }}
                      >
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Launcher button */}
                <div
                  className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center ml-auto"
                  style={{ backgroundColor: primaryColor }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
