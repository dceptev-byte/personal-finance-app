import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { taxDeductions, ltgsTracker, transactions, categories } from "@/db/schema";
import { eq, and, sum, gte, ne, isNotNull } from "drizzle-orm";
import { getFY, getFYMonths } from "@/lib/fy";

export async function GET() {
  try {
    const now = new Date();
    const fy = getFY(now);
    const fyMonths = getFYMonths(now);
    const fyFirst = fyMonths[0];
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const deductions = await db.select().from(taxDeductions).orderBy(taxDeductions.section);
    const ltgs = await db.select().from(ltgsTracker);

    // ── FY actuals from transactions ──────────────────────────────────────
    // Sum investment-tier transactions across this FY (these are 80C-eligible SIP investments)
    const fyInvestData = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        gte(transactions.month, fyFirst),
        eq(categories.tier, "investment"),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.categoryId, categories.name);

    const fyInvestedTotal = fyInvestData.reduce((s, r) => s + Number(r.total ?? 0), 0);

    // Monthly investment totals for sparkline (FY months so far)
    const monthlyInvestData = await db
      .select({
        month: transactions.month,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        gte(transactions.month, fyFirst),
        eq(categories.tier, "investment"),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
      ))
      .groupBy(transactions.month)
      .orderBy(transactions.month);

    // Project full-year total based on monthly average so far
    const monthsWithData = monthlyInvestData.length;
    const avgMonthly = monthsWithData > 0 ? fyInvestedTotal / monthsWithData : 0;
    const projectedFYTotal = Math.round(avgMonthly * 12);

    return NextResponse.json({
      deductions,
      ltgs: ltgs[0] ?? null,
      fyActuals: {
        fy,
        currentMonth,
        investedTotal: fyInvestedTotal,
        projectedFYTotal,
        byCategory: fyInvestData.map(r => ({
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          total: Number(r.total ?? 0),
        })),
        monthlyBreakdown: monthlyInvestData.map(r => ({
          month: r.month,
          total: Number(r.total ?? 0),
        })),
        limit80C: 150000,
      },
    });
  } catch (err) {
    console.error("[tax GET]", err);
    return NextResponse.json({ error: "Failed to fetch tax data" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; used: number; table: "deductions" | "ltgs" };
    if (body.table === "ltgs") {
      const [updated] = await db.update(ltgsTracker)
        .set({ used: body.used, updatedAt: new Date().toISOString() })
        .where(eq(ltgsTracker.id, body.id)).returning();
      return NextResponse.json(updated);
    }
    const [updated] = await db.update(taxDeductions)
      .set({ used: body.used, updatedAt: new Date().toISOString() })
      .where(eq(taxDeductions.id, body.id)).returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[tax PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
