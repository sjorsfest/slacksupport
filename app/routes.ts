import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Landing page
  index("routes/_index.tsx"),
  
  // Auth routes
  layout("routes/_auth.tsx", [
    route("login", "routes/_auth.login.tsx"),
    route("signup", "routes/_auth.signup.tsx"),
    route("verify-email/pending", "routes/_auth.verify-email.pending.tsx"),
    route("verify-email/success", "routes/_auth.verify-email.success.tsx"),
  ]),
  
  // Dashboard routes (protected)
  layout("routes/_dashboard.tsx", [
    layout("routes/_dashboard.onboarding.tsx", [
      route("onboarding", "routes/_dashboard.onboarding._index.tsx"),
      route("onboarding/settings", "routes/_dashboard.onboarding.settings.tsx"),
      route("onboarding/domains", "routes/_dashboard.onboarding.domains.tsx"),
      route("onboarding/connect", "routes/_dashboard.onboarding.connect.tsx"),
      route("onboarding/connect/slack", "routes/_dashboard.onboarding.connect.slack.tsx"),
      route("onboarding/connect/discord", "routes/_dashboard.onboarding.connect.discord.tsx"),
      route("onboarding/connect/telegram", "routes/_dashboard.onboarding.connect.telegram.tsx"),
      route("onboarding/embed", "routes/_dashboard.onboarding.embed.tsx"),
    ]),
    route("tickets", "routes/_dashboard.tickets._index.tsx"),
    route("tickets/:id", "routes/_dashboard.tickets.$id.tsx"),
    route("connect", "routes/_dashboard.connect._index.tsx"),
    route("connect/slack", "routes/_dashboard.connect.slack.tsx"),
    route("connect/discord", "routes/_dashboard.connect.discord.tsx"),
    route("connect/telegram", "routes/_dashboard.connect.telegram.tsx"),
    route("widget", "routes/_dashboard.widget.tsx"),
    route("settings", "routes/_dashboard.settings.tsx"),
    route("settings/webhooks", "routes/_dashboard.settings.webhooks.tsx"),
    route("upgrade", "routes/_dashboard.upgrade.tsx"),
  ]),
  
  // API routes - use * to match all subpaths
  route("api/auth/*", "routes/api.auth.$.ts"),
  route("api/tickets", "routes/api.tickets.$.ts", { id: "api-tickets-root" }),
  route("api/tickets/*", "routes/api.tickets.$.ts", { id: "api-tickets-subpath" }),
  route("api/account/*", "routes/api.account.$.ts"),
  route("api/webhooks", "routes/api.webhooks.$.ts", { id: "api-webhooks-root" }),
  route("api/webhooks/*", "routes/api.webhooks.$.ts", { id: "api-webhooks-subpath" }),
  route("api/slack/*", "routes/api.slack.$.ts"),
  route("api/discord", "routes/api.discord.$.ts", { id: "api-discord-root" }),
  route("api/discord/*", "routes/api.discord.$.ts", { id: "api-discord-subpath" }),
  route("api/telegram", "routes/api.telegram.$.ts", { id: "api-telegram-root" }),
  route("api/telegram/*", "routes/api.telegram.$.ts", { id: "api-telegram-subpath" }),
  route("api/stripe", "routes/api.stripe.$.ts", { id: "api-stripe-root" }),
  route("api/stripe/*", "routes/api.stripe.$.ts", { id: "api-stripe-subpath" }),
  route("api/resend-verification", "routes/api.resend-verification.ts"),
  
  // Slack routes
  route("slack/install", "routes/slack.install.ts"),
  route("slack/oauth/callback", "routes/slack.oauth.callback.ts"),
  route("slack/events", "routes/slack.events.ts"),
  route("slack/interactive", "routes/slack.interactive.ts"),

  // Discord routes
  route("discord/install", "routes/discord.install.ts"),
  route("discord/oauth/callback", "routes/discord.oauth.callback.ts"),
  route("discord/events", "routes/discord.events.ts"),

  // Telegram routes
  route("telegram/install", "routes/telegram.install.ts"),
  route("telegram/webhook", "routes/telegram.webhook.ts"),

  // Stripe routes
  route("stripe/checkout/success", "routes/stripe.checkout.success.tsx"),
  route("stripe/checkout/cancel", "routes/stripe.checkout.cancel.tsx"),
  route("stripe/webhooks", "routes/stripe.webhooks.ts"),

  // Widget routes
  route("widget/loader.js", "routes/widget.loader[.]js.ts"),
  route("widget/config.json", "routes/widget.config[.]json.ts"),
  route("widget/frame", "routes/widget.frame.tsx"),
] satisfies RouteConfig;
