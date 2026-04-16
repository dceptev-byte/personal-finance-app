# Agent Rules — Personal Finance App

Read CLAUDE.md for full project context. The rules below are hard constraints — never violate them.

## Next.js
- NEVER switch to Turbopack. The dev script must stay `next dev --webpack`. Turbopack silently breaks all API routes.
- NEVER use `next/image` default loader — this app runs fully local with no Vercel/CDN.
- Always use App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`). No Pages Router.
- API route params are `Promise<{ id: string }>` — always `await params` before destructuring.

## Database
- ALWAYS use `npx drizzle-kit push` to apply schema changes. Never generate migration files manually.
- NEVER delete or truncate `categories` or `categoryMappings` — these are the user's learned data.
- SQLite has no `onConflictDoUpdate` support without an explicit unique index on the target columns. Use explicit check-then-insert/update instead.

## Styling & Charts
- NEVER use CSS custom properties (`hsl(var(--foreground))`) in SVG attributes (`stroke`, `fill`, `stopColor`). SVG doesn't resolve CSS vars. Use hardcoded hex values instead.
- Recharts `ResponsiveContainer` must have a fixed pixel `height` (e.g. `height={192}`) when inside a flex container. `height="100%"` causes zero-height rendering.

## AI / Ollama
- NEVER run AI categorisation during CSV import — it takes 10+ minutes for a full statement (22 batches × ~30s). Import uses learned mappings only.
- AI is available on-demand via the chat widget (`/api/ai/chat`). Keep it that way.
- Ollama streams via `ReadableStream` with `text/plain` content type — not JSON.

## Imports & Splits
- Import deduplication is on `(date, description, amount)` — never remove this check.
- Split processing must run on BOTH newly inserted rows AND existing rows in the same months (handles re-import after a child was deleted).
- Keyword matching uses 3 strategies in order: direct substring → extracted keyword → token-based. Never simplify to just one strategy.

## Security
- The Vault uses AES-256-GCM. Never log or expose `VAULT_SECRET`. Never store vault entries unencrypted.
- Never commit `finance.db` or `.env.local` — both are gitignored.
