import { NextRequest } from "next/server";
import { db } from "@/db";
import { transactions, budgets, categories, investments, taxDeductions, ltgsTracker } from "@/db/schema";
import { eq, sum } from "drizzle-orm";
import { ollamaChatStream, OllamaMessage } from "@/lib/ollama";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: OllamaMessage[] };

    const currentMonth = format(new Date(), "yyyy-MM");

    const [spendData, budgetData, sipData, taxData, ltgsData] = await Promise.all([
      db.select({ category: categories.name, spent: sum(transactions.amount) })
        .from(transactions).leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(eq(transactions.month, currentMonth)).groupBy(transactions.categoryId),
      db.select({ category: categories.name, budget: budgets.amount })
        .from(budgets).innerJoin(categories, eq(budgets.categoryId, categories.id))
        .where(eq(budgets.month, currentMonth)),
      db.select().from(investments),
      db.select().from(taxDeductions),
      db.select().from(ltgsTracker),
    ]);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    const budgetLines = budgetData.map(b => {
      const spent = spendData.find(s => s.category === b.category);
      return `${b.category}: budget ₹${b.budget}, spent ₹${Number(spent?.spent ?? 0)}, remaining ₹${b.budget - Number(spent?.spent ?? 0)}`;
    }).join("\n");

    const sipLines = sipData.map(s => `${s.type} (${s.fundName}): ₹${s.monthlyAmount}/mo, ${s.stepUpPercent}% step-up, SIP on ${s.sipDate}th${s.isFrozen ? " [FROZEN]" : ""}`).join("\n");
    const taxLines = taxData.map(t => `${t.section}: limit ₹${t.limit}, used ₹${t.used}`).join("\n");
    const ltgs = ltgsData[0];

    const systemPrompt = `You are a smart personal finance AI assistant. You have full access to the user's financial data.
Today: ${format(now, "d MMMM yyyy")}. Days remaining in month: ${daysRemaining}/${daysInMonth}.

BUDGET vs ACTUAL (${currentMonth}):
${budgetLines || "No budget data yet."}

INVESTMENTS (SIPs):
${sipLines}

TAX DEDUCTIONS (FY current):
${taxLines}

LTGS: ₹${ltgs?.used ?? 0} used of ₹${ltgs?.exemptionLimit ?? 100000} exemption (₹${(ltgs?.exemptionLimit ?? 100000) - (ltgs?.used ?? 0)} remaining)

Rules:
- Be concise and direct. Use ₹ for amounts.
- For scenario questions, give a clear verdict first then explain.
- For projections, show key numbers clearly.
- Never make up data not in the context above.
- Keep responses under 200 words unless detail is explicitly requested.`;

    // Stream tokens back as newline-delimited JSON chunks
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
