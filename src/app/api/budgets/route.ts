import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { budgets, categories, loans, amortisationSchedule, investments, savings, annualExpenses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";

// GET /api/budgets?month=2026-04
// Returns all categories (excl. income) with their budget amounts for the given month.
// Loan principal/interest categories are auto-populated from the amortisation schedule.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");

    // Build a map of loan category → scheduled amount for this month
    const allLoans = await db.select().from(loans);
    const loanAmountMap = new Map<number, number>(); // categoryId → amount

    for (const loan of allLoans) {
      const [row] = await db.select()
        .from(amortisationSchedule)
        .where(and(
          eq(amortisationSchedule.loanId, loan.id),
          eq(amortisationSchedule.month, month),
        ));
      if (row) {
        if (loan.principalCategoryId) loanAmountMap.set(loan.principalCategoryId, row.principal);
        if (loan.interestCategoryId)  loanAmountMap.set(loan.interestCategoryId,  row.interest);
      }
    }

    // Sum active SIP + savings monthly amounts per categoryId
    const activeInvestments = await db.select({
      categoryId: investments.categoryId,
      monthlyAmount: investments.monthlyAmount,
    }).from(investments).where(eq(investments.isFrozen, false));

    const activeSavings = await db.select({
      categoryId: savings.categoryId,
      monthlyAmount: savings.monthlyAmount,
    }).from(savings).where(eq(savings.isActive, true));

    const sipAmountMap = new Map<number, number>();
    for (const row of [...activeInvestments, ...activeSavings]) {
      if (!row.categoryId) continue;
      sipAmountMap.set(row.categoryId, (sipAmountMap.get(row.categoryId) ?? 0) + row.monthlyAmount);
    }

    // Annual expenses due this month → auto-populate their category budget
    const dueThisMonth = await db.select().from(annualExpenses)
      .where(eq(annualExpenses.dueMonth, month));
    const annualAmountMap = new Map<number, number>();
    for (const ae of dueThisMonth) {
      if (ae.categoryId) annualAmountMap.set(ae.categoryId, (annualAmountMap.get(ae.categoryId) ?? 0) + ae.budgetedAmount);
    }

    const allCategories = await db.select().from(categories).orderBy(categories.tier, categories.name);
    const monthBudgets = await db.select().from(budgets).where(eq(budgets.month, month));
    const budgetMap = new Map(monthBudgets.map(b => [b.categoryId, b]));

    const result = allCategories
      .filter(cat => cat.tier !== "income" && !cat.excludeFromBudget)
      .map(cat => {
        const fromSchedule = loanAmountMap.get(cat.id);
        const fromSIPs     = sipAmountMap.get(cat.id);
        const fromAnnual   = annualAmountMap.get(cat.id);
        const autoAmount   = fromSchedule !== undefined ? fromSchedule
          : fromSIPs    !== undefined ? fromSIPs
          : fromAnnual  !== undefined ? fromAnnual
          : undefined;
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          tier: cat.tier,
          color: cat.color,
          budgetId: budgetMap.get(cat.id)?.id ?? null,
          amount: autoAmount !== undefined ? autoAmount : (budgetMap.get(cat.id)?.amount ?? 0),
          autoFromSchedule: fromSchedule !== undefined,
          autoFromSIPs:     fromSIPs     !== undefined,
          autoFromAnnual:   fromAnnual   !== undefined,
        };
      });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[budgets GET]", err);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

// POST /api/budgets — upsert a single category budget for a month
// Body: { categoryId, month, amount }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { categoryId: number; month: string; amount: number };

    const existing = await db.select().from(budgets)
      .where(and(eq(budgets.categoryId, body.categoryId), eq(budgets.month, body.month)));

    if (existing.length > 0) {
      const [updated] = await db.update(budgets)
        .set({ amount: body.amount, updatedAt: new Date().toISOString() })
        .where(and(eq(budgets.categoryId, body.categoryId), eq(budgets.month, body.month)))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db.insert(budgets)
      .values({ categoryId: body.categoryId, month: body.month, amount: body.amount })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[budgets POST]", err);
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}

// PUT /api/budgets?action=copy&from=2026-03&to=2026-04
// Copies all budget entries from one month to another
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

    const sourceBudgets = await db.select().from(budgets).where(eq(budgets.month, from));
    if (sourceBudgets.length === 0) {
      return NextResponse.json({ error: `No budgets found for ${from}` }, { status: 404 });
    }

    // Delete existing target month budgets then re-insert from source
    await db.delete(budgets).where(eq(budgets.month, to));
    for (const b of sourceBudgets) {
      await db.insert(budgets).values({ categoryId: b.categoryId, month: to, amount: b.amount });
    }

    return NextResponse.json({ ok: true, copied: sourceBudgets.length });
  } catch (err) {
    console.error("[budgets PUT]", err);
    return NextResponse.json({ error: "Failed to copy budgets" }, { status: 500 });
  }
}
