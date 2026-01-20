# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant SaaS ticketing tool with an embeddable website widget and Slack/Discord integration. Visitor messages from the widget create threads in Slack or Discord, and agent replies sync back to the widget via polling.

## Commands

```bash
npm run dev              # Start dev server (tsx watch server.ts)
npm run build            # Production build
npm run typecheck        # Generate types + TypeScript check
npm run test             # Vitest watch mode
npm run test:run         # Single test run
npm run db:generate      # Prisma generate
npm run db:push          # Push schema to database
npm run db:seed          # Seed with demo data (demo@example.com / demo123)
npm run db:studio        # Prisma Studio GUI
npm run expose           # ngrok tunnel for Slack events
```

Local development requires Docker for PostgreSQL and Redis:
```bash
docker-compose up -d postgres redis
```

## Architecture

### Tech Stack
- **React Router 7** (full-stack SSR)
- **PostgreSQL** with Prisma ORM
- **Redis** for BullMQ job queues
- **discord.js** for Discord Gateway connection
- **Better Auth** for authentication (email/password + Google/Twitter OAuth)
- **Tailwind CSS 4** for styling

### Route Patterns (file-based routing in `app/routes/`)
- `_auth.*` - Auth layout and pages (login, signup)
- `_dashboard.*` - Protected dashboard pages (requires authenticated user)
- `api.*` - REST API endpoints
- `slack.*` - Slack OAuth and event webhooks
- `discord.*` - Discord OAuth, installation, and event webhooks
- `widget.*` - Widget iframe and loader script

### Data Flow

#### Widget → Slack/Discord (Outbound)
1. Widget (iframe) sends message via `POST /api/tickets` or `POST /api/tickets/:id/messages`
2. Backend creates `Ticket` and `Message` records in PostgreSQL
3. Backend posts to Slack thread (via Slack API) or Discord thread (via Discord REST API)

#### Slack → Widget (Inbound)
1. Slack sends webhook to `/slack/events` when users reply in threads
2. Event is queued to BullMQ `slack-events` queue (or processed inline on serverless)
3. Worker processes event, creates `Message` record in database
4. Widget polls `/api/tickets/:id/messages?since={timestamp}` every 2.5 seconds
5. New messages appear in widget

#### Discord → Widget (Inbound)
1. Discord Gateway client (`discord.js`) maintains WebSocket connection to Discord
2. `MESSAGE_CREATE` events in threads are received in real-time
3. Events are processed directly by `processDiscordEvent()`, creating `Message` records
4. Widget polls `/api/tickets/:id/messages?since={timestamp}` every 2.5 seconds
5. New messages appear in widget

**Note:** Discord requires a persistent Gateway WebSocket connection because Discord does not send message events via HTTP webhooks. The `/discord/events` endpoint only handles Discord Interactions (slash commands, not message events).

### Multi-Tenant Model
- **Account** = tenant organization (isolated data)
- **User** = dashboard user (belongs to Account)
- **Visitor** = website visitor (belongs to Account)
- OAuth signup automatically creates Account from email domain

### Key Server Files
- `server.ts` - Express server + worker startup
- `app/lib/auth.server.ts` - Better Auth config with tenant linking
- `app/lib/db.server.ts` - Prisma client singleton
- `app/lib/redis.server.ts` - Redis client + BullMQ queues
- `app/lib/discord-gateway.server.ts` - Discord Gateway client (receives Discord messages)
- `app/lib/discord-processor.server.ts` - Discord event processing logic
- `app/lib/slack-processor.server.ts` - Slack event processing logic
- `app/jobs/slack-event.job.ts` - Slack event BullMQ worker
- `app/jobs/discord-event.job.ts` - Discord event BullMQ worker

### Job Queues (BullMQ)
- `slack-events` - Process incoming Slack events with deduplication
- `discord-events` - Process Discord events (used when events come via webhook, not Gateway)
- `webhook-delivery` - Deliver webhooks with retry logic (5 attempts, exponential backoff)

### Widget Message Delivery
The widget uses **polling** to receive new messages:
- Polls `/api/tickets/:id/messages?since={timestamp}` every 2.5 seconds
- Stops polling after 5 minutes of inactivity (user can resume with "Continue Chat" button)
- Simple, reliable, works on both serverless and persistent server deployments

### Environment Variables
See `.env.example` for all required variables. Key ones:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for BullMQ job queues
- `ENCRYPTION_KEY` - 64-char hex for encrypting OAuth tokens
- `SLACK_*` - Slack app credentials
- `DISCORD_*` - Discord app credentials (CLIENT_ID, CLIENT_SECRET, BOT_TOKEN, PUBLIC_KEY)
- `BETTER_AUTH_SECRET` - Auth session signing

## Important Patterns

### Server-Only Imports
Files ending in `.server.ts` contain server-only code. Prisma client, Redis, and auth helpers must only be imported in server contexts (loaders, actions, API routes).

### Token Encryption
Slack and Discord OAuth tokens are encrypted at rest using `ENCRYPTION_KEY`. Use `encrypt()`/`decrypt()` from `crypto.server.ts`.

### Discord Gateway Intents
The Discord bot requires the **Message Content Intent** enabled in the Discord Developer Portal (Bot → Privileged Gateway Intents) to receive message content.
