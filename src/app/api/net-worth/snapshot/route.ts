import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets, netWorthSnapshots, amortisationSchedule, loans, investments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { format } from "date-fns";

// POST — save a snapshot for the current month
export async function POST() {
  try {
    const currentMonth = format(new Date(), "yyyy-MM");

    const allAssets = await db.select().from(assets);
    const allInvestments = await db.select({ currentValue: investments.currentValue }).from(investments);
    const sipTotal = allInvestments.reduce((s, i) => s + (i.currentValue ?? 0), 0);
    const totalAssets = allAssets.reduce((s, a) => s + a.currentValue, 0) + sipTotal;

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

    const netWorth = totalAssets - totalLiabilities;

    // Upsert snapshot for current month
    const existing = await db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.month, currentMonth));
    if (existing.length > 0) {
      const [updated] = await db.update(netWorthSnapshots)
        .set({ totalAssets, totalLiabilities, netWorth })
        .where(eq(netWorthSnapshots.month, currentMonth))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db.insert(netWorthSnapshots)
      .values({ month: currentMonth, totalAssets, totalLiabilities, netWorth })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[net-worth/snapshot]", err);
    return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
  }
}
