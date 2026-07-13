# Smart Inbox Assistant

AI-powered inbox automation. Incoming customer messages are automatically
summarized, categorized, prioritized and displayed in a live dashboard —
no human triage needed.

![Dashboard screenshot](docs/dashboard.png)

## The problem it solves

Every business receives a constant stream of inquiries: orders, complaints,
questions, spam. Someone has to read each one, figure out what it's about,
decide how urgent it is, and route it. That's slow, repetitive and error-prone.

This system does it automatically, in seconds, 24/7:

**Trigger → AI processing → Action**

1. **Trigger** — a new message arrives via a webhook endpoint
2. **AI processing** — Claude reads the message and produces a structured
   analysis: summary, category, priority, sender info, topic
3. **Action** — the result is stored and instantly visible on a live
   dashboard with filtering and priority statistics

## Key features

- **Automatic triage** — every message gets a 1-2 sentence summary,
  a category (Order / Complaint / General Question / Spam) and
  a priority (High / Medium / Low)
- **Data extraction** — sender name, contact and topic are pulled out of
  unstructured text
- **No hallucinations by design** — the AI is explicitly instructed to
  return `"unknown"` for anything not present in the message, and all
  AI output is validated in code before entering the system
- **Live dashboard** — dark, modern UI with category filters, priority
  stats and auto-refresh
- **Webhook-based trigger** — the entry point accepts standard JSON
  payloads, so it can be connected to any real source (email, contact
  form, CRM, n8n/Make) without changing the core pipeline

## Tech stack

- **Backend:** Node.js, Express 5, TypeScript (strict mode, ESM)
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`, model `claude-sonnet-4-6`)
- **Storage:** in-memory + JSON file persistence (easily swappable for a database)
- **Frontend:** vanilla HTML/CSS/JS dashboard served by the same Express app

## Architecture

```
                     ┌─────────────────────────────────────────┐
                     │              Express server             │
                     │                                         │
 incoming message →  │  POST /api/messages                     │
 (webhook payload)   │    ├─ validation (cheap checks first)   │
                     │    ├─ ai.ts → Claude → structured JSON  │
                     │    │         (validated, typed)         │
                     │    └─ store.ts → memory + JSON file     │
                     │                                         │
 dashboard        ←  │  GET /api/messages                      │
 (auto-refresh)      │  GET /  (static dashboard from /public) │
                     └─────────────────────────────────────────┘
```

Each part is an isolated module with a small interface: the trigger doesn't
know about the AI, the AI doesn't know about storage, storage doesn't know
about the dashboard. Any piece can be replaced independently — e.g. swapping
the simulated trigger for a real Gmail integration touches zero lines of the
processing pipeline.

## Getting started

### Prerequisites

- Node.js 20+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys))

### Setup

```bash
git clone <this-repo>
cd smart-inbox-assistant
npm install
cp .env.example .env    # then put your API key into .env
npm run dev
```

The dashboard is now at **http://localhost:3000**.

### Try it

Send a batch of realistic sample messages (keep the dashboard open
and watch them appear):

```bash
npm run seed
```

Or send a single message manually:

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"from": "jane@example.com", "subject": "Broken item", "body": "My order #123 arrived damaged. Please advise. Jane, +1 555 0100"}'
```

PowerShell equivalent:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/messages" -Method Post -ContentType "application/json" -Body '{"from": "jane@example.com", "subject": "Broken item", "body": "My order #123 arrived damaged. Please advise. Jane, +1 555 0100"}'
```

## Adapting this for your business

The system is intentionally easy to customize:

- **Categories & priorities** — edit one array in `src/types.ts`
  (e.g. add "Warranty claim" or "Partnership inquiry"); the AI prompt,
  validation and dashboard filters follow automatically
- **Extracted fields** — extend the JSON schema in `src/ai.ts`
  (e.g. order number, language, sentiment)
- **Real triggers** — point your email service, contact form or
  n8n/Make workflow at `POST /api/messages`
- **Actions** — the processing result is a typed object; adding
  a Slack notification for High-priority messages or an auto-reply
  is a few lines in the endpoint handler

## Possible upgrades

- Real email integration (Gmail API / IMAP)
- Database storage (PostgreSQL / SQLite) for production volumes
- WebSockets / Server-Sent Events instead of polling
- Auto-drafted reply suggestions for each message
- Deployment (Render / Railway) with a public demo URL

- **Real email trigger (optional)** — the server can watch a Gmail
  mailbox via IMAP and process every incoming email automatically

### Optional: real email trigger

1. Enable 2-Step Verification on the Gmail account
2. Create an App Password (Google Account → Security → App passwords)
3. Fill in the `IMAP_*` variables in `.env` (see `.env.example`)
4. Restart the server — incoming emails now appear on the dashboard
   within ~30 seconds