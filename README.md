# Support Widget

A multi-tenant SaaS ticketing tool with an embeddable website widget and Slack integration. Customer messages from the widget create Slack threads, and agent replies sync back to the visitor in real-time.

## Features

- **Embeddable Widget**: Add a beautiful, Slack-inspired chat widget to any website with a simple script tag
- **Slack Integration**: Tickets appear as threads in your chosen Slack channel
- **Bi-directional Sync**: Messages flow both ways in real-time via WebSocket
- **Multi-tenant**: Each customer gets their own account with isolated data
- **Webhook Support**: Send ticket events to external systems with signed payloads
- **Dashboard**: Manage tickets, configure Slack, customize widget appearance

## Tech Stack

- **Framework**: React Router 7 (full-stack)
- **Database**: PostgreSQL (Neon-compatible)
- **ORM**: Prisma
- **Auth**: Better Auth (Email/Password + Social)
- **Job Queue**: BullMQ with Redis
- **Real-time**: WebSocket + Redis pub/sub
- **Styling**: Tailwind CSS 4

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL and Redis)
- A Slack workspace where you can install apps

### 1. Clone and Install

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

Edit `.env` with your values:

```bash
# Generate encryption key
openssl rand -hex 32

# Generate session secret
openssl rand -base64 32

# Better Auth Secret
openssl rand -base64 32
```

### 4. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From an app manifest"
3. Paste the contents of `slack-app-manifest.json`
4. Replace `YOUR_DOMAIN` with your ngrok URL (see below)
5. Install to your workspace
6. Copy credentials to `.env`:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
   - `SLACK_SIGNING_SECRET`

### 5. Set Up Tunnel (for local Slack events)

Slack needs to reach your local server. Use ngrok or cloudflared:

```bash
# Using ngrok
ngrok http 5173

# Update .env
BASE_URL="https://your-subdomain.ngrok.io"

# Update Slack app manifest with your ngrok URL
```

### 6. Initialize Database

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 7. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

### 8. Test Credentials

If you ran the seed script:

- Email: `demo@example.com`
- Password: `demo123`

## Project Structure

```
slacksupport/
├── app/
│   ├── routes/           # React Router routes
│   │   ├── _auth.*       # Auth pages (login, signup) with server-side actions
│   │   ├── _dashboard.*  # Protected dashboard pages
│   │   ├── api.*         # API endpoints
│   │   ├── slack.*       # Slack OAuth and events
│   │   └── widget.*      # Widget loader and frame
│   ├── lib/              # Server utilities
│   │   ├── auth.ts       # Better Auth configuration
│   │   ├── auth.server.ts # Server-side auth helpers
│   │   ├── auth-client.ts # Client-side auth client
│   │   ├── crypto.server.ts
│   │   ├── db.server.ts
│   │   ├── redis.server.ts
│   │   ├── slack.server.ts
│   │   ├── webhook.server.ts
│   │   └── ws.server.ts
│   ├── jobs/             # BullMQ workers
│   └── types/            # Zod schemas
├── prisma/
│   └── schema.prisma     # Database schema
├── tests/                # Unit tests
└── public/               # Static assets
```

## Widget Integration

Add this snippet to your website:

```html
<script>
  window.SupportWidget = { accountId: "your-account-id" };
</script>
<script async src="https://your-domain.com/widget/loader.js"></script>
```

### With Visitor Identification

```html
<script>
  window.SupportWidget = {
    accountId: "your-account-id",
    email: "visitor@example.com",
    name: "John Doe",
    metadata: {
      userId: "12345",
      plan: "pro",
    },
  };
</script>
<script async src="https://your-domain.com/widget/loader.js"></script>
```

## API Endpoints

### Authentication

Authentication is handled by **Better Auth** and React Router server-side actions.

- `POST /signup` - Create account (via `_auth.signup.tsx` action)
- `POST /login` - Sign in (via `_auth.login.tsx` action)

### Tickets

- `GET /api/tickets` - List tickets (dashboard)
- `POST /api/tickets` - Create ticket (widget)
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets/:id/messages` - Send message
- `PUT /api/tickets/:id` - Update ticket status/priority

### Account

- `GET /api/account` - Get account info
- `PUT /api/account` - Update account
- `GET /api/account/widget-config` - Get widget settings
- `PUT /api/account/widget-config` - Update widget settings

### Slack

- `GET /slack/install` - Start OAuth flow
- `GET /slack/oauth/callback` - OAuth callback
- `POST /slack/events` - Slack Events API receiver
- `GET /api/slack/channels` - List channels
- `POST /api/slack/select-channel` - Set default channel
- `POST /api/slack/test-post` - Send test message

### Webhooks

- `GET /api/webhooks` - List webhook endpoints
- `POST /api/webhooks` - Create webhook endpoint
- `PUT /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook
- `POST /api/webhooks/:id/rotate-secret` - Rotate signing secret
- `GET /api/webhooks/:id/deliveries` - View delivery history

## Running Tests

```bash
npm test
```

## Production Deployment

### Build

```bash
npm run build
```

### Environment Variables

All variables from `.env.example` are required. For production:

- Use a hosted PostgreSQL (Neon, Supabase, etc.)
- Use a hosted Redis (Upstash, Redis Cloud, etc.)
- Set `NODE_ENV=production`
- Use your production domain for `BASE_URL`

### Docker

```bash
docker build -t slacksupport .
docker run -p 3000:3000 --env-file .env slacksupport
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Website   │────▶│   Widget    │────▶│   Backend   │
│  (Customer) │     │  (iframe)   │     │ (API + WS)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │  PostgreSQL │           │    Redis    │           │    Slack    │
             │  (Tickets)  │           │ (Jobs/PubSub)│           │  (Threads)  │
             └─────────────┘           └─────────────┘           └─────────────┘
```

## License

MIT
