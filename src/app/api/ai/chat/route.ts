import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  transactions, budgets, categories, investments, taxDeductions, ltgsTracker,
  savings, subscriptions, assets, loans, amortisationSchedule,
} from "@/db/schema";
import { eq, and, sum, gte, ne, isNotNull, desc } from "drizzle-orm";
import { ollamaChatStream, OllamaMessage } from "@/lib/ollama";
import { format, subMonths } from "date-fns";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: OllamaMessage[] };

    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    // ── Fetch all context in parallel ────────────────────────────────────────
    const [
      spendData, budgetData, sipData, taxData, ltgsData,
      savingsData, subData, allAssets, allLoans,
    ] = await Promise.all([
      db.select({ category: categories.name, tier: categories.tier, spent: sum(transactions.amount) })
        .from(transactions).leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(eq(transactions.month, currentMonth)).groupBy(transactions.categoryId),
      db.select({ category: categories.name, budget: budgets.amount })
        .from(budgets).innerJoin(categories, eq(budgets.categoryId, categories.id))
        .where(eq(budgets.month, currentMonth)),
      db.select().from(investments),
      db.select().from(taxDeductions),
      db.select().from(ltgsTracker),
      db.select().from(savings).where(eq(savings.isActive, true)),
      db.select().from(subscriptions).where(eq(subscriptions.isActive, true)),
      db.select().from(assets),
      db.select().from(loans),
    ]);

    // ── Net worth ─────────────────────────────────────────────────────────────
    const sipPortfolioValue = sipData.reduce((s, i) => s + (i.currentValue ?? 0), 0);
    const totalAssets = allAssets.reduce((s, a) => s + a.currentValue, 0) + sipPortfolioValue;
    let totalLiabilities = 0;
    for (const loan of allLoans) {
      const [schedule] = await db.select({ balance: amortisationSchedule.balance })
        .from(amortisationSchedule)
        .where(eq(amortisationSchedule.loanId, loan.id))
        .orderBy(desc(amortisationSchedule.month))
        .limit(1);
      if (schedule?.balance) totalLiabilities += schedule.balance;
    }
    const netWorth = totalAssets - totalLiabilities;

    // ── Anomalies (last 6 months vs current) ─────────────────────────────────
    const windowMonths: string[] = [];
    for (let i = 1; i <= 6; i++) windowMonths.push(format(subMonths(now, i), "yyyy-MM"));
    const windowStart = windowMonths[windowMonths.length - 1];

    const anomalyRows = await db
      .select({
        month: transactions.month,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        gte(transactions.month, windowStart),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
        ne(categories.tier, "income"),
      ))
      .groupBy(transactions.month, transactions.categoryId, categories.name);

    const byCat = new Map<number, { name: string; months: Map<string, number> }>();
    for (const row of anomalyRows) {
      if (!row.categoryId) continue;
      if (!byCat.has(row.categoryId)) byCat.set(row.categoryId, { name: row.categoryName, months: new Map() });
      byCat.get(row.categoryId)!.months.set(row.month, Number(row.total ?? 0));
    }

    const anomalyLines: string[] = [];
    for (const [, catData] of byCat) {
      const currentSpend = catData.months.get(currentMonth) ?? 0;
      if (currentSpend === 0) continue;
      const history = windowMonths.map(m => catData.months.get(m) ?? 0).filter(v => v > 0);
      if (history.length < 2) continue;
      const med = median(history);
      if (med === 0) continue;
      const ratio = currentSpend / med;
      if (ratio >= 2 && currentSpend > 500) {
        anomalyLines.push(`${catData.name}: ₹${Math.round(currentSpend)} this month vs ₹${Math.round(med)} median (${Math.round(ratio * 10) / 10}× usual)`);
      }
    }

    // ── Format context lines ──────────────────────────────────────────────────
    const budgetLines = budgetData.map(b => {
      const spent = spendData.find(s => s.category === b.category);
      const spentAmt = Number(spent?.spent ?? 0);
      return `${b.category}: budget ₹${b.budget}, spent ₹${spentAmt}, remaining ₹${b.budget - spentAmt}`;
    }).join("\n");

    const incomeThisMonth = spendData.filter(s => s.tier === "income").reduce((sum, s) => sum + Number(s.spent ?? 0), 0);

    const sipLines = sipData
      .map(s => `${s.fundName}: ₹${s.monthlyAmount}/mo${s.currentValue ? `, current value ₹${s.currentValue}` : ""}${s.isFrozen ? " [FROZEN]" : ""}`)
      .join("\n");

    const savingsLines = savingsData
      .map(s => `${s.name} (${s.type}): ₹${s.monthlyAmount}/mo${s.interestRate ? ` @ ${s.interestRate}%` : ""}${s.tenureMonths ? `, ${s.tenureMonths}mo tenure` : ""}`)
      .join("\n");

    const subLines = subData
      .map(s => `${s.name}: ₹${s.billingCycle === "monthly" ? s.monthlyAmount + "/mo" : s.yearlyAmount + "/yr"} (${s.billingCycle})`)
      .join("\n");

    const taxLines = taxData.map(t => `${t.section}: limit ₹${t.limit}, used ₹${t.used}, remaining ₹${t.limit - t.used}`).join("\n");
    const ltgs = ltgsData[0];

    const systemPrompt = `You are Pacey, a smart personal finance AI assistant for Vimal Eapen. You run locally on the user's device via Ollama — you are not a cloud service. You have full access to the user's financial data.
Today: ${format(now, "d MMMM yyyy")}. Days remaining in month: ${daysRemaining}/${daysInMonth}.

INCOME THIS MONTH: ₹${Math.round(incomeThisMonth)}

BUDGET vs ACTUAL (${currentMonth}):
${budgetLines || "No budget data yet."}

INVESTMENTS (SIPs):
${sipLines || "None."}

SAVINGS (FDs / recurring):
${savingsLines || "None."}

SUBSCRIPTIONS:
${subLines || "None."}
Total subscription burn: ₹${Math.round(subData.reduce((s, sub) => s + (sub.billingCycle === "monthly" ? sub.monthlyAmount : sub.yearlyAmount / 12), 0))}/mo

NET WORTH:
Assets: ₹${Math.round(totalAssets)} | Liabilities (home loan): ₹${Math.round(totalLiabilities)} | Net Worth: ₹${Math.round(netWorth)}

TAX DEDUCTIONS (FY current):
${taxLines || "None."}

LTGS: ₹${ltgs?.used ?? 0} used of ₹${ltgs?.exemptionLimit ?? 100000} exemption (₹${(ltgs?.exemptionLimit ?? 100000) - (ltgs?.used ?? 0)} remaining)

${anomalyLines.length > 0 ? `SPENDING ANOMALIES (>2× usual this month):\n${anomalyLines.join("\n")}` : "No spending anomalies detected this month."}

Rules:
- Be concise and direct. Use ₹ for amounts. Format large amounts as L (lakhs) or Cr (crores).
- For scenario questions, give a clear verdict first then explain.
- For anomalies, explain what drove the spike if context allows, and suggest whether to act.
- For projections, show key numbers clearly.
- Never make up data not in the context above.
- Keep responses under 200 words unless detail is explicitly requested.`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of ollamaChatStream([
            { role: "system", content: systemPrompt },
            ...messages,
          ])) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`\n[Error: ${String(err)}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[ai/chat]", err);
    return new Response(JSON.stringify({ error: "AI request failed. Is Ollama running?" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
