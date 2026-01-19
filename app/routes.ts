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
    route("onboarding", "routes/_dashboard.onboarding.tsx"),
    route("onboarding/subscription", "routes/_dashboard.onboarding.subscription.tsx"),
    route("tickets", "routes/_dashboard.tickets._index.tsx"),
    route("tickets/:id", "routes/_dashboard.tickets.$id.tsx"),
    route("integrations/slack", "routes/_dashboard.integrations.slack.tsx"),
    route("widget", "routes/_dashboard.widget.tsx"),
    route("settings/webhooks", "routes/_dashboard.settings.webhooks.tsx"),
  ]),
  
  // API routes - use * to match all subpaths
  route("api/auth/*", "routes/api.auth.$.ts"),
  route("api/tickets", "routes/api.tickets.$.ts", { id: "api-tickets-root" }),
  route("api/tickets/*", "routes/api.tickets.$.ts", { id: "api-tickets-subpath" }),
  route("api/account/*", "routes/api.account.$.ts"),
  route("api/webhooks", "routes/api.webhooks.$.ts", { id: "api-webhooks-root" }),
  route("api/webhooks/*", "routes/api.webhooks.$.ts", { id: "api-webhooks-subpath" }),
  route("api/slack/*", "routes/api.slack.$.ts"),
  route("api/stripe", "routes/api.stripe.$.ts", { id: "api-stripe-root" }),
  route("api/stripe/*", "routes/api.stripe.$.ts", { id: "api-stripe-subpath" }),
  route("api/resend-verification", "routes/api.resend-verification.ts"),
  
  // Slack routes
  route("slack/install", "routes/slack.install.ts"),
  route("slack/oauth/callback", "routes/slack.oauth.callback.ts"),
  route("slack/events", "routes/slack.events.ts"),

  // Stripe routes
  route("stripe/checkout/success", "routes/stripe.checkout.success.tsx"),
  route("stripe/checkout/cancel", "routes/stripe.checkout.cancel.tsx"),
  route("stripe/webhooks", "routes/stripe.webhooks.ts"),

  // Widget routes
  route("widget/loader.js", "routes/widget.loader[.]js.ts"),
  route("widget/frame", "routes/widget.frame.tsx"),
] satisfies RouteConfig;
