# Personal Finance App

A fully local, AI-first personal finance web app built to replace a Google Sheet. Designed for a single user with an Axis Bank account (India).

All data stays on your machine — no cloud, no subscriptions.

## Features

- **Dashboard** — monthly spend summary, category breakdown, annual expenses, subscriptions
- **Expenses** — import Axis Bank CSV statements, auto-categorise with learned mappings, verify transactions
- **Investments** — SIP portfolio tracker with future value projection chart
- **Tax** — deductions tracker with inline editing (80C, 80D, HRA, etc.)
- **Vault** — AES-256-GCM encrypted notes for credentials and sensitive info
- **Splits** — loan EMI amortisation tables (Principal + Interest auto-split on import) and fixed split rules (e.g. a transfer → Parents + Savings + remainder)
- **AI Chat** — floating chat widget powered by a local Ollama LLM (no data leaves your machine)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Webpack) |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| UI | Tailwind CSS v4 + shadcn/ui |
| AI | Ollama (`gemma4:e4b`) at `localhost:11434` |
| Encryption | AES-256-GCM (Node.js crypto) |

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.ai) running locally with `gemma4:e4b` pulled (for AI chat)

## Getting Started

```bash
# Install dependencies
npm install

# Push the database schema
npx drizzle-kit push

# Seed categories
npx tsx scripts/add-categories.ts

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** Always use `npm run dev` — the app is configured to use Webpack. Turbopack breaks API routes.

## CSV Import

Supports Axis Bank statement CSV format. Drop the file on the Expenses page. The importer:
1. Auto-detects the header row (skips bank metadata rows)
2. Applies learned category mappings instantly
3. Auto-splits EMI transactions using your amortisation schedule
4. Auto-splits fixed transfers using your split rules
5. Deduplicates — safe to re-import the same file

## Environment Variables

Create a `.env.local` file in the project root:

```env
ENCRYPTION_KEY=<64-char hex string — 32 random bytes as hex>
BACKUP_DEST="/Volumes/Your Drive/finance-backups"
```

Generate a key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ Store `ENCRYPTION_KEY` in a password manager. If lost, all Vault entries become unrecoverable. The app will crash on startup without it.

## Project Structure

```
src/
├── app/
│   ├── (app)/          # All main pages (dashboard, expenses, etc.)
│   └── api/            # API routes
├── components/
│   ├── layout/         # Sidebar, header
│   └── ui/             # shadcn/ui components
├── db/
│   └── schema.ts       # Full Drizzle schema
└── lib/
    ├── crypto.ts        # AES-256-GCM vault encryption
    ├── keywords.ts      # Transaction keyword extraction
    └── ollama.ts        # Local LLM client
```

## Backup

```bash
npx tsx scripts/backup.ts
```

Copies the SQLite database to a mounted backup destination defined in `.env.local`.
