import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, budgets, categories } from "@/db/schema";
import { eq, sum } from "drizzle-orm";
import { ollamaChat } from "@/lib/ollama";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json() as { question: string };
    if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

    const currentMonth = format(new Date(), "yyyy-MM");

    // Gather current month budget vs actual
    const budgetData = await db
      .select({
        category: categories.name,
        budget: budgets.amount,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.month, currentMonth));

    const spendData = await db
      .select({
        categoryId: transactions.categoryId,
        category: categories.name,
        spent: sum(transactions.amount).as("spent"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.month, currentMonth))
      .groupBy(transactions.categoryId);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    // Build compact context
    const budgetMap: Record<string, number> = {};
    for (const b of budgetData) budgetMap[b.category] = b.budget;

    const spendMap: Record<string, number> = {};
    for (const s of spendData) spendMap[s.category] = Number(s.spent ?? 0);

    const budgetLines = Object.entries(budgetMap)
      .map(([cat, budget]) => {
        const spent = spendMap[cat] ?? 0;
        const remaining = budget - spent;
        return `${cat}: budget ₹${budget}, spent ₹${spent}, remaining ₹${remaining}`;
      })
      .join("\n");

    const totalBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
    const totalSpent = Object.values(spendMap).reduce((a, b) => a + b, 0);

    const systemPrompt = `You are a personal finance assistant. Answer scenario/what-if questions clearly and concisely.
Current month: ${currentMonth}. Days remaining: ${daysRemaining} of ${daysInMonth}.
Total budget: ₹${totalBudget}. Total spent so far: ₹${totalSpent}. Remaining: ₹${totalBudget - totalSpent}.

Budget vs actual breakdown:
${budgetLines}

Rules:
- Use ₹ symbol for amounts
- Be direct — give a clear verdict first, then explain
- Keep response under 150 words
- If the scenario is feasible, say so and show the impact
- If it would breach budget, show by how much and which category suffers`;

    const response = await ollamaChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ]);

    return NextResponse.json({ answer: response });
  } catch (err) {
    console.error("[scenario/route]", err);
    return NextResponse.json({ error: "Scenario analysis failed" }, { status: 500 });
  }
}
