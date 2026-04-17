@AGENTS.md

# Personal Finance App — Context for Claude

## What this is
A fully local, AI-first personal finance web app replacing a Google Sheet ("Budget Pacing").
Built for a single user (Vimal Eapen, Axis Bank India).

## Stack
- **Next.js 16.2.3** — MUST run with `npm run dev` (uses `--webpack` flag; Turbopack breaks API routes)
- **SQLite** via `better-sqlite3` + **Drizzle ORM** (`drizzle-kit push` for schema changes, no migrations needed)
- **Tailwind CSS v4** + **shadcn/ui** components
- **Ollama** local LLM at `localhost:11434`, model `gemma4:e4b` — streaming AI chat
- **AES-256-GCM** encryption for Vault entries (`src/lib/crypto.ts`)
- Database file: `finance.db` in project root (gitignored)

## Running the app
```bash
npm run dev        # starts on localhost:3000
```
If the server isn't running, start it in the background and check `/tmp/nextjs.log`.

## Key architectural decisions
1. **No Turbopack** — `"dev": "next dev --webpack"` in package.json. Never change this.
2. **Recharts SVG colors** — must use hardcoded hex values (e.g. `#a5b4fc`), NOT CSS custom properties like `hsl(var(--foreground))` — SVG attributes don't resolve CSS vars.
3. **AI categorisation on import is disabled** — too slow (22 batches × ~30s). Only learned mappings are used at import time. AI is available on-demand via the chat widget.
4. **Two-pass categorisation**: learned `categoryMappings` table first (instant), then AI on-demand.
5. **Import deduplication** on `(date, description, amount)` — re-uploading same CSV is safe.
6. **Split children** are recreated on re-import if deleted — import re-processes existing parents too.

## Database schema (key tables)
- `transactions` — core table; has `isSplit`, `parentId`, `splitLabel` for split children
- `imports` — tracks CSV uploads
- `categories` — has `tier` field: "income" | "fixed" | "investment" | "discretionary"
- `budgets` — monthly budget per category (`categoryId`, `month` yyyy-MM, `amount`)
- `categoryMappings` — keyword → categoryId, grows as user verifies transactions (auto-learned)
- `loans` + `amortisation_schedule` — EMI split logic; match keyword → look up principal/interest by month
- `split_rules` + `split_rule_items` — fixed amount splits (e.g. ₹65,006 → Parents ₹15k + Savings ₹50k + remainder)
- `investments`, `annualExpenses`, `subscriptions`, `taxDeductions`, `vaultEntries`
- `assets` + `net_worth_snapshots` — net worth tracking (assets by type, monthly snapshots)

## CSV Import (Axis Bank format)
- Axis Bank has ~10 metadata rows before real headers (`Tran Date, PARTICULARS, DR, CR, BAL`)
- Parser scans forward to find the header row
- After insert: checks each transaction against loan keywords and split rules, creates children automatically
- Keyword matching uses 3 strategies: direct substring, extracted keyword, token-based (handles format differences)

## Keyword extraction (`src/lib/keywords.ts`)
`extractKeyword(description)` — strips UPI prefixes, IFSC codes, bank names, long numbers → returns first 4 meaningful words lowercase. Used for auto-categorisation learning.

## Split processing (in import route)
1. Load all loans + active split rules
2. For each imported transaction, `matchesKeyword(description, storedKeyword)` — 3-strategy match
3. Loan match → look up `amortisation_schedule` for that `loanId + month` → create Principal + Interest children
4. Split rule match → iterate `split_rule_items` in order; `fixedAmount=null` = remainder

## Pages
| Route | Description |
|-------|-------------|
| `/dashboard` | 3-tier cash flow (Income/Fixed/Investments/Discretionary), FY progress, savings rate, anomaly alerts, SIP execution status |
| `/expenses` | Transaction list with CSV import, categorisation, split expansion, verify-all |
| `/investments` | SIP portfolio with projection chart (editable via modal) |
| `/tax` | 80C investment tracker (auto from transactions), tax deductions, LTGS |
| `/vault` | AES-256-GCM encrypted notes/credentials |
| `/splits` | Loan amortisation tables + fixed split rules |
| `/net-worth` | Assets by type, liabilities from loan balances, monthly snapshots |
| `/admin` | Monthly budget editor (per-category, by tier, copy-from-prev), DB/Ollama/Backup status |

## Key utilities
- `src/lib/fy.ts` — Indian FY helpers (April–March): `getFY()`, `getFYProgress()`, `getFYMonths()`, `getFYStart()`
- `src/app/api/budgets/route.ts` — GET/POST/PUT budget CRUD with copy-month
- `src/app/api/anomalies/route.ts` — 6-month median analysis, flags >2× median spend
- `src/app/api/net-worth/route.ts` — assets CRUD + liability from loan schedules

## AI Chat Widget
- Floating Sparkles FAB bottom-right, available on all pages
- Streams tokens via `ReadableStream` from `/api/ai/chat`
- Connects to local Ollama — requires Ollama running at `localhost:11434`

## Pending / known todos
- Merge categorise + verify into single click on expense rows
- Auto-advance to next uncategorised row after picking category
- Verification progress bar (e.g. "312 / 435 verified")
- The ₹10K `UPI/P2M/.../LIC HFL/...` transaction is a top-up payment toward the LIC EMI; user handles manually
- Anomaly detection: LLM explanation for flagged categories (future — add to anomalies API)
- Net worth: investment portfolio value auto-sync from investments table `currentValue` field

## Git
- Remote: `https://github.com/dceptev-byte/personal-finance-app.git`
- Branch: `main`
- Auth: `gh auth setup-git` already configured — push works without prompts
