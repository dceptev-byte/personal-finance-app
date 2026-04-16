import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, imports, categories, categoryMappings, loans, amortisationSchedule, splitRules, splitRuleItems } from "@/db/schema";
import { ollamaChat } from "@/lib/ollama";
import { extractKeyword } from "@/lib/keywords";
import { format } from "date-fns";
import { eq, and, inArray } from "drizzle-orm";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

/** Parse a single CSV line, respecting quoted fields that may contain commas */
function splitCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** Normalise various date formats → yyyy-MM-dd */
function normaliseDate(raw: string): string {
  // dd/mm/yyyy or dd-mm-yyyy
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(/[\/\-]/);
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // dd/mm/yy or dd-mm-yy
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/.test(raw)) {
    const [d, m, y] = raw.split(/[\/\-]/);
    return `20${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw;
}

function parseCSV(text: string): ParsedRow[] {
  // Normalize line endings, drop empty lines
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length < 2) return [];

  // Scan forward to find the actual header row (the first row containing
  // recognisable financial column keywords). Banks like HDFC prepend 10-15
  // rows of account metadata before the real headers.
  let headerIdx = -1;
  let dateIdx = -1, descIdx = -1, debitIdx = -1, creditIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]).map(c => c.toLowerCase());
    // Date: exact "date", or ends with "date" (e.g. "tran date", "value date"),
    // but exclude "value date" / "value dt" which is settlement date not txn date
    const di = cols.findIndex(c =>
      c === "date" || c === "tran date" || c === "transaction date" ||
      c === "txn date" || c === "trans date" || c === "posting date"
    );
    const ni = cols.findIndex(c =>
      c.includes("narration") || c.includes("description") ||
      c.includes("particular") || c.includes("details") || c.includes("remarks") ||
      c === "chq / ref no." || c === "transaction remarks"
    );
    const dbi = cols.findIndex(c =>
      c === "debit amount" || c === "debit" || c === "withdrawal amt" ||
      c === "withdrawal" || c === "dr amount" || c === "dr" || c === "debit(inr)"
    );
    // Also match generic "amount" only if there's no debit column
    const ami = cols.findIndex(c => c === "amount" || c === "transaction amount");
    const cri = cols.findIndex(c =>
      c === "credit amount" || c === "credit" || c === "deposit amt" ||
      c === "deposit" || c === "cr amount" || c === "cr" || c === "credit(inr)"
    );

    if (di !== -1 && ni !== -1 && (dbi !== -1 || ami !== -1)) {
      headerIdx = i;
      dateIdx = di;
      descIdx = ni;
      debitIdx = dbi !== -1 ? dbi : ami;
      creditIdx = cri;
      break;
    }
  }

  if (headerIdx === -1) {
    const sample = splitCSVLine(lines[0]).map(c => c.toLowerCase()).join(", ");
    throw new Error(`Could not detect columns. Headers found: ${sample}`);
  }

  const rows: ParsedRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const rawDate = cols[dateIdx];
    const desc = cols[descIdx];

    // Skip summary/footer rows that don't look like dates
    if (!rawDate || !desc) continue;
    if (!/\d/.test(rawDate)) continue;

    // For debit-only column: use debit value
    // For split debit/credit: prefer debit, fall back to credit (deposits)
    let rawAmt = cols[debitIdx]?.replace(/[^0-9.]/g, "") ?? "";
    if ((!rawAmt || rawAmt === "0" || rawAmt === "") && creditIdx !== -1) {
      rawAmt = cols[creditIdx]?.replace(/[^0-9.]/g, "") ?? "";
    }

    if (!rawAmt) continue;
    const amount = parseFloat(rawAmt);
    if (isNaN(amount) || amount <= 0) continue;

    const date = normaliseDate(rawDate);
    rows.push({ date, description: desc, amount });
  }

  return rows;
}

// ── Pass 1: Learned mappings ─────────────────────────────────────────────────

async function applyLearnedMappings(
  rows: ParsedRow[]
): Promise<(number | null)[]> {
  const allMappings = await db.select().from(categoryMappings);
  const map = new Map(allMappings.map(m => [m.keyword, m.categoryId]));

  return rows.map(row => {
    const keyword = extractKeyword(row.description);
    // Exact match first
    if (map.has(keyword)) return map.get(keyword)!;
    // Partial match: check if any saved keyword is contained in this description's keyword
    for (const [savedKey, catId] of map) {
      if (keyword.includes(savedKey) || savedKey.includes(keyword)) return catId;
    }
    return null;
  });
}

// ── Pass 2: AI categorisation (batched) ──────────────────────────────────────

const BATCH_SIZE = 20;

async function aiCategoriseBatch(
  rows: ParsedRow[],
  catNames: string,
  categoryList: { id: number; name: string }[]
): Promise<(number | null)[]> {
  const lines = rows.map((r, i) => `${i}: ${r.description}`).join("\n");

  const prompt = `You are a transaction categoriser for an Indian personal finance app.
Categories: ${catNames}

Reply with ONLY a JSON array of exactly ${rows.length} items — one category name per transaction, null if none fit.
No prose. No explanation. Just the array.

Transactions:
${lines}`;

  try {
    const raw = await ollamaChat([{ role: "user", content: prompt }], { temperature: 0 });
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return rows.map(() => null);
    const names: (string | null)[] = JSON.parse(match[0]);
    return names.map(name => {
      if (!name) return null;
      const found = categoryList.find(c => c.name.toLowerCase() === name.toLowerCase().trim());
      return found?.id ?? null;
    });
  } catch {
    return rows.map(() => null);
  }
}

async function categoriseRows(
  rows: ParsedRow[],
  categoryList: { id: number; name: string }[]
): Promise<{ categoryIds: (number | null)[]; fromMappings: number; fromAI: number }> {
  // Pass 1: apply learned mappings instantly
  const mappingResults = await applyLearnedMappings(rows);

  // Pass 2: AI only for rows that mappings couldn't resolve
  const needsAI = rows.map((_, i) => mappingResults[i] === null);
  const aiRows = rows.filter((_, i) => needsAI[i]);

  const catNames = categoryList.map(c => c.name).join(", ");
  const aiResults: (number | null)[] = [];

  for (let i = 0; i < aiRows.length; i += BATCH_SIZE) {
    const chunk = aiRows.slice(i, i + BATCH_SIZE);
    const ids = await aiCategoriseBatch(chunk, catNames, categoryList);
    aiResults.push(...ids);
  }

  // Merge results back
  let aiIdx = 0;
  const categoryIds = rows.map((_, i) => {
    if (!needsAI[i]) return mappingResults[i];
    return aiResults[aiIdx++] ?? null;
  });

  return {
    categoryIds,
    fromMappings: mappingResults.filter(id => id !== null).length,
    fromAI: aiResults.filter(id => id !== null).length,
  };
}

// ── Route Handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const text = await file.text();
    let rows: ParsedRow[];
    try {
      rows = parseCSV(text);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 422 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid transactions found in file" }, { status: 422 });
    }

    // Get categories
    const categoryList = await db.select({ id: categories.id, name: categories.name }).from(categories);

    // Apply learned mappings only — instant, no AI during import
    // (AI re-categorisation is available on-demand via the Expenses page)
    const mappingResults = await applyLearnedMappings(rows);
    const categoryIds = mappingResults;
    const fromAI = 0;

    // Create import record
    const [importRecord] = await db
      .insert(imports)
      .values({ filename: file.name, rowCount: rows.length, status: "complete" })
      .returning();

    // Deduplicate: fetch existing transactions for all months in this import
    const importMonths = [...new Set(rows.map(r => r.date.slice(0, 7)))];
    const existing = await db.select({
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
    }).from(transactions).where(inArray(transactions.month, importMonths));

    // Build a Set of "date|description|amount" keys already in the DB
    const existingKeys = new Set(existing.map(t => `${t.date}|${t.description}|${t.amount}`));

    // Filter out rows that already exist
    const dedupedRows = rows.filter(r => !existingKeys.has(`${r.date}|${r.description}|${r.amount}`));
    const dedupedCategoryIds = dedupedRows.map(r => categoryIds[rows.indexOf(r)]);
    const skipped = rows.length - dedupedRows.length;
    const fromMappings = dedupedCategoryIds.filter(id => id !== null).length;

    if (dedupedRows.length === 0) {
      return NextResponse.json({
        importId: importRecord.id,
        rowCount: 0,
        skipped,
        latestMonth: importMonths[importMonths.length - 1],
        months: importMonths,
        categorised: { fromMappings: 0, fromAI: 0, uncategorised: 0 },
        message: "All transactions already exist — nothing new to import",
      });
    }

    // Insert only new transactions
    const toInsert = dedupedRows.map((row, i) => ({
      date: row.date,
      description: row.description,
      amount: row.amount,
      categoryId: dedupedCategoryIds[i],
      month: row.date.slice(0, 7),
      source: "import" as const,
      importId: importRecord.id,
      isVerified: false,
    }));

    const inserted = await db.insert(transactions).values(toInsert).returning();

    // ── Split processing ──────────────────────────────────────────────────────
    const allLoans = await db.select().from(loans);
    const allSplitRules = await db.select().from(splitRules).where(eq(splitRules.isActive, true));
    const allSplitItems = await db.select().from(splitRuleItems).orderBy(splitRuleItems.sortOrder);
    const allScheduleRows = await db.select().from(amortisationSchedule);

    // Match a transaction description against a stored keyword (3 strategies)
    function matchesKeyword(description: string, storedKeyword: string): boolean {
      const desc = description.toLowerCase();
      const kw = storedKeyword.toLowerCase();
      if (desc.includes(kw)) return true;
      const extracted = extractKeyword(description);
      if (extracted && kw.includes(extracted)) return true;
      const tokens = kw.split(/[\s\/\-_]+/).filter(t => t.length > 4);
      return tokens.length > 0 && tokens.some(t => desc.includes(t));
    }

    // Fetch existing children for all transactions in the imported months
    // so we can skip re-creating children that already exist
    const existingChildren = await db.select({
      parentId: transactions.parentId,
      splitLabel: transactions.splitLabel,
    }).from(transactions).where(inArray(transactions.month, importMonths));
    // Map parentId → set of existing splitLabels
    const childLabels = new Map<number, Set<string>>();
    for (const c of existingChildren) {
      if (c.parentId == null) continue;
      if (!childLabels.has(c.parentId)) childLabels.set(c.parentId, new Set());
      childLabels.get(c.parentId)!.add(c.splitLabel ?? "");
    }

    // Candidates = newly inserted rows PLUS existing top-level transactions in
    // the same months that match a loan/rule keyword (handles re-imports where
    // the parent was skipped by dedup but a child was deleted)
    const existingTopLevel = await db.select().from(transactions)
      .where(and(
        inArray(transactions.month, importMonths),
        eq(transactions.isVerified, false)  // only re-process unverified parents
      ));
    // Combine, dedup by id (inserted rows are already new; existing rows may overlap)
    const insertedIds = new Set(inserted.map(t => t.id));
    const candidates = [
      ...inserted,
      ...existingTopLevel.filter(t => !insertedIds.has(t.id) && t.parentId == null),
    ];

    for (const txn of candidates) {
      const existingLabels = childLabels.get(txn.id) ?? new Set();

      // ── Check loans ────────────────────────────────────────────────────────
      const matchedLoan = allLoans.find(loan => matchesKeyword(txn.description, loan.keyword));

      if (matchedLoan) {
        const scheduleRow = allScheduleRows.find(
          s => s.loanId === matchedLoan.id && s.month === txn.month
        );

        if (scheduleRow && (scheduleRow.principal > 0 || scheduleRow.interest > 0)) {
          if (scheduleRow.principal > 0 && !existingLabels.has("Principal")) {
            await db.insert(transactions).values({
              date: txn.date, description: txn.description,
              amount: scheduleRow.principal, categoryId: matchedLoan.principalCategoryId,
              month: txn.month, source: "import", importId: txn.importId,
              isVerified: false, parentId: txn.id, splitLabel: "Principal",
            });
          }
          if (scheduleRow.interest > 0 && !existingLabels.has("Interest")) {
            await db.insert(transactions).values({
              date: txn.date, description: txn.description,
              amount: scheduleRow.interest, categoryId: matchedLoan.interestCategoryId,
              month: txn.month, source: "import", importId: txn.importId,
              isVerified: false, parentId: txn.id, splitLabel: "Interest",
            });
          }
          await db.update(transactions).set({ isSplit: true }).where(eq(transactions.id, txn.id));
          continue;
        }
      }

      // ── Check fixed split rules ────────────────────────────────────────────
      const matchedRule = allSplitRules.find(rule => matchesKeyword(txn.description, rule.keyword));

      if (matchedRule) {
        const items = allSplitItems.filter(i => i.ruleId === matchedRule.id);
        if (items.length > 0) {
          let remaining = txn.amount;
          for (const item of items) {
            const amt = item.fixedAmount != null ? item.fixedAmount : remaining;
            if (amt <= 0) continue;
            const label = item.label ?? "";
            if (!existingLabels.has(label)) {
              await db.insert(transactions).values({
                date: txn.date, description: txn.description,
                amount: amt, categoryId: item.categoryId,
                month: txn.month, source: "import", importId: txn.importId,
                isVerified: false, parentId: txn.id, splitLabel: item.label ?? null,
              });
            }
            if (item.fixedAmount != null) remaining -= item.fixedAmount;
          }
          await db.update(transactions).set({ isSplit: true }).where(eq(transactions.id, txn.id));
        }
      }
    }
    // ── End split processing ──────────────────────────────────────────────────

    // Find most recent month in the import so the UI can jump to it
    const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort();
    const latestMonth = months[months.length - 1] ?? format(new Date(), "yyyy-MM");

    return NextResponse.json({
      importId: importRecord.id,
      rowCount: dedupedRows.length,
      skipped,
      latestMonth,
      months,
      categorised: { fromMappings, fromAI, uncategorised: dedupedRows.length - fromMappings - fromAI },
    });
  } catch (err) {
    console.error("[import POST]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
