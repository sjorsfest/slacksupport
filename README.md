# Support Widget (Donkey Support)

A multi-tenant customer support platform with an embeddable website widget and multi-channel routing to Slack, Discord, and Telegram. Visitor messages create tickets, and agent replies sync back to the widget in real time.

## What This App Does

- Visitors start conversations through the widget on your website.
- Each conversation becomes a ticket in the dashboard and a thread in your chosen chat platform.
- Agents reply in Slack/Discord/Telegram and the visitor sees responses instantly.
- Teams manage tickets, customize the widget, set office hours, and restrict allowed domains.

## Key Features

- Embeddable widget with real-time messaging
- Slack, Discord, and Telegram integrations
- Office hours with “away” state in the widget
- Allowed domain restrictions for widget embedding
- Ticket dashboard with threaded conversations
- Webhooks for ticket events
- Freemium and Pro subscriptions with Stripe checkout

## Plans (As Implemented)

Freemium
- 1 to 3 allowed domains (minimum 1)
- “Powered by Donkey Support” branding on the widget
- Webhooks shown as a Pro feature in the UI

Pro
- Unlimited allowed domains
- Branding removed
- Webhooks enabled in the UI

Note: Webhooks are UI-gated in the dashboard. Server-side enforcement is not currently implemented.

## Tech Stack

- React Router 7 (full-stack)
- PostgreSQL + Prisma
- Better Auth (Email/Password + Social)
- Stripe (subscriptions)
- BullMQ + Redis (jobs + pub/sub)
- WebSocket + Redis pub/sub (real-time)
- Tailwind CSS 4

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for local Postgres and Redis)
- A Slack workspace (if you want Slack integration)
- Stripe test keys and products (required for signup + freemium provisioning)

### 1. Install

```bash
git clone <repo-url>
cd slacksupport
npm install
```

### 2. Start Databases

```bash
docker-compose up -d postgres redis
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Generate secrets:

```bash
openssl rand -hex 32      # ENCRYPTION_KEY
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 32   # BETTER_AUTH_SECRET
```

Minimum required variables for a working app:

- `DATABASE_URL`
- `REDIS_URL`
- `BASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `STRIPE_PUBLIC_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRODUCT_ID`
- `STRIPE_FREEMIUM_PRODUCT_ID`

Optional (only if you want the integration):

- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- Discord: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

### 4. Initialize Database

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`.

### 6. Test Credentials

If you ran the seed script:

- Email: `demo@example.com`
- Password: `demo123`

## Integration Setup

### Slack

1. Go to `https://api.slack.com/apps` and create a new app from `slack-app-manifest.json`.
2. Replace `YOUR_DOMAIN` in the manifest with your public URL (ngrok or production).
3. Install the app to your workspace and copy credentials to `.env`.

Local tunneling (example):

```bash
ngrok http 5173
```

Set `BASE_URL` to your ngrok URL and update the Slack manifest.

### Discord

Create an app in the Discord Developer Portal and set:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`

### Telegram

Create a bot with BotFather and set:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

## How People Use It

1. Sign up and connect Slack, Discord, or Telegram.
2. Configure allowed domains and office hours.
3. Embed the widget on your site.
4. Respond to tickets in the dashboard or directly in your chat platform.

## Widget Integration

Basic:

```html
<script>
  window.SupportWidget = { accountId: "your-account-id" };
</script>
<script async src="https://your-domain.com/widget/loader.js"></script>
```

With visitor identification:

```html
<script>
  window.SupportWidget = {
    accountId: "your-account-id",
    email: "visitor@example.com",
    name: "John Doe",
    metadata: {
      userId: "12345",
      plan: "pro"
    }
  };
</script>
<script async src="https://your-domain.com/widget/loader.js"></script>
```

## API Endpoints (Selected)

- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets/:id/messages`
- `PUT /api/tickets/:id`
- `GET /api/account`
- `PUT /api/account`
- `GET /api/account/widget-config`
- `PUT /api/account/widget-config`
- `GET /api/webhooks`
- `POST /api/webhooks`

## Running Tests

```bash
npm test
```

## Production Deployment

Build:

```bash
npm run build
```

Notes:

- Use managed Postgres and Redis
- Set `NODE_ENV=production`
- Set `BASE_URL` and `BETTER_AUTH_URL` to your production domain

### Docker

```bash
docker build -t slacksupport .
docker run -p 3000:3000 --env-file .env slacksupport
```

## License

MIT
