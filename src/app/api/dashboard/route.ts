import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, budgets, categories, investments, subscriptions, ltgsTracker, loans, amortisationSchedule, savings, annualExpenses } from "@/db/schema";
import { eq, and, sum, gte, ne, isNotNull } from "drizzle-orm";
import { format } from "date-fns";
import { getFY, getFYProgress, getFYMonths } from "@/lib/fy";

export async function GET() {
  try {
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");

    // ── Auto-amount maps (mirrors budget API logic) ──────────────────────
    // Loan amortisation schedule
    const allLoans = await db.select().from(loans);
    const loanAmountMap = new Map<number, number>();
    for (const loan of allLoans) {
      const [row] = await db.select().from(amortisationSchedule)
        .where(and(eq(amortisationSchedule.loanId, loan.id), eq(amortisationSchedule.month, currentMonth)));
      if (row) {
        if (loan.principalCategoryId) loanAmountMap.set(loan.principalCategoryId, row.principal);
        if (loan.interestCategoryId)  loanAmountMap.set(loan.interestCategoryId,  row.interest);
      }
    }

    // Active SIPs + savings monthly amounts (for budget auto-population)
    const budgetSIPs = await db.select({ categoryId: investments.categoryId, monthlyAmount: investments.monthlyAmount })
      .from(investments).where(eq(investments.isFrozen, false));
    const budgetSavings = await db.select({ categoryId: savings.categoryId, monthlyAmount: savings.monthlyAmount })
      .from(savings).where(eq(savings.isActive, true));
    const sipAmountMap = new Map<number, number>();
    for (const row of [...budgetSIPs, ...budgetSavings]) {
      if (!row.categoryId) continue;
      sipAmountMap.set(row.categoryId, (sipAmountMap.get(row.categoryId) ?? 0) + row.monthlyAmount);
    }

    // Annual expenses due this month
    const dueThisMonth = await db.select().from(annualExpenses).where(eq(annualExpenses.dueMonth, currentMonth));
    const annualAmountMap = new Map<number, number>();
    for (const ae of dueThisMonth) {
      if (ae.categoryId) annualAmountMap.set(ae.categoryId, (annualAmountMap.get(ae.categoryId) ?? 0) + ae.budgetedAmount);
    }

    // ── Budget vs actual for current month ──────────────────────────────
    const allCategories = await db.select().from(categories);
    const monthBudgets = await db.select().from(budgets).where(eq(budgets.month, currentMonth));
    const budgetMap = new Map(monthBudgets.map(b => [b.categoryId, b.amount]));

    const spendData = await db
      .select({
        categoryId: transactions.categoryId,
        spent: sum(transactions.amount).as("spent"),
      })
      .from(transactions)
      .where(and(
        eq(transactions.month, currentMonth),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.categoryId);

    const spentMap: Record<number, number> = {};
    for (const row of spendData) {
      if (row.categoryId) spentMap[row.categoryId] = Number(row.spent ?? 0);
    }

    // Resolve budget amount for each category using same priority as budget API
    const budgetPacing = allCategories
      .filter(cat => cat.tier !== "income" && !cat.excludeFromBudget)
      .map(cat => {
        const fromSchedule = loanAmountMap.get(cat.id);
        const fromSIPs     = sipAmountMap.get(cat.id);
        const fromAnnual   = annualAmountMap.get(cat.id);
        const budgetAmount = fromSchedule !== undefined ? fromSchedule
          : fromSIPs   !== undefined ? fromSIPs
          : fromAnnual !== undefined ? fromAnnual
          : (budgetMap.get(cat.id) ?? 0);
        return { categoryId: cat.id, category: cat.name, color: cat.color, tier: cat.tier, budget: budgetAmount, spent: spentMap[cat.id] ?? 0 };
      })
      .filter(b => b.budget > 0)
      .map(b => ({
        ...b,
        pct: Math.round((b.spent / b.budget) * 100),
      }))
      .sort((a, b) => b.pct - a.pct);

    const totalBudget = budgetPacing.reduce((s, b) => s + b.budget, 0);

    // Exclude income-tier categories from "spent this month" — income is money in, not out
    const incomeCategoryIds = new Set(allCategories.filter(c => c.tier === "income").map(c => c.id));
    const totalSpent = Object.entries(spentMap)
      .filter(([id]) => !incomeCategoryIds.has(Number(id)))
      .reduce((s, [, v]) => s + v, 0);

    // ── Savings rate ────────────────────────────────────────────────────
    // income tier actual vs investment tier actual → savings rate = invest / income
    const investItems  = budgetPacing.filter(b => b.tier === "investment");
    const incomeActual = allCategories
      .filter(c => c.tier === "income")
      .reduce((s, c) => s + (spentMap[c.id] ?? 0), 0);
    const investActual = investItems.reduce((s, b) => s + b.spent, 0);
    const savingsRate  = incomeActual > 0 ? Math.round((investActual / incomeActual) * 100) : null;

    // ── Monthly totals for last 6 months ────────────────────────────────
    const monthlyTotals = await db
      .select({
        month: transactions.month,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .where(and(
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.month)
      .orderBy(transactions.month);

    // ── SIP summary ──────────────────────────────────────────────────────
    const sipData = await db.select().from(investments);
    const activeSIPs = sipData.filter(i => !i.isFrozen);
    const totalSIP = activeSIPs.reduce((s, i) => s + i.monthlyAmount, 0);

    const today = now.getDate();

    // SIPs due this month: sipDate <= today already ran, sipDate > today still pending
    const sipStatus = activeSIPs
      .filter(i => i.sipDate !== null)
      .map(i => ({
        name: i.fundName,
        amount: i.monthlyAmount,
        sipDate: i.sipDate!,
        executed: i.sipDate! <= today,
        daysAway: i.sipDate! >= today ? i.sipDate! - today : 30 - today + i.sipDate!,
      }))
      .sort((a, b) => a.sipDate - b.sipDate);

    const nextSIP = sipStatus.find(s => !s.executed) ?? sipStatus[0] ?? null;

    // ── Subscription burn ────────────────────────────────────────────────
    const subData = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.isActive, true));
    const totalSubMonthly = subData.reduce(
      (s, sub) => s + (sub.billingCycle === "monthly" ? sub.monthlyAmount : sub.yearlyAmount / 12),
      0
    );

    // ── LTGS ─────────────────────────────────────────────────────────────
    const ltgs = await db.select().from(ltgsTracker).limit(1);
    const ltgsData = ltgs[0] ?? null;

    // ── FY progress ──────────────────────────────────────────────────────
    const fyMonths = getFYMonths(now);
    const fyMonthsElapsed = fyMonths.filter(m => m <= currentMonth).length;

    // FY income & investment totals (from transaction actuals across FY months so far)
    const fyFirstMonth = fyMonths[0];
    const fySpendData = await db
      .select({
        categoryId: transactions.categoryId,
        tier: categories.tier,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        gte(transactions.month, fyFirstMonth),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.categoryId, categories.tier);

    const fyIncome = fySpendData.filter(r => r.tier === "income").reduce((s, r) => s + Number(r.total ?? 0), 0);
    const fyInvest = fySpendData.filter(r => r.tier === "investment").reduce((s, r) => s + Number(r.total ?? 0), 0);
    const fySavingsRate = fyIncome > 0 ? Math.round((fyInvest / fyIncome) * 100) : null;

    // ── Days remaining in month ──────────────────────────────────────────
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const monthProgress = Math.round((now.getDate() / daysInMonth) * 100);

    return NextResponse.json({
      currentMonth,
      monthProgress,
      daysRemaining,
      budgetPacing,
      totalBudget,
      totalSpent,
      savingsRate,
      fy: {
        label: getFY(now),
        progress: getFYProgress(now),
        monthsElapsed: fyMonthsElapsed,
        income: fyIncome,
        invested: fyInvest,
        savingsRate: fySavingsRate,
      },
      monthlyTotals: monthlyTotals.map((m) => ({
        month: m.month,
        total: Number(m.total ?? 0),
      })),
      sip: {
        total: totalSIP,
        nextSIP,
        sipStatus,
        funds: sipData,
      },
      subscriptions: {
        total: totalSubMonthly,
        count: subData.length,
        items: subData,
      },
      ltgs: ltgsData
        ? {
            remaining: ltgsData.exemptionLimit - ltgsData.used,
            used: ltgsData.used,
            limit: ltgsData.exemptionLimit,
            financialYear: ltgsData.financialYear,
          }
        : null,
    });
  } catch (err) {
    console.error("[dashboard/route]", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
