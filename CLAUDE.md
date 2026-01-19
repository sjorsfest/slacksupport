# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant SaaS ticketing tool with an embeddable website widget and Slack integration. Visitor messages from the widget create Slack threads, and agent replies sync back in real-time.

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
- **Redis** for job queues (BullMQ) and real-time pub/sub
- **WebSocket** for real-time message updates
- **Better Auth** for authentication (email/password + Google/Twitter OAuth)
- **Tailwind CSS 4** for styling

### Route Patterns (file-based routing in `app/routes/`)
- `_auth.*` - Auth layout and pages (login, signup)
- `_dashboard.*` - Protected dashboard pages (requires authenticated user)
- `api.*` - REST API endpoints
- `slack.*` - Slack OAuth and event webhooks
- `widget.*` - Widget iframe and loader script

### Data Flow
1. Widget (iframe) sends messages via REST API to backend
2. Backend creates ticket/message in PostgreSQL
3. Backend posts to Slack thread via Slack API
4. Slack replies trigger webhook to `/slack/events`
5. BullMQ worker processes event, saves to DB, publishes to Redis
6. WebSocket server broadcasts to connected widget clients

### Multi-Tenant Model
- **Account** = tenant organization (isolated data)
- **User** = dashboard user (belongs to Account)
- **Visitor** = website visitor (belongs to Account)
- OAuth signup automatically creates Account from email domain

### Key Server Files
- `server.ts` - Express + HTTP + WebSocket + worker startup
- `app/lib/auth.server.ts` - Better Auth config with tenant linking
- `app/lib/db.server.ts` - Prisma client singleton
- `app/lib/redis.server.ts` - Redis client + BullMQ queues
- `app/lib/ws.server.ts` - WebSocket server with Redis pub/sub
- `app/jobs/slack-event.job.ts` - Slack event worker

### Job Queues (BullMQ)
- `slack-events` - Process incoming Slack events with deduplication
- `webhook-delivery` - Deliver webhooks with retry logic (5 attempts, exponential backoff)

### Environment Variables
See `.env.example` for all required variables. Key ones:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis for jobs and pub/sub
- `ENCRYPTION_KEY` - 64-char hex for encrypting Slack tokens
- `SLACK_*` - Slack app credentials
- `BETTER_AUTH_SECRET` - Auth session signing

## Important Patterns

### Server-Only Imports
Files ending in `.server.ts` contain server-only code. Prisma client, Redis, and auth helpers must only be imported in server contexts (loaders, actions, API routes).

### Slack Token Encryption
Slack OAuth tokens are encrypted at rest using `ENCRYPTION_KEY`. Use `encrypt()`/`decrypt()` from `crypto.server.ts`.

### Real-Time Updates
Messages use Redis pub/sub channels per ticket. WebSocket server subscribes/unsubscribes as clients connect/disconnect. Pattern: `ticket:${ticketId}`.
