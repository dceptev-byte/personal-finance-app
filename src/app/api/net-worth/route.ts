import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assets, netWorthSnapshots, amortisationSchedule, loans, investments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { format } from "date-fns";

export async function GET() {
  try {
    const allAssets = await db.select().from(assets).orderBy(assets.type, assets.name);
    const snapshots = await db.select().from(netWorthSnapshots).orderBy(desc(netWorthSnapshots.month)).limit(12);

    // Total liabilities = outstanding loan balance for current month
    const currentMonth = format(new Date(), "yyyy-MM");
    const allLoans = await db.select().from(loans);
    let totalLiabilities = 0;
    for (const loan of allLoans) {
      const [schedule] = await db.select({ balance: amortisationSchedule.balance })
        .from(amortisationSchedule)
        .where(eq(amortisationSchedule.loanId, loan.id))
        .orderBy(desc(amortisationSchedule.month))
        .limit(1);
      if (schedule?.balance) totalLiabilities += schedule.balance;
    }

    // Auto-sync: SIP portfolio value from investments.currentValue
    const allInvestments = await db.select({
      fundName: investments.fundName,
      currentValue: investments.currentValue,
      isFrozen: investments.isFrozen,
    }).from(investments);
    const sipFunds = allInvestments
      .filter(i => (i.currentValue ?? 0) > 0)
      .map(i => ({ name: i.fundName, value: i.currentValue ?? 0, frozen: i.isFrozen }));
    const sipPortfolioTotal = sipFunds.reduce((s, f) => s + f.value, 0);

    const totalAssets = allAssets.reduce((s, a) => s + a.currentValue, 0) + sipPortfolioTotal;
    const netWorth = totalAssets - totalLiabilities;

    return NextResponse.json({
      assets: allAssets,
      totalAssets,
      totalLiabilities,
      netWorth,
      snapshots: snapshots.reverse(),
      currentMonth,
      sipPortfolio: { total: sipPortfolioTotal, funds: sipFunds },
    });
  } catch (err) {
    console.error("[net-worth GET]", err);
    return NextResponse.json({ error: "Failed to load net worth" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name: string; type: string; currentValue: number; notes?: string };
    const [created] = await db.insert(assets).values(body).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[net-worth POST]", err);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; currentValue?: number; name?: string; notes?: string };
    const { id, ...updates } = body;
    const [updated] = await db.update(assets)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(assets.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[net-worth PATCH]", err);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.delete(assets).where(eq(assets.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[net-worth DELETE]", err);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
