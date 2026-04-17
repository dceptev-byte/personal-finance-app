import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { eq, and, gte, ne, isNotNull, sum } from "drizzle-orm";
import { format, subMonths } from "date-fns";

interface Anomaly {
  categoryId: number;
  category: string;
  color: string;
  currentMonth: string;
  currentSpend: number;
  median: number;
  ratio: number;
  historyMonths: { month: string; total: number }[];
}

// Returns median of an array of numbers
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET() {
  try {
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");

    // Build window: last 6 complete months (exclude current month)
    const windowMonths: string[] = [];
    for (let i = 1; i <= 6; i++) {
      windowMonths.push(format(subMonths(now, i), "yyyy-MM"));
    }
    const windowStart = windowMonths[windowMonths.length - 1]; // oldest month

    // Fetch categorised non-split-parent totals for window + current month
    const allMonths = [currentMonth, ...windowMonths];
    const spendRows = await db
      .select({
        month: transactions.month,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        total: sum(transactions.amount).as("total"),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        gte(transactions.month, windowStart),
        ne(transactions.isSplit, true),
        isNotNull(transactions.categoryId),
        ne(categories.tier, "income"),  // don't flag income categories
      ))
      .groupBy(transactions.month, transactions.categoryId, categories.name, categories.color);

    // Organise by category
    const byCat = new Map<number, {
      name: string; color: string;
      months: Map<string, number>;
    }>();

    for (const row of spendRows) {
      if (!row.categoryId) continue;
      if (!byCat.has(row.categoryId)) {
        byCat.set(row.categoryId, { name: row.categoryName, color: row.categoryColor, months: new Map() });
      }
      byCat.get(row.categoryId)!.months.set(row.month, Number(row.total ?? 0));
    }

    const anomalies: Anomaly[] = [];

    for (const [catId, catData] of byCat) {
      const currentSpend = catData.months.get(currentMonth) ?? 0;
      if (currentSpend === 0) continue;

      // History = window months that have data
      const history = windowMonths
        .map(m => ({ month: m, total: catData.months.get(m) ?? 0 }))
        .filter(r => r.total > 0);

      // Need at least 2 historical months to compute a meaningful median
      if (history.length < 2) continue;

      const med = median(history.map(r => r.total));
      if (med === 0) continue;

      const ratio = currentSpend / med;

      // Flag if > 2× median and current spend > ₹500 (filter noise)
      if (ratio >= 2 && currentSpend > 500) {
        anomalies.push({
          categoryId: catId,
          category: catData.name,
          color: catData.color,
          currentMonth,
          currentSpend,
          median: Math.round(med),
          ratio: Math.round(ratio * 10) / 10,
          historyMonths: history,
        });
      }
    }

    // Sort by severity (ratio desc)
    anomalies.sort((a, b) => b.ratio - a.ratio);

    return NextResponse.json({ anomalies, currentMonth, windowMonths });
  } catch (err) {
    console.error("[anomalies]", err);
    return NextResponse.json({ error: "Failed to compute anomalies" }, { status: 500 });
  }
}
