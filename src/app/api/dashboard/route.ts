import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, budgets, categories, investments, subscriptions, ltgsTracker } from "@/db/schema";
import { eq, and, sum, sql, ne, isNotNull } from "drizzle-orm";
import { format } from "date-fns";

export async function GET() {
  try {
    const currentMonth = format(new Date(), "yyyy-MM");

    // ── Budget vs actual for current month ──────────────────────────────
    const budgetData = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        budgetAmount: budgets.amount,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.month, currentMonth));

    const spendData = await db
      .select({
        categoryId: transactions.categoryId,
        spent: sum(transactions.amount).as("spent"),
      })
      .from(transactions)
      .where(and(
        eq(transactions.month, currentMonth),
        ne(transactions.isSplit, true),   // exclude split parents (children carry the real amounts)
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.categoryId);

    const spentMap: Record<number, number> = {};
    for (const row of spendData) {
      if (row.categoryId) spentMap[row.categoryId] = Number(row.spent ?? 0);
    }

    const budgetPacing = budgetData
      .filter((b) => b.budgetAmount > 0)
      .map((b) => ({
        categoryId: b.categoryId,
        category: b.categoryName,
        color: b.categoryColor,
        budget: b.budgetAmount,
        spent: spentMap[b.categoryId] ?? 0,
        pct: Math.min(
          100,
          Math.round(((spentMap[b.categoryId] ?? 0) / b.budgetAmount) * 100)
        ),
      }))
      .sort((a, b) => b.pct - a.pct);

    const totalBudget = budgetPacing.reduce((s, b) => s + b.budget, 0);
    // totalSpent = ALL categorised non-split-parent transactions (not just budgeted categories)
    const totalSpent = Object.values(spentMap).reduce((s, v) => s + v, 0);

    // ── Monthly totals for last 6 months (for sparkline) ────────────────
    const monthlyTotals = await db
      .select({
        month: transactions.month,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .groupBy(transactions.month)
      .orderBy(transactions.month)
      .limit(6);

    // ── SIP summary ──────────────────────────────────────────────────────
    const sipData = await db.select().from(investments);
    const totalSIP = sipData
      .filter((i) => !i.isFrozen)
      .reduce((s, i) => s + i.monthlyAmount, 0);

    // Next SIP within current month
    const today = new Date().getDate();
    const nextSIP = sipData
      .filter((i) => !i.isFrozen && i.sipDate !== null)
      .map((i) => ({
        name: i.fundName,
        amount: i.monthlyAmount,
        sipDate: i.sipDate!,
        daysAway:
          i.sipDate! >= today ? i.sipDate! - today : 30 - today + i.sipDate!,
      }))
      .sort((a, b) => a.daysAway - b.daysAway)[0] ?? null;

    // ── Subscription burn ────────────────────────────────────────────────
    const subData = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.isActive, true));
    const totalSubMonthly = subData.reduce(
      (s, sub) =>
        s +
        (sub.billingCycle === "monthly"
          ? sub.monthlyAmount
          : sub.yearlyAmount / 12),
      0
    );

    // ── LTGS ─────────────────────────────────────────────────────────────
    const ltgs = await db.select().from(ltgsTracker).limit(1);
    const ltgsData = ltgs[0] ?? null;

    // ── Days remaining in month ──────────────────────────────────────────
    const now = new Date();
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
      monthlyTotals: monthlyTotals.map((m) => ({
        month: m.month,
        total: Number(m.total ?? 0),
      })),
      sip: {
        total: totalSIP,
        nextSIP,
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
